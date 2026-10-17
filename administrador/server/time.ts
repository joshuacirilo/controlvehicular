/**
 * Trip dates are stored as Guatemala wall-clock time (UTC-6, no daylight saving):
 * a BSON date cannot carry an offset, so the stored value reads as local time but
 * is labeled Z by MongoDB tools. Only compare stored dates with other stored dates.
 */
const GUATEMALA_OFFSET_MS = -6 * 60 * 60 * 1000;

export const toGuatemala = (instant: Date) => new Date(instant.getTime() + GUATEMALA_OFFSET_MS);

export const guatemalaNow = () => toGuatemala(new Date());

/** ISO 8601 with the -06:00 offset, so clients read the real instant. */
export const formatGuatemala = (stored: Date) => stored.toISOString().replace('Z', '-06:00');
