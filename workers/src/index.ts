import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware, getAuthUserId } from './middleware/auth';
import { cards } from './routes/cards';
import { sync } from './routes/sync';
import { tags } from './routes/tags';
import { aliases } from './routes/aliases';
import { gamification } from './routes/gamification';
import { rankings } from './routes/rankings';
import { bookmarks } from './routes/bookmarks';
import { decks } from './routes/decks';
import { profiles } from './routes/profiles';
import { community } from './routes/community';
import { account } from './routes/account';
import { supplies } from './routes/supplies';
import { shares } from './routes/shares';

type Bindings = {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS — must be first middleware
app.use('*', cors({
  origin: [
    'https://yami-rin.github.io',
    'http://localhost:3000',
    'http://localhost:8787',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Health check (no auth)
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Public endpoints (no auth required)
app.get('/api/rarities', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT DISTINCT rarity FROM cards WHERE rarity != \'\' ORDER BY rarity'
  ).all();
  const rarities = rows.results.map(row => row.rarity as string);
  return c.json({ rarities });
});
app.route('/api/rankings', rankings);
app.get('/api/profiles/public', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM public_profiles WHERE is_public = 1 ORDER BY updated_at DESC'
  ).all();
  const results = rows.results.map(row => ({
    userId: row.user_id as string,
    isPublic: true,
    displayName: row.display_name as string,
    shareToken: row.share_token as string | null,
    updatedAt: row.updated_at as string,
  }));
  return c.json({ profiles: results });
});
// Duel-simulator share fetch is public (recipients open without logging in)
app.get('/api/shares/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT kind, data FROM duel_shares WHERE id = ?'
  ).bind(id).first();
  if (!row) return c.json({ error: 'Share not found' }, 404);
  return c.json({ kind: row.kind as string, data: row.data as string });
});
app.get('/api/profiles/:userId', async (c) => {
  const targetUserId = c.req.param('userId');
  const row = await c.env.DB.prepare(
    'SELECT * FROM public_profiles WHERE user_id = ?'
  ).bind(targetUserId).first();
  if (!row) return c.json({ error: 'Profile not found' }, 404);
  // Private profiles are only visible to their owner (public ones need no auth)
  if (!(row.is_public as number)) {
    const requesterId = await getAuthUserId(c);
    if (requesterId !== targetUserId) {
      return c.json({ error: 'Profile not found' }, 404);
    }
  }
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

// Auth-protected endpoints
app.use('/api/cards/*', authMiddleware);
app.use('/api/cards', authMiddleware);
app.use('/api/sync/*', authMiddleware);
app.use('/api/sync', authMiddleware);
app.use('/api/tags/*', authMiddleware);
app.use('/api/tags', authMiddleware);
app.use('/api/aliases/*', authMiddleware);
app.use('/api/aliases', authMiddleware);
app.use('/api/gamification/*', authMiddleware);
app.use('/api/gamification', authMiddleware);
app.use('/api/bookmarks/*', authMiddleware);
app.use('/api/bookmarks', authMiddleware);
app.use('/api/decks/*', authMiddleware);
app.use('/api/decks', authMiddleware);
app.use('/api/community/*', authMiddleware);
app.use('/api/account/*', authMiddleware);
app.use('/api/account', authMiddleware);
app.use('/api/supplies/*', authMiddleware);
app.use('/api/supplies', authMiddleware);
// creating a share needs auth (exact path only — GET /api/shares/:id stays public above)
app.use('/api/shares', authMiddleware);

// Rankings PUT needs auth (GET is public, already routed above)
app.put('/api/rankings', authMiddleware, async (c) => {
  const userId = c.get('userId');
  // The leaderboard sort keys (totalCards / uniqueCards) are computed
  // server-side from the cards table so they cannot be claimed arbitrarily.
  // currentStreak / totalPoints remain client-reported: their source of truth
  // (the gamification blob) is client-written anyway, and reading it here
  // would race the client's debounced save (stale by one update).
  const body = await c.req.json<{
    nickname?: string;
    icon?: string;
    currentStreak?: number;
    totalPoints?: number;
  }>().catch(() => ({} as Record<string, never>));

  const nickname = typeof body.nickname === 'string' ? body.nickname.slice(0, 50) : '';
  const icon = typeof body.icon === 'string' ? body.icon.slice(0, 16) : '👤';
  const clampStat = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(Math.max(0, Math.floor(v)), 1_000_000_000)
      : 0;
  const currentStreak = clampStat(body.currentStreak);
  const totalPoints = clampStat(body.totalPoints);

  // Same semantics as the client's old calculation:
  // SUM(quantity) / row count of the collection list
  const cardStats = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(quantity), 0) AS total, COUNT(*) AS unique_count
     FROM cards WHERE user_id = ? AND list_type = 'collection'`
  ).bind(userId).first();
  const totalCards = (cardStats?.total as number) ?? 0;
  const uniqueCards = (cardStats?.unique_count as number) ?? 0;

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO rankings (user_id, nickname, icon, total_cards, unique_cards, current_streak, total_points, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       nickname = excluded.nickname,
       icon = excluded.icon,
       total_cards = excluded.total_cards,
       unique_cards = excluded.unique_cards,
       current_streak = excluded.current_streak,
       total_points = excluded.total_points,
       last_updated = excluded.last_updated`
  ).bind(
    userId, nickname, icon,
    totalCards, uniqueCards, currentStreak, totalPoints,
    now
  ).run();
  return c.json({ success: true });
});

// Profiles PUT needs auth
app.put('/api/profiles', authMiddleware, async (c) => {
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
  ).bind(
    userId,
    body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : 0,
    body.displayName || 'Anonymous',
    body.shareToken || null,
    now
  ).run();
  return c.json({ success: true });
});

// Mount route modules
app.route('/api/cards', cards);
app.route('/api/sync', sync);
app.route('/api/tags', tags);
app.route('/api/aliases', aliases);
app.route('/api/gamification', gamification);
app.route('/api/bookmarks', bookmarks);
app.route('/api/decks', decks);
app.route('/api/community', community);
app.route('/api/account', account);
app.route('/api/supplies', supplies);
app.route('/api/shares', shares);

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
