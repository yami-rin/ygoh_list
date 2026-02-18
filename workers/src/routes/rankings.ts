import { Hono } from 'hono';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const rankings = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/rankings — public, no auth required (handled in index.ts)
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

// PUT /api/rankings — update own ranking (auth required)
rankings.put('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    nickname?: string;
    icon?: string;
    totalCards?: number;
    uniqueCards?: number;
    currentStreak?: number;
    totalPoints?: number;
  }>();

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO rankings (user_id, nickname, icon, total_cards, unique_cards, current_streak, total_points, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       nickname = COALESCE(excluded.nickname, rankings.nickname),
       icon = COALESCE(excluded.icon, rankings.icon),
       total_cards = COALESCE(excluded.total_cards, rankings.total_cards),
       unique_cards = COALESCE(excluded.unique_cards, rankings.unique_cards),
       current_streak = COALESCE(excluded.current_streak, rankings.current_streak),
       total_points = COALESCE(excluded.total_points, rankings.total_points),
       last_updated = excluded.last_updated`
  )
    .bind(
      userId,
      body.nickname ?? '',
      body.icon ?? '👤',
      body.totalCards ?? 0,
      body.uniqueCards ?? 0,
      body.currentStreak ?? 0,
      body.totalPoints ?? 0,
      now
    )
    .run();

  return c.json({ success: true });
});

export { rankings };
