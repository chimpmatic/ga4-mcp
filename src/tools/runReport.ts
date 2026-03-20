import { GoogleAuth } from 'google-auth-library';
import { getDataClient } from '../clients';
import { normalizePropertyId } from '../utils/propertyId';

interface RunReportParams {
    property_id: string | number;
    date_ranges: { start_date: string; end_date: string; name?: string }[];
    dimensions: string[];
    metrics: string[];
    dimension_filter?: Record<string, unknown>;
    metric_filter?: Record<string, unknown>;
    order_bys?: Record<string, unknown>[];
    limit?: number;
    offset?: number;
    currency_code?: string;
    return_property_quota?: boolean;
}

export async function runReport(
    auth: GoogleAuth,
    params: RunReportParams
): Promise<unknown> {
    const client = getDataClient(auth);
    const property = normalizePropertyId(params.property_id);

    const response = await client.runReport({
        property,
        dateRanges: params.date_ranges.map(dr => ({
            startDate: dr.start_date,
            endDate: dr.end_date,
            name: dr.name,
        })),
        dimensions: params.dimensions.map(name => ({ name })),
        metrics: params.metrics.map(name => ({ name })),
        dimensionFilter: params.dimension_filter as any,
        metricFilter: params.metric_filter as any,
        orderBys: params.order_bys as any,
        limit: params.limit,
        offset: params.offset,
        currencyCode: params.currency_code,
        returnPropertyQuota: params.return_property_quota,
    });

    return Array.isArray(response) ? response[0] : response;
}
