import jwt from 'jsonwebtoken';
import { UserRole } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'control_vehicular_jwt_super_secret_development_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  rol: UserRole;
  driverId?: string; // Si el rol es 'conductor', incluimos su driverId
}

export function signToken(payload: TokenPayload): string {
  // @ts-expect-error jsonwebtoken types mismatch with expiresIn string literal
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}
