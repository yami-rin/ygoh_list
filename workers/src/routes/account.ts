import { Hono } from 'hono';

type Bindings = { DB: D1Database; FIREBASE_PROJECT_ID: string };

const account = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// DELETE /api/account — delete all user data
account.delete('/', async (c) => {
  const userId = c.get('userId');

  // Delete all user data across all tables
  const stmts = [
    c.env.DB.prepare('DELETE FROM cards WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM bookmarks WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM decks WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM tags WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM sync_metadata WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM user_gamification WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM rankings WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM public_profiles WHERE user_id = ?').bind(userId),
  ];

  await c.env.DB.batch(stmts);

  return c.json({ success: true, message: 'All user data deleted' });
});

export { account };
