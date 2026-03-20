// Module marker — needed for top-level await since all imports are dynamic
export {};

// ═══════════════════════════════════════════════════════════════════
// STDIO GUARD — MUST be FIRST before any imports.
// google-auth-library, gcp-metadata, and other Google libs can log
// to stdout, which corrupts the MCP JSON-RPC stdio stream.
// This redirects ALL non-JSON-RPC stdout writes to stderr.
// ═══════════════════════════════════════════════════════════════════
const rawStdoutWrite = process.stdout.write.bind(process.stdout);
const rawStderrWrite = process.stderr.write.bind(process.stderr);

// Redirect all console methods to stderr (MCP owns stdout)
console.log = (...args: unknown[]) => { rawStderrWrite(Buffer.from(args.join(' ') + '\n')); };
console.info = console.log;
console.debug = console.log;
console.warn = (...args: unknown[]) => { rawStderrWrite(Buffer.from('[WARN] ' + args.join(' ') + '\n')); };

// Guard stdout: only allow MCP JSON-RPC messages through
process.stdout.write = ((chunk: any, encoding?: any, cb?: any) => {
    const text = typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? '';
    if (text.includes('"jsonrpc"')) {
        return rawStdoutWrite(chunk, encoding, cb);
    }
    // Rogue stdout write — redirect to stderr
    return rawStderrWrite(chunk, encoding, cb);
}) as typeof process.stdout.write;

// ═══════════════════════════════════════════════════════════════════
// CLI argument parsing (before main — --help/--version exit early)
// ═══════════════════════════════════════════════════════════════════
const args = process.argv.slice(2);

function getArg(flag: string, envVar?: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    if (envVar) return process.env[envVar];
    return undefined;
}

if (args.includes('--help') || args.includes('-h')) {
    rawStdoutWrite(Buffer.from(`ga4-mcp — GA4 + Google Search Console MCP server

Usage: ga4-mcp [options]

Options:
  --tools <groups>     Comma-separated tool groups to enable (default: all)
                       Groups: ga4, gsc, indexing, admin, all
                       Note: "ga4" includes read-only analytics tools.
                       "admin" adds the ga4_admin write/delete mega-tool.
  --transport <type>   Transport mode: stdio (default) or http
  --port <number>      HTTP port when using --transport http (default: 3000)
  --version            Show version and exit
  --help               Show this help and exit

Environment:
  GOOGLE_APPLICATION_CREDENTIALS  Path to service account JSON key
  GA4_MCP_TOOLS                   Same as --tools (env fallback)
  GA4_MCP_TRANSPORT               Same as --transport (env fallback)
  GA4_MCP_PORT                    Same as --port (env fallback)

Examples:
  npx ga4-mcp                          # All tools, stdio
  npx ga4-mcp --tools ga4              # GA4 read tools only
  npx ga4-mcp --tools ga4,admin        # GA4 read + admin
  npx ga4-mcp --tools gsc,indexing     # GSC + Indexing
  npx ga4-mcp --transport http         # Streamable HTTP on :3000
`));
    process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
    const { SERVER_VERSION } = await import('./constants.js');
    rawStdoutWrite(Buffer.from(SERVER_VERSION + '\n'));
    process.exit(0);
}

const VALID_GROUPS = ['ga4', 'gsc', 'indexing', 'admin', 'all'];
const toolGroups = (getArg('--tools', 'GA4_MCP_TOOLS') ?? 'all').split(',').map(s => s.trim()).filter(Boolean);
const invalidGroups = toolGroups.filter(g => !VALID_GROUPS.includes(g));
if (invalidGroups.length > 0) {
    rawStderrWrite(Buffer.from(`[ga4-mcp] Error: Unknown tool group(s): ${invalidGroups.join(', ')}\nValid groups: ${VALID_GROUPS.join(', ')}\n`));
    process.exit(1);
}

const VALID_TRANSPORTS = ['stdio', 'http'];
const transportMode = getArg('--transport', 'GA4_MCP_TRANSPORT') ?? 'stdio';
if (!VALID_TRANSPORTS.includes(transportMode)) {
    rawStderrWrite(Buffer.from(`[ga4-mcp] Error: Unknown transport: ${transportMode}\nValid transports: ${VALID_TRANSPORTS.join(', ')}\n`));
    process.exit(1);
}

