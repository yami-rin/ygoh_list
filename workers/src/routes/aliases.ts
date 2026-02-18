import { Hono } from 'hono';
import { generateId } from '../utils/id';
import { rowToAlias } from '../utils/fields';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const aliases = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/aliases
aliases.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM card_aliases WHERE user_id = ? ORDER BY created_at ASC'
  )
    .bind(userId)
    .all();
  return c.json({ aliases: rows.results.map(rowToAlias) });
});

// POST /api/aliases
aliases.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ alias: string; cardName: string }>();

  if (!body.alias || !body.cardName) {
    return c.json({ error: 'alias and cardName are required' }, 400);
  }

  const id = generateId();

  try {
    await c.env.DB.prepare(
      'INSERT INTO card_aliases (id, user_id, alias, card_name) VALUES (?, ?, ?, ?)'
    )
      .bind(id, userId, body.alias, body.cardName)
      .run();
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
      return c.json({ error: 'This alias already exists' }, 409);
    }
    throw e;
  }

  return c.json({ alias: { id, alias: body.alias, cardName: body.cardName } }, 201);
});

// DELETE /api/aliases/:id
aliases.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const aliasId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT id FROM card_aliases WHERE id = ? AND user_id = ?'
  )
    .bind(aliasId, userId)
    .first();
  if (!existing) return c.json({ error: 'Alias not found' }, 404);

  await c.env.DB.prepare('DELETE FROM card_aliases WHERE id = ?').bind(aliasId).run();

  return c.json({ success: true });
});

export { aliases };
