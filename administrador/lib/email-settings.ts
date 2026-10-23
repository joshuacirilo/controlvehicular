export type EmailSettings = {
  id: string; email: string; enabled: boolean; revision: string;
  verifiedAt: string | null; updatedAt: string;
  updatedBy: { id: string; nombre: string; username: string };
};
export type EmailSettingsView = { settings: EmailSettings | null; providerConfigured: boolean; emergencyProviderConfigured: boolean };

/** One ordinary mailbox only: no display names, headers or recipient lists. */
export function normalizeNotificationEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 254 || /[\r\n]/.test(value)) return null;
  const parts = email.split('@');
  if (parts.length !== 2 || parts[0].length > 64 || !parts[0] || parts[0].startsWith('.') || parts[0].endsWith('.') || parts[0].includes('..')) return null;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(parts[0])) return null;
  const domain = parts[1].toLowerCase();
  if (!domain.includes('.') || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return `${parts[0]}@${domain}`;
}
