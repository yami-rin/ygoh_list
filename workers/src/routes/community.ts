import { Hono } from 'hono';
import { rowToCard, rowToDeck } from '../utils/fields';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const community = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/community/:userId/cards — view another user's collection (if public)
community.get('/:userId/cards', async (c) => {
  const targetUserId = c.req.param('userId');

  // Verify user is public
  const profile = await c.env.DB.prepare(
    'SELECT is_public FROM public_profiles WHERE user_id = ?'
  )
    .bind(targetUserId)
    .first();

  if (!profile || !(profile.is_public as number)) {
    return c.json({ error: 'Profile is private' }, 403);
  }

  const rows = await c.env.DB.prepare(
    'SELECT * FROM cards WHERE user_id = ? AND list_type = ?'
  )
    .bind(targetUserId, 'collection')
    .all();

  return c.json({ cards: rows.results.map(rowToCard) });
});

// GET /api/community/:userId/decks — view another user's decks (if public)
community.get('/:userId/decks', async (c) => {
  const targetUserId = c.req.param('userId');

  // Verify user is public
  const profile = await c.env.DB.prepare(
    'SELECT is_public FROM public_profiles WHERE user_id = ?'
  )
    .bind(targetUserId)
    .first();

  if (!profile || !(profile.is_public as number)) {
    return c.json({ error: 'Profile is private' }, 403);
  }

  const rows = await c.env.DB.prepare(
    'SELECT * FROM decks WHERE user_id = ? ORDER BY updated_at DESC'
  )
    .bind(targetUserId)
    .all();

  return c.json({ decks: rows.results.map(rowToDeck) });
});

export { community };
