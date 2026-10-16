import 'server-only';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import users from './test-users.json';

export function verifyTestLogin(username: string, password: string) {
  const user = users.find(candidate => candidate.username === username);
  if (!user) return null;
  const hash = scryptSync(password, user.salt, 64);
  if (!timingSafeEqual(hash, Buffer.from(user.passwordHash, 'hex'))) return null;
  return { id: user.id, username: user.username, name: user.name };
}
