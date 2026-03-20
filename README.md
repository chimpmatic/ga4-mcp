# ga4-mcp

GA4 + Google Search Console MCP server. Works with Claude, Copilot, Cursor, Codex, Gemini, and any MCP-compatible AI agent.

## Quick Start

```bash
npx -y ga4-mcp
```

Or install globally for faster startup:

```bash
npm install -g ga4-mcp
ga4-mcp
```

### Prerequisites

Authenticate with Google (includes all required scopes):

```bash
gcloud auth application-default login \
  --scopes="https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/analytics.edit,https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/indexing"
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON key file.

## Agent Configuration

### Claude Code

```json
{
  "mcpServers": {
    "ga4-analytics": {
      "command": "npx",
      "args": ["-y", "ga4-mcp"]
    }
  }
}
```

### Cursor / Windsurf / Continue

Add to `.cursor/mcp.json` or equivalent:

```json
{
  "mcpServers": {
    "ga4-analytics": {
      "command": "npx",
      "args": ["-y", "ga4-mcp"]
    }
  }
}
```

### Load only specific tool groups

```json
{
  "mcpServers": {
    "ga4-analytics": {
      "command": "npx",
      "args": ["-y", "ga4-mcp", "--tools", "ga4,gsc"]
    }
  }
}
```

## CLI Options

```
ga4-mcp [options]

--tools <groups>     Tool groups to enable: ga4, gsc, indexing, admin, all (default: all)
                     "ga4" = read-only analytics. "admin" = write/delete mega-tool.
--transport <type>   Transport: stdio (default) or http (Streamable HTTP)
--port <number>      HTTP port (default: 3000)
--version            Show version
--help               Show help
```

Environment variables: `GA4_MCP_TOOLS`, `GA4_MCP_TRANSPORT`, `GA4_MCP_PORT`

## Tools (16 total)

### Utility (1 tool)
| Tool | Description |
|------|-------------|
| `ping` | Health check — returns pong (always registered) |

### GA4 Analytics (6 tools) — group: `ga4`
| Tool | Description |
|------|-------------|
| `get_account_summaries` | List all GA4 accounts and properties |
| `get_property_details` | Property details (name, timezone, currency) |
| `run_report` | Run GA4 Data API reports |
| `run_realtime_report` | Run GA4 realtime reports |
| `get_custom_dimensions_and_metrics` | Custom dimensions and metrics |
| `list_google_ads_links` | Google Ads links for a property |

### GA4 Admin (1 mega-tool, 14 actions) — group: `admin`
| Tool | Description |
|------|-------------|
| `ga4_admin` | Create/update/delete properties, streams, key events, audiences |

### Google Search Console (6 tools) — group: `gsc`
| Tool | Description |
|------|-------------|
| `gsc_list_sites` | List all GSC properties |
| `gsc_search_analytics` | Query search analytics (impressions, clicks, CTR, position) |
| `gsc_inspect_url` | URL inspection (index status, crawl info, mobile usability) |
| `gsc_list_sitemaps` | List submitted sitemaps |
| `gsc_add_site` | Add a site to GSC |
| `gsc_submit_sitemap` | Submit a sitemap |

### Indexing API (2 tools) — group: `indexing`
| Tool | Description |
|------|-------------|
| `indexing_notify` | Notify Google to crawl/remove a URL |
| `indexing_status` | Check notification status for a URL |

## License

MIT
