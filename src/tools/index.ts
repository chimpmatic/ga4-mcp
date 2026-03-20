import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GoogleAuth } from 'google-auth-library';
import { getAccountSummaries } from './accountSummaries';
import { getPropertyDetails } from './propertyDetails';
import { listGoogleAdsLinks } from './adsLinks';
import { runReport } from './runReport';
import { runRealtimeReport } from './realtimeReport';
import { getCustomDimensionsAndMetrics } from './customDimensions';
import { gscSearchAnalytics } from './gscSearchAnalytics';
import { gscInspectUrl } from './gscInspectUrl';
import { gscListSitemaps } from './gscSitemaps';
import { gscListSites } from './gscSites';
import { ga4AdminDispatch, GA4_ADMIN_ACTIONS } from './ga4Admin';
import { gscAddSite, gscSubmitSitemap } from './gscManage';
import { indexingNotify, indexingStatus } from './indexingApi';

function sanitizeToolError(err: unknown): string {
    if (!(err instanceof Error)) return 'An unexpected error occurred.';
    const msg = err.message;
    if (msg.includes('UNAUTHENTICATED') || msg.includes('Could not load the default credentials')) {
        return 'Authentication failed. Run: gcloud auth application-default login --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/analytics.edit,https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/indexing';
    }
    if (msg.includes('PERMISSION_DENIED')) {
        return 'Permission denied. Ensure your Google account has access to this GA4 property.';
    }
    if (msg.includes('NOT_FOUND')) {
        return 'Property not found. Check that the property ID is correct and accessible.';
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        return 'API quota exceeded. Please wait a moment and try again.';
    }
    if (msg.includes('INVALID_ARGUMENT')) {
        return 'Invalid request parameters. Check dimension/metric names and date ranges.';
    }
    return msg
        .replace(/projects\/[^\s/]+/g, 'projects/***')
        .replace(/\/home\/[^\s/]+/g, '/home/***')
        .replace(/\/Users\/[^\s/]+/g, '/Users/***')
        .replace(/at\s+.+\(.+:\d+:\d+\)/g, '')
        .trim() || 'An unexpected error occurred.';
}

function safeTool<T>(handler: (params: T) => Promise<{ content: { type: 'text'; text: string }[] }>):
    (params: T) => Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
    return async (params: T) => {
        try {
            return await handler(params);
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: sanitizeToolError(err) }],
                isError: true,
            };
        }
    };
}

export function registerToolGroups(
    server: McpServer,
    auth: GoogleAuth,
    editAuth: GoogleAuth,
    indexingAuth: GoogleAuth,
    groups: string[]
): void {
    const enableAll = groups.includes('all');

    // Always register ping
    server.tool("ping", "Health check — returns pong if server is running", {}, async () => ({
        content: [{ type: "text", text: "pong" }]
    }));

    if (enableAll || groups.includes('ga4')) {
        registerGa4ReadTools(server, auth);
    }

    if (enableAll || groups.includes('admin')) {
        registerGa4AdminTools(server, editAuth);
    }

    if (enableAll || groups.includes('gsc')) {
        registerGscTools(server, editAuth);
    }

    if (enableAll || groups.includes('indexing')) {
        registerIndexingTools(server, indexingAuth);
    }
}

