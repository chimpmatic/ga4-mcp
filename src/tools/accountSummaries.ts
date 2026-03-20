import { GoogleAuth } from 'google-auth-library';
import { getAdminClient } from '../clients';

export async function getAccountSummaries(auth: GoogleAuth): Promise<unknown[]> {
    const client = getAdminClient(auth);
    const summaries: unknown[] = [];

    const iterable = client.listAccountSummariesAsync({});
    for await (const summary of iterable) {
        summaries.push(summary);
    }

    return summaries;
}
