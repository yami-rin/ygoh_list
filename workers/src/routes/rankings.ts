import { Hono } from 'hono';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const rankings = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/rankings — public, no auth required
rankings.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM rankings ORDER BY total_cards DESC'
  )
    .all();

  const results = rows.results.map(row => ({
    uid: row.user_id as string,
    nickname: row.nickname as string,
    icon: row.icon as string,
    totalCards: row.total_cards as number,
    uniqueCards: row.unique_cards as number,
    currentStreak: row.current_streak as number,
    totalPoints: row.total_points as number,
    lastUpdated: row.last_updated as string,
  }));

  return c.json({ rankings: results });
});

// PUT is handled in index.ts with auth middleware

export { rankings };
