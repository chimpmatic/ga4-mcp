import { GoogleAuth } from 'google-auth-library';
import { getGscClient } from '../clients';

export async function gscListSites(
    auth: GoogleAuth
): Promise<unknown> {
    const client = getGscClient(auth);

    const response = await client.sites.list({});

    return response.data;
}
