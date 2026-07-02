/**
 * Middleware de autenticación Keycloak para Next.js API routes.
 *
 * Verifica el access_token enviado como `Authorization: Bearer <token>`
 * contra el JWKS del realm usando `jose`. Stateless — sin sesiones ni cookies.
 *
 * Roles (client roles de Keycloak):
 *   viewer → solo lectura
 *   admin  → lectura + subir/borrar Excel
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

function getIssuer(): string {
  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) throw new Error('[auth] KEYCLOAK_ISSUER no está definido en .env');
  return issuer;
}

// JWKS lazy: se crea al primer uso para evitar errores en arranque sin red.
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(
      new URL(`${getIssuer()}/protocol/openid-connect/certs`)
    );
  }
  return _jwks;
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export type AuthUser = {
  sub: string;
  email: string;
  name: string;
  roles: string[];
};

async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: getIssuer(),
    });

    const sub = payload.sub as string | undefined;
    if (!sub) return null;

    const clientId = process.env.KEYCLOAK_CLIENT_ID ?? '';
    const roles = (payload.resource_access as any)?.[clientId]?.roles ?? [];
    const email = (payload.email as string) ?? '';
    const name = (payload.name as string) ?? (payload.preferred_username as string) ?? '';

    return { sub, email, name, roles };
  } catch (err) {
    console.error('[auth] token verification failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Valida el Bearer token y retorna el usuario si es válido.
 * Lanza un error con código 401 si falta token o no es válido.
 */
export async function requireAuth(req: Request): Promise<AuthUser> {
  const authHeader = req.headers.get('authorization');
  const token = extractBearerToken(authHeader ?? undefined);

  if (!token) {
    throw new AuthError('unauthorized', 401);
  }

  const user = await verifyToken(token);
  if (!user) {
    throw new AuthError('unauthorized', 401);
  }

  return user;
}


export class AuthError extends Error {
  constructor(
    message: string,
    public code: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
