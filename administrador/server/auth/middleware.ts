import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from './jwt';
import { UserRole } from '../models/User';

export interface AuthenticatedRequest {
  user: TokenPayload;
}

/**
 * Extrae y valida el JWT del header Authorization (Bearer <token>)
 * o de las cookies de la sesión.
 */
export function authenticateRequest(
  req: NextRequest,
  allowedRoles?: UserRole[]
): { user: TokenPayload } | { errorResponse: NextResponse } {
  let token: string | undefined;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    token = req.cookies.get('token')?.value;
  }

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { error: 'No autorizado: Token de autenticación no proporcionado' },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      errorResponse: NextResponse.json(
        { error: 'No autorizado: Token inválido o expirado' },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(payload.rol)) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Prohibido: No tienes los permisos requeridos para esta operación' },
        { status: 403 }
      ),
    };
  }

  return { user: payload };
}
