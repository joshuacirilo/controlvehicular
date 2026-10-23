import 'server-only';
export class NotificationError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.name = 'NotificationError'; this.status = status; }
}
export async function notificationAction<T>(action: () => Promise<T>) {
  try { return { ok: true as const, status: 200, body: await action() }; }
  catch (error) {
    if (error instanceof NotificationError) return { ok: false as const, status: error.status, message: error.message };
    throw error;
  }
}