function registerGa4ReadTools(server: McpServer, auth: GoogleAuth): void {
    server.tool(
        'get_account_summaries',
        'Retrieves all Google Analytics accounts and properties accessible to the authenticated user.',
        {},
        safeTool(async () => {
            const result = await getAccountSummaries(auth);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'get_property_details',
        'Returns details about a GA4 property including display name, timezone, currency, and industry category.',
        { property_id: z.union([z.string(), z.number()]).describe('GA4 property ID') },
        safeTool(async ({ property_id }) => {
            const result = await getPropertyDetails(auth, property_id);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'list_google_ads_links',
        'Returns a list of links to Google Ads accounts for a GA4 property.',
        { property_id: z.union([z.string(), z.number()]).describe('GA4 property ID') },
        safeTool(async ({ property_id }) => {
            const result = await listGoogleAdsLinks(auth, property_id);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'run_report',
        'Runs a Google Analytics 4 Data API report.',
        {
            property_id: z.union([z.string(), z.number()]).describe('GA4 property ID'),
            date_ranges: z.array(z.object({
                start_date: z.string(),
                end_date: z.string(),
                name: z.string().optional(),
            })).describe('Date ranges'),
            dimensions: z.array(z.string()).describe('Dimension names'),
            metrics: z.array(z.string()).describe('Metric names'),
            dimension_filter: z.record(z.unknown()).optional(),
            metric_filter: z.record(z.unknown()).optional(),
            order_bys: z.array(z.record(z.unknown())).optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
            currency_code: z.string().optional(),
            return_property_quota: z.boolean().optional(),
        },
        safeTool(async (params) => {
            const result = await runReport(auth, params);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'run_realtime_report',
        'Runs a GA4 realtime report.',
        {
            property_id: z.union([z.string(), z.number()]).describe('GA4 property ID'),
            dimensions: z.array(z.string()),
            metrics: z.array(z.string()),
            dimension_filter: z.record(z.unknown()).optional(),
            metric_filter: z.record(z.unknown()).optional(),
            order_bys: z.array(z.record(z.unknown())).optional(),
            limit: z.number().optional(),
            offset: z.number().optional(),
            return_property_quota: z.boolean().optional(),
        },
        safeTool(async (params) => {
            const result = await runRealtimeReport(auth, params);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'get_custom_dimensions_and_metrics',
        'Retrieves custom dimensions and custom metrics for a GA4 property.',
        { property_id: z.union([z.string(), z.number()]).describe('GA4 property ID') },
        safeTool(async ({ property_id }) => {
            const result = await getCustomDimensionsAndMetrics(auth, property_id);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );
}

function registerGa4AdminTools(server: McpServer, editAuth: GoogleAuth): void {
    server.tool(
        'ga4_admin',
        'GA4 property administration. ' +
        'Read: list_data_streams(property_id), list_key_events(property_id), ' +
        'list_audiences(property_id), list_firebase_links(property_id), ' +
        'get_measurement_protocol_secret(property_id, stream_id, secret_id). ' +
        'Write: create_property(account_id, display_name, time_zone?, currency_code?), ' +
        'update_property(property_id, display_name?, time_zone?, currency_code?), ' +
        'create_data_stream(property_id, type?, display_name, default_uri?), ' +
        'update_data_stream(property_id, stream_id, display_name), ' +
        'create_measurement_protocol_secret(property_id, stream_id, display_name?), ' +
        'create_key_event(property_id, event_name, counting_method?). ' +
        'Destructive (requires confirm:true): delete_property(property_id), ' +
        'delete_data_stream(property_id, stream_id), delete_key_event(property_id, key_event_id).',
        {
            action: z.enum(GA4_ADMIN_ACTIONS as unknown as [string, ...string[]]).describe('Admin action to perform'),
            params: z.record(z.unknown()).optional().describe('Action parameters — see tool description'),
        },
        safeTool(async ({ action, params }) => {
            const result = await ga4AdminDispatch(editAuth, action as any, params ?? {});
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );
}

function registerGscTools(server: McpServer, editAuth: GoogleAuth): void {
    server.tool(
        'gsc_list_sites',
        'Lists all sites (properties) the authenticated user has access to in Google Search Console.',
        {},
        safeTool(async () => {
            const result = await gscListSites(editAuth);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'gsc_search_analytics',
        'Queries Google Search Console search analytics data — impressions, clicks, CTR, and position for queries, pages, countries, and devices.',
        {
            site_url: z.string().describe('Site URL as defined in GSC (e.g. "https://example.com/" or "sc-domain:example.com")'),
            start_date: z.string().describe('Start date in YYYY-MM-DD format'),
            end_date: z.string().describe('End date in YYYY-MM-DD format'),
            dimensions: z.array(z.string()).optional().describe('Dimensions to group by: query, page, country, device, searchAppearance, date'),
            type: z.string().optional().describe('Search type: web, image, video, news, discover, googleNews'),
            row_limit: z.number().optional().describe('Max rows to return (default 1000, max 25000)'),
            start_row: z.number().optional().describe('Zero-based row offset for pagination'),
            dimension_filter_groups: z.array(z.record(z.unknown())).optional().describe('Dimension filter groups'),
            aggregation_type: z.string().optional().describe('How data is aggregated: auto, byProperty, byPage'),
            data_state: z.string().optional().describe('Data state: final, all (includes partial data)'),
        },
        safeTool(async (params) => {
            const result = await gscSearchAnalytics(editAuth, params);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'gsc_inspect_url',
        'Inspects a URL in Google Search Console — returns index status, crawl info, mobile usability, and rich results.',
        {
            site_url: z.string().describe('Site URL as defined in GSC (e.g. "https://example.com/" or "sc-domain:example.com")'),
            inspection_url: z.string().describe('Full URL to inspect (must be under the site_url property)'),
            language_code: z.string().optional().describe('Language for issue messages (default: en-US)'),
        },
        safeTool(async (params) => {
            const result = await gscInspectUrl(editAuth, params);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'gsc_list_sitemaps',
        'Lists all sitemaps submitted for a site in Google Search Console.',
        {
            site_url: z.string().describe('Site URL as defined in GSC (e.g. "https://example.com/" or "sc-domain:example.com")'),
        },
        safeTool(async ({ site_url }) => {
            const result = await gscListSitemaps(editAuth, site_url);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'gsc_add_site',
        'Adds a site to Google Search Console. Use URL prefix (e.g. "https://example.com/") or domain property (e.g. "sc-domain:example.com").',
        {
            site_url: z.string().describe('Site URL to add (URL prefix or sc-domain: format)'),
        },
        safeTool(async ({ site_url }) => {
            const result = await gscAddSite(editAuth, site_url);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'gsc_submit_sitemap',
        'Submits a sitemap URL for a site in Google Search Console.',
        {
            site_url: z.string().describe('Site URL as defined in GSC'),
            sitemap_url: z.string().describe('Full URL of the sitemap to submit'),
        },
        safeTool(async ({ site_url, sitemap_url }) => {
            const result = await gscSubmitSitemap(editAuth, site_url, sitemap_url);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );
}

function registerIndexingTools(server: McpServer, indexingAuth: GoogleAuth): void {
    server.tool(
        'indexing_notify',
        'Notifies Google to crawl or remove a URL via the Indexing API. Requires service account with indexing scope.',
        {
            url: z.string().describe('Full URL to notify Google about'),
            type: z.enum(['URL_UPDATED', 'URL_DELETED']).optional().describe('Notification type (default: URL_UPDATED)'),
        },
        safeTool(async ({ url, type }) => {
            const result = await indexingNotify(indexingAuth, url, type ?? 'URL_UPDATED');
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );

    server.tool(
        'indexing_status',
        'Checks the last crawl/notification status for a URL via the Indexing API.',
        {
            url: z.string().describe('URL to check notification status for'),
        },
        safeTool(async ({ url }) => {
            const result = await indexingStatus(indexingAuth, url);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        })
    );
}
