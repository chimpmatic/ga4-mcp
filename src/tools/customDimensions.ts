import { GoogleAuth } from 'google-auth-library';
import { getDataClient } from '../clients';
import { normalizePropertyId } from '../utils/propertyId';

export async function getCustomDimensionsAndMetrics(
    auth: GoogleAuth,
    propertyId: string | number
): Promise<unknown> {
    const client = getDataClient(auth);
    const name = normalizePropertyId(propertyId) + '/metadata';

    const [metadata] = await client.getMetadata({ name });
    return metadata;
}
