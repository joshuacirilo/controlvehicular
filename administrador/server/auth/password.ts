import 'server-only';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Format shared with scripts/create-admin.mjs: `scrypt$<salt>$<hash>` in base64url.
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;
const DUMMY_HASH = `scrypt$${randomBytes(16).toString('base64url')}$${randomBytes(KEY_LENGTH).toString('base64url')}`;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/** Verifies against a stored hash; pass null for unknown users so the response time does not reveal them. */
export async function verifyPassword(password: string, stored: string | null) {
  const [scheme, salt, hash] = (stored ?? DUMMY_HASH).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length);
  return stored !== null && timingSafeEqual(actual, expected);
}
