import { GoogleAuth } from 'google-auth-library';
import { getAdminClient } from '../clients';
import { normalizePropertyId } from '../utils/propertyId';

export async function getPropertyDetails(
    auth: GoogleAuth,
    propertyId: string | number
): Promise<unknown> {
    const client = getAdminClient(auth);
    const name = normalizePropertyId(propertyId);

    const [property] = await client.getProperty({ name });
    return property;
}