const httpPortRaw = getArg('--port', 'GA4_MCP_PORT') ?? '3000';
const httpPort = parseInt(httpPortRaw, 10);
if (isNaN(httpPort) || httpPort < 1 || httpPort > 65535) {
    rawStderrWrite(Buffer.from(`[ga4-mcp] Error: Invalid port: ${httpPortRaw}\nMust be a number between 1 and 65535.\n`));
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════
// Imports AFTER guard — any import-time stdout writes are now safe
// ═══════════════════════════════════════════════════════════════════

async function main() {
    const mcpSdk = await import('@modelcontextprotocol/sdk/server/mcp.js');
    const mcpStdio = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const googleAuth = await import('google-auth-library');
    const tools = await import('./tools/index.js');
    const { SERVER_NAME, SERVER_VERSION } = await import('./constants.js');

    // Auth scopes
    const readonlyAuth = new googleAuth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const editAuth = new googleAuth.GoogleAuth({
        scopes: [
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/analytics.edit',
            'https://www.googleapis.com/auth/webmasters',
        ],
    });

    const indexingAuth = new googleAuth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    // Factory: creates a fresh McpServer with tools registered.
    // HTTP transport needs one server per session (SDK constraint).
    // stdio uses a single server (one session for the process lifetime).
    function createServer(): InstanceType<typeof mcpSdk.McpServer> {
        const server = new mcpSdk.McpServer({
            name: SERVER_NAME,
            version: SERVER_VERSION,
        });
        tools.registerToolGroups(server as any, readonlyAuth, editAuth, indexingAuth, toolGroups);
        return server;
    }

    if (transportMode === 'http') {
        const mcpHttp = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
        const http = await import('http');
        const { randomUUID } = await import('crypto');
        const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');

        // Session transport map — one transport+server per session
        const transports: Record<string, InstanceType<typeof mcpHttp.StreamableHTTPServerTransport>> = {};

        const httpServer = http.createServer(async (req, res) => {
            const url = new URL(req.url ?? '/', `http://localhost:${httpPort}`);

            // Only accept /mcp path
            if (url.pathname !== '/mcp') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found. Use /mcp' }));
                return;
            }

            const sessionId = req.headers['mcp-session-id'] as string | undefined;

            if (req.method === 'POST') {
                // Parse body with error handling for malformed JSON
                let body: unknown;
                try {
                    const chunks: Buffer[] = [];
                    for await (const chunk of req) chunks.push(chunk as Buffer);
                    body = JSON.parse(Buffer.concat(chunks).toString());
                } catch {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        error: { code: -32700, message: 'Parse error' },
                        id: null,
                    }));
                    return;
                }

                try {
                    let transport: InstanceType<typeof mcpHttp.StreamableHTTPServerTransport>;

                    if (sessionId && transports[sessionId]) {
                        // Existing session — reuse transport
                        transport = transports[sessionId];
                    } else if (!sessionId && isInitializeRequest(body)) {
                        // New session — create transport + server
                        transport = new mcpHttp.StreamableHTTPServerTransport({
                            sessionIdGenerator: () => randomUUID(),
                            onsessioninitialized: (sid: string) => {
                                transports[sid] = transport;
                            },
                        });
                        transport.onclose = () => {
                            const sid = transport.sessionId;
                            if (sid && transports[sid]) delete transports[sid];
                        };
                        const server = createServer();
                        await server.connect(transport);
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                            id: null,
                        }));
                        return;
                    }

                    await transport.handleRequest(req, res, body);
                } catch (error) {
                    console.error('[ga4-mcp] Error handling MCP request:', error);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: 'Internal server error' },
                            id: null,
                        }));
                    }
                }
            } else if (req.method === 'GET') {
                // SSE stream for existing session
                if (!sessionId || !transports[sessionId]) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Invalid or missing session ID');
                    return;
                }
                try {
                    await transports[sessionId].handleRequest(req, res);
                } catch (error) {
                    console.error('[ga4-mcp] Error handling GET request:', error);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: 'Internal server error' },
                            id: null,
                        }));
                    }
                }
            } else if (req.method === 'DELETE') {
                // Session termination
                if (!sessionId || !transports[sessionId]) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Invalid or missing session ID');
                    return;
                }
                try {
                    await transports[sessionId].handleRequest(req, res);
                } catch (error) {
                    console.error('[ga4-mcp] Error handling DELETE request:', error);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: 'Internal server error' },
                            id: null,
                        }));
                    }
                }
            } else {
                res.writeHead(405, { 'Content-Type': 'text/plain' });
                res.end('Method not allowed');
            }
        });

        httpServer.listen(httpPort, () => {
            console.error(`[ga4-mcp] Streamable HTTP server listening on port ${httpPort}`);
        });

        // Clean shutdown for HTTP
        const shutdown = async () => {
            console.error('[ga4-mcp] Shutting down HTTP server...');
            for (const sid of Object.keys(transports)) {
                try { await transports[sid].close(); } catch {}
                delete transports[sid];
            }
            httpServer.close();
            process.exit(0);
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } else {
        // stdio transport — single server instance
        const server = createServer();
        const transport = new mcpStdio.StdioServerTransport();
        await server.connect(transport);

        console.error('[ga4-mcp] Server started, waiting for connections...');

        process.on('SIGTERM', () => {
            console.error('[ga4-mcp] Received SIGTERM, shutting down...');
            server.close().then(() => process.exit(0));
        });
        process.on('SIGINT', () => {
            console.error('[ga4-mcp] Received SIGINT, shutting down...');
            server.close().then(() => process.exit(0));
        });
    }
}

// Prevent crashes from killing the server
process.on('uncaughtException', (err) => {
    console.error('[ga4-mcp] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ga4-mcp] Unhandled rejection:', reason);
});

main().catch((err) => {
    console.error('[ga4-mcp] Fatal error:', err);
    process.exit(1);
});
