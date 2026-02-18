import { Hono } from 'hono';
import { generateId } from '../utils/id';
import { rowToBookmark } from '../utils/fields';
import { updateSyncMetadata, trackDeletion } from './cards';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const bookmarks = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/bookmarks?since=<ts>
bookmarks.get('/', async (c) => {
  const userId = c.get('userId');
  const since = c.req.query('since');

  if (since) {
    const ts = parseInt(since, 10);
    const rows = await c.env.DB.prepare(
      'SELECT * FROM bookmarks WHERE user_id = ? AND updated_at > ?'
    )
      .bind(userId, ts)
      .all();
    return c.json({ bookmarks: rows.results.map(rowToBookmark), partial: true });
  }

  const rows = await c.env.DB.prepare(
    'SELECT * FROM bookmarks WHERE user_id = ?'
  )
    .bind(userId)
    .all();
  return c.json({ bookmarks: rows.results.map(rowToBookmark) });
});

// POST /api/bookmarks
bookmarks.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    '名前': string;
    '型番'?: string;
    'レアリティ'?: string;
    '枚数'?: number;
    tags?: string[];
    selectedCiid?: string;
  }>();

  const id = generateId();
  const now = Date.now();
  const addedAt = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO bookmarks (id, user_id, name, set_code, rarity, quantity, tags, selected_ciid, added_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, userId,
      body['名前'],
      body['型番'] || '',
      body['レアリティ'] || '',
      body['枚数'] || 1,
      JSON.stringify(body.tags || []),
      body.selectedCiid || null,
      addedAt,
      now
    )
    .run();

  await updateSyncMetadata(c.env.DB, userId, now);

  const inserted = await c.env.DB.prepare('SELECT * FROM bookmarks WHERE id = ?').bind(id).first();
  return c.json({ bookmark: rowToBookmark(inserted!) }, 201);
});

// PUT /api/bookmarks/:id
bookmarks.put('/:id', async (c) => {
  const userId = c.get('userId');
  const bookmarkId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const now = Date.now();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM bookmarks WHERE id = ? AND user_id = ?'
  )
    .bind(bookmarkId, userId)
    .first();
  if (!existing) return c.json({ error: 'Bookmark not found' }, 404);

  const sets: string[] = [];
  const values: unknown[] = [];

  if ('名前' in body) { sets.push('name = ?'); values.push(body['名前']); }
  if ('型番' in body) { sets.push('set_code = ?'); values.push(body['型番']); }
  if ('レアリティ' in body) { sets.push('rarity = ?'); values.push(body['レアリティ']); }
  if ('枚数' in body) { sets.push('quantity = ?'); values.push(body['枚数']); }
  if ('tags' in body) { sets.push('tags = ?'); values.push(JSON.stringify(body.tags)); }
  if ('selectedCiid' in body) { sets.push('selected_ciid = ?'); values.push(body.selectedCiid); }

  sets.push('updated_at = ?');
  values.push(now);
  values.push(bookmarkId);

  await c.env.DB.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  await updateSyncMetadata(c.env.DB, userId, now);

  const updated = await c.env.DB.prepare('SELECT * FROM bookmarks WHERE id = ?').bind(bookmarkId).first();
  return c.json({ bookmark: rowToBookmark(updated!) });
});

// DELETE /api/bookmarks/:id
bookmarks.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const bookmarkId = c.req.param('id');
  const now = Date.now();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM bookmarks WHERE id = ? AND user_id = ?'
  )
    .bind(bookmarkId, userId)
    .first();
  if (!existing) return c.json({ error: 'Bookmark not found' }, 404);

  await c.env.DB.prepare('DELETE FROM bookmarks WHERE id = ?').bind(bookmarkId).run();
  await trackDeletion(c.env.DB, userId, bookmarkId, 'bookmarks', now);

  return c.json({ success: true });
});

export { bookmarks };
