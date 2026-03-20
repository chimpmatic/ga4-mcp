import { GoogleAuth } from 'google-auth-library';
import { getDataClient } from '../clients';
import { normalizePropertyId } from '../utils/propertyId';

interface RealtimeReportParams {
    property_id: string | number;
    dimensions: string[];
    metrics: string[];
    dimension_filter?: Record<string, unknown>;
    metric_filter?: Record<string, unknown>;
    order_bys?: Record<string, unknown>[];
    limit?: number;
    offset?: number;
    return_property_quota?: boolean;
}

export async function runRealtimeReport(
    auth: GoogleAuth,
    params: RealtimeReportParams
): Promise<unknown> {
    const client = getDataClient(auth);
    const property = normalizePropertyId(params.property_id);

    const response = await client.runRealtimeReport({
        property,
        dimensions: params.dimensions.map(name => ({ name })),
        metrics: params.metrics.map(name => ({ name })),
        dimensionFilter: params.dimension_filter as any,
        metricFilter: params.metric_filter as any,
        orderBys: params.order_bys as any,
        limit: params.limit,
        minuteRanges: undefined,
    });

    return Array.isArray(response) ? response[0] : response;
}
