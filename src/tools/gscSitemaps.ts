import { GoogleAuth } from 'google-auth-library';
import { getGscClient } from '../clients';

export async function gscListSitemaps(
    auth: GoogleAuth,
    siteUrl: string
): Promise<unknown> {
    const client = getGscClient(auth);

    const response = await client.sitemaps.list({
        siteUrl,
    });

    return response.data;
}
