import { requireAuth, AuthError } from '@/lib/auth';

/**
 * GET /api/user — Returns authenticated user info
 * Requires valid Bearer token
 */
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    return Response.json(user);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.code });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
