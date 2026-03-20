import { GoogleAuth } from 'google-auth-library';
import { getAdminClient } from '../clients';
import { normalizePropertyId } from '../utils/propertyId';

export async function listGoogleAdsLinks(
    auth: GoogleAuth,
    propertyId: string | number
): Promise<unknown[]> {
    const client = getAdminClient(auth);
    const parent = normalizePropertyId(propertyId);
    const links: unknown[] = [];

    const iterable = client.listGoogleAdsLinksAsync({ parent });
    for await (const link of iterable) {
        links.push(link);
    }

    return links;
}
