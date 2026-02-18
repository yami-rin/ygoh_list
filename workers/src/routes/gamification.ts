import { Hono } from 'hono';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const gamification = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/gamification
gamification.get('/', async (c) => {
  const userId = c.get('userId');
  const row = await c.env.DB.prepare(
    'SELECT data FROM user_gamification WHERE user_id = ?'
  )
    .bind(userId)
    .first();

  if (!row) return c.json({ data: {} });
  return c.json({ data: JSON.parse(row.data as string) });
});

// PUT /api/gamification — save (merge) gamification data
gamification.put('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<Record<string, unknown>>();

  // Get existing data and merge
  const existing = await c.env.DB.prepare(
    'SELECT data FROM user_gamification WHERE user_id = ?'
  )
    .bind(userId)
    .first();

  let merged: Record<string, unknown>;
  if (existing) {
    const current = JSON.parse(existing.data as string);
    merged = deepMerge(current, body);
  } else {
    merged = body;
  }

  await c.env.DB.prepare(
    `INSERT INTO user_gamification (user_id, data) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data`
  )
    .bind(userId, JSON.stringify(merged))
    .run();

  return c.json({ data: merged });
});

/** Deep merge two objects (second wins on conflicts) */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export { gamification };
