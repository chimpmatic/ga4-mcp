import { GoogleAuth } from 'google-auth-library';
import { getGscClient } from '../clients';

interface InspectUrlParams {
    site_url: string;
    inspection_url: string;
    language_code?: string;
}

export async function gscInspectUrl(
    auth: GoogleAuth,
    params: InspectUrlParams
): Promise<unknown> {
    const client = getGscClient(auth);

    const response = await client.urlInspection.index.inspect({
        requestBody: {
            siteUrl: params.site_url,
            inspectionUrl: params.inspection_url,
            languageCode: params.language_code ?? 'en-US',
        },
    });

    return response.data;
}
