import { Hono } from 'hono';
import { generateId } from '../utils/id';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const supplies = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// The client compresses images to <=1200px JPEG before upload, so a legit
// data URL stays well under this; null means "clear the image" on PUT.
const MAX_IMAGE_DATA = 900_000;

type SupplyBody = {
  name?: unknown;
  description?: unknown;
  sealed?: unknown;
  tags?: unknown;
  imageData?: unknown;
};

function supplyValidationError(body: SupplyBody, requireName: boolean): string | null {
  if (requireName && (typeof body.name !== 'string' || !body.name.trim())) {
    return 'name is required';
  }
  if (body.name !== undefined &&
      (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200)) {
    return 'invalid name (max 200 chars)';
  }
  if (body.description !== undefined && body.description !== null &&
      (typeof body.description !== 'string' || body.description.length > 2000)) {
    return 'invalid description (max 2000 chars)';
  }
  if (body.tags !== undefined && body.tags !== null &&
      (!Array.isArray(body.tags) || body.tags.length > 50 ||
       body.tags.some(t => typeof t !== 'string' || t.length > 50))) {
    return 'invalid tags (max 50 string tags of 50 chars)';
  }
  if (body.imageData !== undefined && body.imageData !== null &&
      (typeof body.imageData !== 'string' || body.imageData.length > MAX_IMAGE_DATA)) {
    return 'invalid imageData (max ~900KB)';
  }
  return null;
}

function rowToSupply(row: Record<string, unknown>) {
  return {
    id:          row.id as string,
    name:        row.name as string,
    description: (row.description as string) || '',
    sealed:      !!(row.sealed as number),
    tags:        JSON.parse((row.tags as string) || '[]') as string[],
    imageData:   (row.image_data as string) || '',
    createdAt:   row.created_at as number,
    updatedAt:   row.updated_at as number,
  };
}

// GET /api/supplies
supplies.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM supplies WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return c.json({ supplies: rows.results.map(rowToSupply) });
});

// POST /api/supplies
supplies.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    name: string;
    description?: string;
    sealed?: boolean;
    tags?: string[];
    imageData?: string;
  }>().catch(() => null);
  if (!body) return c.json({ error: 'invalid JSON body' }, 400);
  const validationError = supplyValidationError(body, true);
  if (validationError) return c.json({ error: validationError }, 400);
  const id  = generateId();
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO supplies (id, user_id, name, description, sealed, tags, image_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, userId,
    body.name,
    body.description || '',
    body.sealed !== false ? 1 : 0,
    JSON.stringify(body.tags || []),
    body.imageData || '',
    now, now
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM supplies WHERE id = ?').bind(id).first();
  return c.json({ supply: rowToSupply(row!) }, 201);
});

// PUT /api/supplies/:id
supplies.put('/:id', async (c) => {
  const userId = c.get('userId');
  const id     = c.req.param('id');
  const body   = await c.req.json<{
    name?: string;
    description?: string;
    sealed?: boolean;
    tags?: string[];
    imageData?: string;
  }>().catch(() => null);
  if (!body) return c.json({ error: 'invalid JSON body' }, 400);
  const validationError = supplyValidationError(body, false);
  if (validationError) return c.json({ error: validationError }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM supplies WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const sets: string[]   = [];
  const values: unknown[] = [];
  if (body.name        !== undefined) { sets.push('name = ?');        values.push(body.name); }
  if (body.description !== undefined) { sets.push('description = ?'); values.push(body.description); }
  if (body.sealed      !== undefined) { sets.push('sealed = ?');      values.push(body.sealed ? 1 : 0); }
  if (body.tags        !== undefined) { sets.push('tags = ?');        values.push(JSON.stringify(body.tags ?? [])); }
  if (body.imageData   !== undefined) { sets.push('image_data = ?');  values.push(body.imageData); }

  sets.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  await c.env.DB.prepare(`UPDATE supplies SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values).run();

  const row = await c.env.DB.prepare('SELECT * FROM supplies WHERE id = ?').bind(id).first();
  return c.json({ supply: rowToSupply(row!) });
});

// DELETE /api/supplies/:id
supplies.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id     = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT id FROM supplies WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await c.env.DB.prepare('DELETE FROM supplies WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

export { supplies };
