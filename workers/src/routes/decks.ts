import { Hono } from 'hono';
import { generateId } from '../utils/id';
import { rowToDeck } from '../utils/fields';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const decks = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/decks
decks.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM decks WHERE user_id = ? ORDER BY updated_at DESC'
  )
    .bind(userId)
    .all();
  return c.json({ decks: rows.results.map(rowToDeck) });
});

// POST /api/decks
decks.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    name?: string;
    memo?: string;
    mainDeck?: unknown[];
    extraDeck?: unknown[];
    sideDeck?: unknown[];
  }>();

  const id = generateId();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO decks (id, user_id, name, memo, main_deck, extra_deck, side_deck, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, userId,
      body.name || '無題のデッキ',
      body.memo || '',
      JSON.stringify(body.mainDeck || []),
      JSON.stringify(body.extraDeck || []),
      JSON.stringify(body.sideDeck || []),
      now, now
    )
    .run();

  const inserted = await c.env.DB.prepare('SELECT * FROM decks WHERE id = ?').bind(id).first();
  return c.json({ deck: rowToDeck(inserted!) }, 201);
});

// PUT /api/decks/:id
decks.put('/:id', async (c) => {
  const userId = c.get('userId');
  const deckId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM decks WHERE id = ? AND user_id = ?'
  )
    .bind(deckId, userId)
    .first();
  if (!existing) return c.json({ error: 'Deck not found' }, 404);

  const sets: string[] = [];
  const values: unknown[] = [];

  if ('name' in body) { sets.push('name = ?'); values.push(body.name); }
  if ('memo' in body) { sets.push('memo = ?'); values.push(body.memo); }
  if ('mainDeck' in body) { sets.push('main_deck = ?'); values.push(JSON.stringify(body.mainDeck)); }
  if ('extraDeck' in body) { sets.push('extra_deck = ?'); values.push(JSON.stringify(body.extraDeck)); }
  if ('sideDeck' in body) { sets.push('side_deck = ?'); values.push(JSON.stringify(body.sideDeck)); }

  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(deckId);

  await c.env.DB.prepare(`UPDATE decks SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM decks WHERE id = ?').bind(deckId).first();
  return c.json({ deck: rowToDeck(updated!) });
});

// DELETE /api/decks/:id
decks.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const deckId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT id FROM decks WHERE id = ? AND user_id = ?'
  )
    .bind(deckId, userId)
    .first();
  if (!existing) return c.json({ error: 'Deck not found' }, 404);

  await c.env.DB.prepare('DELETE FROM decks WHERE id = ?').bind(deckId).run();
  return c.json({ success: true });
});

export { decks };
