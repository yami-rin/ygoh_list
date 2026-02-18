import { Hono } from 'hono';
import { generateId } from '../utils/id';
import { rowToTag } from '../utils/fields';
import { updateSyncMetadata } from './cards';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const tags = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/tags
tags.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM tags WHERE user_id = ? ORDER BY sort_order ASC'
  )
    .bind(userId)
    .all();
  return c.json({ tags: rows.results.map(rowToTag) });
});

// POST /api/tags
tags.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ name: string; order?: number }>();
  const id = generateId();

  // Get max order if not provided
  let order = body.order;
  if (order === undefined) {
    const maxRow = await c.env.DB.prepare(
      'SELECT MAX(sort_order) as max_order FROM tags WHERE user_id = ?'
    )
      .bind(userId)
      .first();
    order = ((maxRow?.max_order as number) || 0) + 1;
  }

  await c.env.DB.prepare(
    'INSERT INTO tags (id, user_id, name, sort_order) VALUES (?, ?, ?, ?)'
  )
    .bind(id, userId, body.name, order)
    .run();

  return c.json({ tag: { id, name: body.name, order } }, 201);
});

// PUT /api/tags/:id
tags.put('/:id', async (c) => {
  const userId = c.get('userId');
  const tagId = c.req.param('id');
  const body = await c.req.json<{ name?: string; order?: number }>();

  // Verify ownership and get old name
  const existing = await c.env.DB.prepare(
    'SELECT id, name FROM tags WHERE id = ? AND user_id = ?'
  )
    .bind(tagId, userId)
    .first();
  if (!existing) return c.json({ error: 'Tag not found' }, 404);

  const oldName = existing.name as string;
  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); values.push(body.name); }
  if (body.order !== undefined) { sets.push('sort_order = ?'); values.push(body.order); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(tagId);
  await c.env.DB.prepare(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  // If tag name changed, update all cards referencing the old name
  if (body.name !== undefined && body.name !== oldName) {
    const now = Date.now();
    await renameTagInCards(c.env.DB, userId, oldName, body.name, now);
    await updateSyncMetadata(c.env.DB, userId, now);
  }

  return c.json({ success: true });
});

// DELETE /api/tags/:id — also remove tag from all cards
tags.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const tagId = c.req.param('id');

  // Get tag name before deleting
  const existing = await c.env.DB.prepare(
    'SELECT id, name FROM tags WHERE id = ? AND user_id = ?'
  )
    .bind(tagId, userId)
    .first();
  if (!existing) return c.json({ error: 'Tag not found' }, 404);

  const tagName = existing.name as string;

  // Delete the tag
  await c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(tagId).run();

  // Remove this tag from all cards
  const now = Date.now();
  await removeTagFromCards(c.env.DB, userId, tagName, now);
  await updateSyncMetadata(c.env.DB, userId, now);

  return c.json({ success: true });
});

// PUT /api/tags/reorder
tags.put('/reorder', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ order: Array<{ id: string; order: number }> }>();

  const stmts = body.order.map(item =>
    c.env.DB.prepare('UPDATE tags SET sort_order = ? WHERE id = ? AND user_id = ?')
      .bind(item.order, item.id, userId)
  );

  if (stmts.length > 0) {
    await c.env.DB.batch(stmts);
  }

  return c.json({ success: true });
});

// Helper: rename a tag across all card collections
async function renameTagInCards(db: D1Database, userId: string, oldName: string, newName: string, now: number) {
  // Find all cards (collection + wishlist) with this tag
  const rows = await db.prepare(
    `SELECT id, tags FROM cards WHERE user_id = ? AND tags LIKE ?`
  )
    .bind(userId, `%${JSON.stringify(oldName).slice(1, -1)}%`)
    .all();

  const stmts: D1PreparedStatement[] = [];
  for (const row of rows.results) {
    const tags: string[] = JSON.parse((row.tags as string) || '[]');
    if (tags.includes(oldName)) {
      const newTags = tags.map(t => (t === oldName ? newName : t));
      stmts.push(
        db.prepare('UPDATE cards SET tags = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(newTags), now, row.id as string)
      );
    }
  }

  // Also update bookmarks
  const bmRows = await db.prepare(
    `SELECT id, tags FROM bookmarks WHERE user_id = ? AND tags LIKE ?`
  )
    .bind(userId, `%${JSON.stringify(oldName).slice(1, -1)}%`)
    .all();

  for (const row of bmRows.results) {
    const tags: string[] = JSON.parse((row.tags as string) || '[]');
    if (tags.includes(oldName)) {
      const newTags = tags.map(t => (t === oldName ? newName : t));
      stmts.push(
        db.prepare('UPDATE bookmarks SET tags = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(newTags), now, row.id as string)
      );
    }
  }

  if (stmts.length > 0) {
    await db.batch(stmts);
  }
}

// Helper: remove a tag from all cards
async function removeTagFromCards(db: D1Database, userId: string, tagName: string, now: number) {
  const rows = await db.prepare(
    `SELECT id, tags FROM cards WHERE user_id = ? AND tags LIKE ?`
  )
    .bind(userId, `%${JSON.stringify(tagName).slice(1, -1)}%`)
    .all();

  const stmts: D1PreparedStatement[] = [];
  for (const row of rows.results) {
    const tags: string[] = JSON.parse((row.tags as string) || '[]');
    if (tags.includes(tagName)) {
      const newTags = tags.filter(t => t !== tagName);
      stmts.push(
        db.prepare('UPDATE cards SET tags = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(newTags), now, row.id as string)
      );
    }
  }

  // Also remove from bookmarks
  const bmRows = await db.prepare(
    `SELECT id, tags FROM bookmarks WHERE user_id = ? AND tags LIKE ?`
  )
    .bind(userId, `%${JSON.stringify(tagName).slice(1, -1)}%`)
    .all();

  for (const row of bmRows.results) {
    const tags: string[] = JSON.parse((row.tags as string) || '[]');
    if (tags.includes(tagName)) {
      const newTags = tags.filter(t => t !== tagName);
      stmts.push(
        db.prepare('UPDATE bookmarks SET tags = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(newTags), now, row.id as string)
      );
    }
  }

  if (stmts.length > 0) {
    await db.batch(stmts);
  }
}

export { tags };
