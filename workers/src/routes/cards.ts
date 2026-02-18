import { Hono } from 'hono';
import { generateId } from '../utils/id';
import { rowToCard } from '../utils/fields';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const cards = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/cards?list_type=collection&since=<ts>
cards.get('/', async (c) => {
  const userId = c.get('userId');
  const listType = c.req.query('list_type') || 'collection';
  const since = c.req.query('since');

  if (since) {
    const ts = parseInt(since, 10);
    const rows = await c.env.DB.prepare(
      'SELECT * FROM cards WHERE user_id = ? AND list_type = ? AND updated_at > ?'
    )
      .bind(userId, listType, ts)
      .all();
    return c.json({ cards: rows.results.map(rowToCard), partial: true });
  }

  const rows = await c.env.DB.prepare(
    'SELECT * FROM cards WHERE user_id = ? AND list_type = ?'
  )
    .bind(userId, listType)
    .all();
  return c.json({ cards: rows.results.map(rowToCard) });
});

// POST /api/cards — add card with server-side dedup
cards.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    listType?: string;
    '名前': string;
    '型番'?: string;
    'レアリティ'?: string;
    '枚数'?: number;
    tags?: string[];
    selectedCiid?: string;
    linkedDetails?: Record<string, unknown>;
  }>();

  const listType = body.listType || 'collection';
  const name = body['名前'];
  const setCode = body['型番'] || '';
  const rarity = body['レアリティ'] || '';
  const quantity = body['枚数'] || 1;
  const tags = body.tags || [];
  const now = Date.now();

  // Check for duplicates: same name + set_code + rarity
  const existing = await c.env.DB.prepare(
    'SELECT id, quantity, tags FROM cards WHERE user_id = ? AND list_type = ? AND name = ? AND set_code = ? AND rarity = ?'
  )
    .bind(userId, listType, name, setCode, rarity)
    .all();

  // Find exact tag match
  for (const row of existing.results) {
    const existingTags: string[] = JSON.parse((row.tags as string) || '[]');
    if (tagsMatch(existingTags, tags)) {
      // Duplicate found — increment quantity
      await c.env.DB.prepare(
        'UPDATE cards SET quantity = quantity + ?, updated_at = ? WHERE id = ?'
      )
        .bind(quantity, now, row.id as string)
        .run();

      // Update sync metadata
      await updateSyncMetadata(c.env.DB, userId, now);

      const updated = await c.env.DB.prepare('SELECT * FROM cards WHERE id = ?')
        .bind(row.id as string)
        .first();
      return c.json({ card: rowToCard(updated!), merged: true });
    }
  }

  // No duplicate — insert new
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO cards (id, user_id, list_type, name, set_code, rarity, quantity, tags, selected_ciid, linked_details, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, userId, listType, name, setCode, rarity, quantity,
      JSON.stringify(tags),
      body.selectedCiid || null,
      body.linkedDetails ? JSON.stringify(body.linkedDetails) : null,
      now, now
    )
    .run();

  await updateSyncMetadata(c.env.DB, userId, now);

  const inserted = await c.env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first();
  return c.json({ card: rowToCard(inserted!), merged: false }, 201);
});

// PUT /api/cards/:id — update card
cards.put('/:id', async (c) => {
  const userId = c.get('userId');
  const cardId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const now = Date.now();

  // Verify ownership
  const existing = await c.env.DB.prepare(
    'SELECT id FROM cards WHERE id = ? AND user_id = ?'
  )
    .bind(cardId, userId)
    .first();
  if (!existing) return c.json({ error: 'Card not found' }, 404);

  // Build dynamic update
  const sets: string[] = [];
  const values: unknown[] = [];

  if ('名前' in body) { sets.push('name = ?'); values.push(body['名前']); }
  if ('型番' in body) { sets.push('set_code = ?'); values.push(body['型番']); }
  if ('レアリティ' in body) { sets.push('rarity = ?'); values.push(body['レアリティ']); }
  if ('枚数' in body) { sets.push('quantity = ?'); values.push(body['枚数']); }
  if ('tags' in body) { sets.push('tags = ?'); values.push(JSON.stringify(body.tags)); }
  if ('selectedCiid' in body) { sets.push('selected_ciid = ?'); values.push(body.selectedCiid); }
  if ('linkedDetails' in body) {
    sets.push('linked_details = ?');
    values.push(body.linkedDetails ? JSON.stringify(body.linkedDetails) : null);
  }

  sets.push('updated_at = ?');
  values.push(now);
  values.push(cardId);

  await c.env.DB.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  await updateSyncMetadata(c.env.DB, userId, now);

  const updated = await c.env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first();
  return c.json({ card: rowToCard(updated!) });
});

