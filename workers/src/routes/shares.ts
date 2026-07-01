import { Hono } from 'hono';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const shares = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// short, URL-friendly id (8 chars, base62 ~ 2e14 space)
function shortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, b => chars[b % chars.length]).join('');
}

// POST /api/shares  (auth) { kind: 'board'|'replay', data: string } -> { id }
shares.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ kind: string; data: string }>().catch(() => null);
  if (!body || typeof body.data !== 'string' || !body.data ||
      (body.kind !== 'board' && body.kind !== 'replay')) {
    return c.json({ error: 'invalid payload' }, 400);
  }
  if (body.data.length > 900_000) { // D1 row/value guard
    return c.json({ error: 'payload too large' }, 413);
  }
  // retry a couple times on the (astronomically unlikely) id collision
  let id = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    id = shortId();
    try {
      await c.env.DB.prepare(
        'INSERT INTO duel_shares (id, kind, data, user_id, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, body.kind, body.data, userId, Date.now()).run();
      return c.json({ id });
    } catch (e) {
      if (attempt === 2) throw e; // give up after 3 tries
    }
  }
  return c.json({ id });
});

export { shares };
