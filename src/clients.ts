import { GoogleAuth } from 'google-auth-library';
import { AnalyticsAdminServiceClient } from '@google-analytics/admin';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { searchconsole } from '@googleapis/searchconsole';

let adminClient: AnalyticsAdminServiceClient | null = null;
let dataClient: BetaAnalyticsDataClient | null = null;
let gscClient: ReturnType<typeof searchconsole> | null = null;
let editAdminClient: AnalyticsAdminServiceClient | null = null;
let editGscClient: ReturnType<typeof searchconsole> | null = null;

export function getAdminClient(auth: GoogleAuth): AnalyticsAdminServiceClient {
    if (!adminClient) adminClient = new AnalyticsAdminServiceClient({ auth: auth as any });
    return adminClient;
}

export function getDataClient(auth: GoogleAuth): BetaAnalyticsDataClient {
    if (!dataClient) dataClient = new BetaAnalyticsDataClient({ auth: auth as any });
    return dataClient;
}

export function getGscClient(auth: GoogleAuth): ReturnType<typeof searchconsole> {
    if (!gscClient) gscClient = searchconsole({ version: 'v1', auth: auth as any });
    return gscClient;
}

export function getEditAdminClient(auth: GoogleAuth): AnalyticsAdminServiceClient {
    if (!editAdminClient) editAdminClient = new AnalyticsAdminServiceClient({ auth: auth as any });
    return editAdminClient;
}

export function getEditGscClient(auth: GoogleAuth): ReturnType<typeof searchconsole> {
    if (!editGscClient) editGscClient = searchconsole({ version: 'v1', auth: auth as any });
    return editGscClient;
}
