export function normalizePropertyId(propertyId: number | string): string {
    if (typeof propertyId === 'number') {
        return `properties/${propertyId}`;
    }

    const trimmed = propertyId.trim();
    if (/^\d+$/.test(trimmed)) {
        return `properties/${trimmed}`;
    }

    if (trimmed.startsWith('properties/')) {
        const numericPart = trimmed.split('/')[1];
        if (/^\d+$/.test(numericPart)) {
            return trimmed;
        }
    }

    throw new Error(
        `Invalid property ID: ${propertyId}. Expected a number or "properties/NUMBER".`
    );
}
