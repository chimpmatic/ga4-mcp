import { GoogleAuth } from 'google-auth-library';
import type { searchconsole_v1 } from '@googleapis/searchconsole';
import { getGscClient } from '../clients';

interface SearchAnalyticsParams {
    site_url: string;
    start_date: string;
    end_date: string;
    dimensions?: string[];
    type?: string;
    row_limit?: number;
    start_row?: number;
    dimension_filter_groups?: Record<string, unknown>[];
    aggregation_type?: string;
    data_state?: string;
}

export async function gscSearchAnalytics(
    auth: GoogleAuth,
    params: SearchAnalyticsParams
): Promise<unknown> {
    const client = getGscClient(auth);

    const response = await client.searchanalytics.query({
        siteUrl: params.site_url,
        requestBody: {
            startDate: params.start_date,
            endDate: params.end_date,
            dimensions: params.dimensions,
            type: params.type,
            rowLimit: params.row_limit,
            startRow: params.start_row,
            dimensionFilterGroups: params.dimension_filter_groups as searchconsole_v1.Schema$ApiDimensionFilterGroup[] | undefined,
            aggregationType: params.aggregation_type,
            dataState: params.data_state,
        },
    });

    return response.data;
}
