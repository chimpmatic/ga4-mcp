import { GoogleAuth } from 'google-auth-library';

const INDEXING_BASE = 'https://indexing.googleapis.com/v3';

export async function indexingNotify(
    auth: GoogleAuth,
    url: string,
    type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<unknown> {
    const client = await auth.getClient();
    const response = await client.request({
        url: `${INDEXING_BASE}/urlNotifications:publish`,
        method: 'POST',
        data: { url, type },
    });
    return response.data;
}

export async function indexingStatus(
    auth: GoogleAuth,
    url: string
): Promise<unknown> {
    const client = await auth.getClient();
    const response = await client.request({
        url: `${INDEXING_BASE}/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
        method: 'GET',
    });
    return response.data;
}
