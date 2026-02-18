import { Hono } from 'hono';
import { rowToCard, rowToBookmark } from '../utils/fields';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const sync = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// GET /api/sync/metadata
sync.get('/metadata', async (c) => {
  const userId = c.get('userId');

  const meta = await c.env.DB.prepare(
    'SELECT updated_at, deleted_ids FROM sync_metadata WHERE user_id = ?'
  )
    .bind(userId)
    .first();

  if (!meta) {
    return c.json({ updatedAt: 0, deletedIds: [] });
  }

  return c.json({
    updatedAt: meta.updated_at as number,
    deletedIds: JSON.parse((meta.deleted_ids as string) || '[]'),
  });
});

// POST /api/sync/delta — unified delta sync (1 request for all changes)
sync.post('/delta', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ cachedAt: number }>();
  const cachedAt = body.cachedAt || 0;

  // Get sync metadata
  const meta = await c.env.DB.prepare(
    'SELECT updated_at, deleted_ids FROM sync_metadata WHERE user_id = ?'
  )
    .bind(userId)
    .first();

  const serverUpdatedAt = meta ? (meta.updated_at as number) : 0;
  const deletedIds: Array<{ id: string; col: string; at: number }> = meta
    ? JSON.parse((meta.deleted_ids as string) || '[]')
    : [];

  // If nothing changed since cachedAt, return empty
  if (serverUpdatedAt <= cachedAt && deletedIds.every(d => d.at <= cachedAt)) {
    return c.json({
      updatedAt: serverUpdatedAt,
      changes: { collection: [], wishlist: [], bookmarks: [] },
      deletions: [],
    });
  }

  // Fetch changes since cachedAt for each collection type
  const [collectionRows, wishlistRows, bookmarkRows] = await Promise.all([
    c.env.DB.prepare(
      'SELECT * FROM cards WHERE user_id = ? AND list_type = ? AND updated_at > ?'
    )
      .bind(userId, 'collection', cachedAt)
      .all(),
    c.env.DB.prepare(
      'SELECT * FROM cards WHERE user_id = ? AND list_type = ? AND updated_at > ?'
    )
      .bind(userId, 'wishlist', cachedAt)
      .all(),
    c.env.DB.prepare(
      'SELECT * FROM bookmarks WHERE user_id = ? AND updated_at > ?'
    )
      .bind(userId, cachedAt)
      .all(),
  ]);

  // Filter deletions since cachedAt
  const recentDeletions = deletedIds.filter(d => d.at > cachedAt);

  return c.json({
    updatedAt: serverUpdatedAt,
    changes: {
      collection: collectionRows.results.map(rowToCard),
      wishlist: wishlistRows.results.map(rowToCard),
      bookmarks: bookmarkRows.results.map(rowToBookmark),
    },
    deletions: recentDeletions,
  });
});

export { sync };
