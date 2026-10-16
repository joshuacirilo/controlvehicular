import 'server-only';
import type { ObjectId } from 'mongodb';
import { verifyPassword } from '@/server/auth/password';
import { getDb } from '@/server/db/mongo';

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;

type Lockable = { _id: ObjectId; passwordHash?: string; failedLogins?: number; lockedUntil?: Date | null };

export type CredentialCheck<T> = { ok: true; account: T } | { ok: false; reason: 'invalid' | 'locked' };

/**
 * Verifies a password for an account of `users` or `trucks`. Pass null when no account matched so
 * timing does not reveal it. Five failures lock the account for 15 minutes.
 */
export async function checkCredentials<T extends Lockable>(
  collection: 'users' | 'trucks',
  account: T | null,
  password: string,
): Promise<CredentialCheck<T>> {
  const now = new Date();
  if (account?.lockedUntil && account.lockedUntil > now) return { ok: false, reason: 'locked' };
  const valid = await verifyPassword(password, account?.passwordHash ?? null);
  if (!account) return { ok: false, reason: 'invalid' };
  const accounts = (await getDb()).collection<Lockable>(collection);
  if (!valid) {
    const updated = await accounts.findOneAndUpdate(
      { _id: account._id }, { $inc: { failedLogins: 1 } }, { returnDocument: 'after', projection: { failedLogins: 1 } },
    );
    if ((updated?.failedLogins ?? 0) >= MAX_FAILED_LOGINS) {
      await accounts.updateOne({ _id: account._id }, { $set: { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MS) } });
    }
    return { ok: false, reason: 'invalid' };
  }
  if (account.failedLogins || account.lockedUntil) {
    await accounts.updateOne({ _id: account._id }, { $set: { failedLogins: 0, lockedUntil: null } });
  }
  return { ok: true, account };
}