// DELETE /api/cards/:id
cards.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const cardId = c.req.param('id');
  const now = Date.now();

  // Verify ownership and get list_type for deletion tracking
  const existing = await c.env.DB.prepare(
    'SELECT id, list_type FROM cards WHERE id = ? AND user_id = ?'
  )
    .bind(cardId, userId)
    .first();
  if (!existing) return c.json({ error: 'Card not found' }, 404);

  await c.env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(cardId).run();

  // Track deletion in sync_metadata
  const colName = existing.list_type === 'wishlist' ? 'wishlist' : 'cards';
  await trackDeletion(c.env.DB, userId, cardId, colName, now);

  return c.json({ success: true });
});

// PUT /api/cards/:id/increment — atomic quantity increment
cards.put('/:id/increment', async (c) => {
  const userId = c.get('userId');
  const cardId = c.req.param('id');
  const body = await c.req.json<{ amount?: number }>();
  const amount = body.amount ?? 1;
  const now = Date.now();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM cards WHERE id = ? AND user_id = ?'
  )
    .bind(cardId, userId)
    .first();
  if (!existing) return c.json({ error: 'Card not found' }, 404);

  await c.env.DB.prepare(
    'UPDATE cards SET quantity = quantity + ?, updated_at = ? WHERE id = ?'
  )
    .bind(amount, now, cardId)
    .run();

  await updateSyncMetadata(c.env.DB, userId, now);

  const updated = await c.env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first();
  return c.json({ card: rowToCard(updated!) });
});

// POST /api/cards/batch-import — bulk import with dedup
cards.post('/batch-import', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    listType?: string;
    cards: Array<{
      '名前': string;
      '型番'?: string;
      'レアリティ'?: string;
      '枚数'?: number;
      tags?: string[];
      selectedCiid?: string;
      linkedDetails?: Record<string, unknown>;
    }>;
  }>();

  const listType = body.listType || 'collection';
  const now = Date.now();
  let added = 0;
  let merged = 0;

  // Process in batches (D1 batch limit considerations)
  const stmts: D1PreparedStatement[] = [];

  for (const card of body.cards) {
    const name = card['名前'];
    const setCode = card['型番'] || '';
    const rarity = card['レアリティ'] || '';
    const quantity = card['枚数'] || 1;
    const tags = card.tags || [];

    // Check for existing duplicates
    const existing = await c.env.DB.prepare(
      'SELECT id, quantity, tags FROM cards WHERE user_id = ? AND list_type = ? AND name = ? AND set_code = ? AND rarity = ?'
    )
      .bind(userId, listType, name, setCode, rarity)
      .all();

    let foundMatch = false;
    for (const row of existing.results) {
      const existingTags: string[] = JSON.parse((row.tags as string) || '[]');
      if (tagsMatch(existingTags, tags)) {
        stmts.push(
          c.env.DB.prepare(
            'UPDATE cards SET quantity = quantity + ?, updated_at = ? WHERE id = ?'
          ).bind(quantity, now, row.id as string)
        );
        merged++;
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      const id = generateId();
      stmts.push(
        c.env.DB.prepare(
          `INSERT INTO cards (id, user_id, list_type, name, set_code, rarity, quantity, tags, selected_ciid, linked_details, updated_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, userId, listType, name, setCode, rarity, quantity,
          JSON.stringify(tags),
          card.selectedCiid || null,
          card.linkedDetails ? JSON.stringify(card.linkedDetails) : null,
          now, now
        )
      );
      added++;
    }
  }

  // Execute all statements in a batch
  if (stmts.length > 0) {
    await c.env.DB.batch(stmts);
  }

  await updateSyncMetadata(c.env.DB, userId, now);

  return c.json({ added, merged, total: added + merged });
});

// Helper: compare two tag arrays (order-insensitive)
function tagsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted1 = [...a].sort();
  const sorted2 = [...b].sort();
  return sorted1.every((v, i) => v === sorted2[i]);
}

// Helper: update sync_metadata timestamp
async function updateSyncMetadata(db: D1Database, userId: string, now: number) {
  await db.prepare(
    `INSERT INTO sync_metadata (user_id, updated_at) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at`
  )
    .bind(userId, now)
    .run();
}

// Helper: track deletion in sync_metadata
async function trackDeletion(db: D1Database, userId: string, docId: string, col: string, now: number) {
  // Get current deleted_ids
  const meta = await db.prepare(
    'SELECT deleted_ids FROM sync_metadata WHERE user_id = ?'
  )
    .bind(userId)
    .first();

  let deletedIds: Array<{ id: string; col: string; at: number }> = [];
  if (meta) {
    deletedIds = JSON.parse((meta.deleted_ids as string) || '[]');
  }

  // Add new deletion
  deletedIds.push({ id: docId, col, at: now });

  // Clean up entries older than 7 days
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  deletedIds = deletedIds.filter(d => d.at > sevenDaysAgo);

  await db.prepare(
    `INSERT INTO sync_metadata (user_id, updated_at, deleted_ids) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at, deleted_ids = excluded.deleted_ids`
  )
    .bind(userId, now, JSON.stringify(deletedIds))
    .run();
}

export { cards, updateSyncMetadata, trackDeletion };
