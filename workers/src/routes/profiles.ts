import { Hono } from 'hono';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const profiles = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/profiles/public — list public profiles (no auth needed, handled in index.ts)
profiles.get('/public', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM public_profiles WHERE is_public = 1 ORDER BY updated_at DESC`
  )
    .all();

  const results = rows.results.map(row => ({
    userId: row.user_id as string,
    isPublic: true,
    displayName: row.display_name as string,
    shareToken: row.share_token as string | null,
    updatedAt: row.updated_at as string,
  }));

  return c.json({ profiles: results });
});

// GET /api/profiles/:userId
profiles.get('/:userId', async (c) => {
  const targetUserId = c.req.param('userId');

  const row = await c.env.DB.prepare(
    'SELECT * FROM public_profiles WHERE user_id = ?'
  )
    .bind(targetUserId)
    .first();

  if (!row) return c.json({ error: 'Profile not found' }, 404);

  return c.json({
    profile: {
      userId: row.user_id as string,
      isPublic: !!(row.is_public as number),
      displayName: row.display_name as string,
      shareToken: row.share_token as string | null,
      updatedAt: row.updated_at as string,
    },
  });
});

// PUT /api/profiles — update own profile (auth required)
profiles.put('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    isPublic?: boolean;
    displayName?: string;
    shareToken?: string;
  }>();

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO public_profiles (user_id, is_public, display_name, share_token, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       is_public = COALESCE(excluded.is_public, public_profiles.is_public),
       display_name = COALESCE(excluded.display_name, public_profiles.display_name),
       share_token = COALESCE(excluded.share_token, public_profiles.share_token),
       updated_at = excluded.updated_at`
  )
    .bind(
      userId,
      body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : 0,
      body.displayName || 'Anonymous',
      body.shareToken || null,
      now
    )
    .run();

  return c.json({ success: true });
});

export { profiles };
