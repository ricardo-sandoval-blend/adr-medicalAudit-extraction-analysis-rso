import { requireAuth, AuthError } from '@/lib/auth';

/**
 * POST /api/admin — Protected endpoint (authentication required)
 * Requires valid Bearer token
 */
export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);

    // Protected action logic goes here
    return Response.json({
      message: 'Action executed successfully',
      user: user.name,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.code });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
