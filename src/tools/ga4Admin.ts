import { GoogleAuth } from 'google-auth-library';
import { getEditAdminClient } from '../clients';
import { normalizePropertyId } from '../utils/propertyId';

const GA4_ADMIN_ACTIONS = [
    'list_data_streams',
    'create_property',
    'update_property',
    'delete_property',
    'create_data_stream',
    'update_data_stream',
    'delete_data_stream',
    'list_key_events',
    'create_key_event',
    'delete_key_event',
    'list_audiences',
    'list_firebase_links',
    'get_measurement_protocol_secret',
    'create_measurement_protocol_secret',
] as const;

export type Ga4AdminAction = typeof GA4_ADMIN_ACTIONS[number];
export { GA4_ADMIN_ACTIONS };

const DESTRUCTIVE_ACTIONS: Ga4AdminAction[] = [
    'delete_property',
    'delete_data_stream',
    'delete_key_event',
];

export async function ga4AdminDispatch(
    auth: GoogleAuth,
    action: Ga4AdminAction,
    params: Record<string, unknown>
): Promise<unknown> {
    if (DESTRUCTIVE_ACTIONS.includes(action) && params.confirm !== true) {
        const target = params.property_id ?? params.key_event_id ?? 'unknown';
        return {
            warning: `⚠️ DESTRUCTIVE ACTION: ${action}`,
            target: String(target),
            message: 'This cannot be undone. Call again with confirm: true to proceed.',
            confirm_required: true,
        };
    }

    const client = getEditAdminClient(auth);

    switch (action) {
        case 'list_data_streams': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const streams: unknown[] = [];
            for await (const s of client.listDataStreamsAsync({ parent })) {
                streams.push(s);
            }
            return streams;
        }

        case 'create_property': {
            const [property] = await client.createProperty({
                property: {
                    parent: `accounts/${params.account_id}`,
                    displayName: params.display_name as string,
                    timeZone: (params.time_zone as string) ?? 'America/New_York',
                    currencyCode: (params.currency_code as string) ?? 'USD',
                },
            });
            return property;
        }

        case 'update_property': {
            const name = normalizePropertyId(params.property_id as string | number);
            const updateFields: Record<string, unknown> = {};
            const paths: string[] = [];
            if (params.display_name) { updateFields.displayName = params.display_name; paths.push('display_name'); }
            if (params.time_zone) { updateFields.timeZone = params.time_zone; paths.push('time_zone'); }
            if (params.currency_code) { updateFields.currencyCode = params.currency_code; paths.push('currency_code'); }
            if (paths.length === 0) throw new Error('At least one field must be provided to update.');
            const [property] = await client.updateProperty({
                property: { name, ...updateFields },
                updateMask: { paths },
            });
            return property;
        }

        case 'delete_property': {
            const name = normalizePropertyId(params.property_id as string | number);
            const [result] = await client.deleteProperty({ name });
            return { deleted: true, property: result };
        }

        case 'create_data_stream': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const streamType = ((params.type as string) ?? 'WEB_DATA_STREAM') as 'WEB_DATA_STREAM' | 'ANDROID_APP_DATA_STREAM' | 'IOS_APP_DATA_STREAM';
            const response = await client.createDataStream({
                parent,
                dataStream: {
                    type: streamType,
                    displayName: params.display_name as string,
                    webStreamData: streamType === 'WEB_DATA_STREAM'
                        ? { defaultUri: params.default_uri as string | undefined }
                        : undefined,
                },
            });
            return Array.isArray(response) ? response[0] : response;
        }

        case 'update_data_stream': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const name = `${parent}/dataStreams/${params.stream_id}`;
            const paths: string[] = [];
            const updates: Record<string, unknown> = {};
            if (params.display_name) { updates.displayName = params.display_name; paths.push('display_name'); }
            if (paths.length === 0) throw new Error('At least one field must be provided to update.');
            const [stream] = await client.updateDataStream({
                dataStream: { name, ...updates },
                updateMask: { paths },
            });
            return stream;
        }

        case 'delete_data_stream': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const name = `${parent}/dataStreams/${params.stream_id}`;
            await client.deleteDataStream({ name });
            return { deleted: true, data_stream: name };
        }

        case 'list_key_events': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const events: unknown[] = [];
            for await (const e of client.listKeyEventsAsync({ parent })) {
                events.push(e);
            }
            return events;
        }

        case 'create_key_event': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const countingMethod = ((params.counting_method as string) ?? 'ONCE_PER_EVENT') as 'ONCE_PER_EVENT' | 'ONCE_PER_SESSION';
            const response = await client.createKeyEvent({
                parent,
                keyEvent: {
                    eventName: params.event_name as string,
                    countingMethod,
                },
            });
            return Array.isArray(response) ? response[0] : response;
        }

        case 'delete_key_event': {
            const name = `${normalizePropertyId(params.property_id as string | number)}/keyEvents/${params.key_event_id}`;
            await client.deleteKeyEvent({ name });
            return { deleted: true, key_event: name };
        }

        case 'list_audiences': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const audiences: unknown[] = [];
            for await (const a of client.listAudiencesAsync({ parent })) {
                audiences.push(a);
            }
            return audiences;
        }

        case 'list_firebase_links': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const links: unknown[] = [];
            for await (const l of client.listFirebaseLinksAsync({ parent })) {
                links.push(l);
            }
            return links;
        }

        case 'get_measurement_protocol_secret': {
            const parent = normalizePropertyId(params.property_id as string | number);
            const name = `${parent}/dataStreams/${params.stream_id}/measurementProtocolSecrets/${params.secret_id}`;
            const [secret] = await client.getMeasurementProtocolSecret({ name });
            return secret;
        }

        case 'create_measurement_protocol_secret': {
            const parent = `${normalizePropertyId(params.property_id as string | number)}/dataStreams/${params.stream_id}`;
            const [secret] = await client.createMeasurementProtocolSecret({
                parent,
                measurementProtocolSecret: {
                    displayName: (params.display_name as string) ?? undefined,
                },
            });
            return secret;
        }

        default: {
            const _exhaustive: never = action;
            throw new Error(`Unknown admin action: ${_exhaustive}`);
        }
    }
}
