import { Hono } from 'hono';
import {
  hashVipSerial,
  hasVipMembership,
  matchesVipSerialHash,
  parseVipSerialHashes,
  VIP_MAX_DAILY_ATTEMPTS,
  vipAttemptDate,
  type VipEnv,
} from '../middleware/vip';

const vip = new Hono<VipEnv>();

async function getAttemptCount(db: D1Database, userId: string, date: string): Promise<number> {
  const row = await db.prepare(
    `SELECT attempt_count AS attemptCount
     FROM vip_activation_attempts
     WHERE user_id = ? AND attempt_date = ?`
  ).bind(userId, date).first<{ attemptCount: number }>();
  return row?.attemptCount ?? 0;
}

vip.get('/status', async (c) => {
  const userId = c.get('userId');
  const date = vipAttemptDate();
  const [active, attemptCount] = await Promise.all([
    hasVipMembership(c.env.DB, userId),
    getAttemptCount(c.env.DB, userId, date),
  ]);

  return c.json({
    active,
    attemptsRemaining: Math.max(0, VIP_MAX_DAILY_ATTEMPTS - attemptCount),
  });
});

vip.post('/activate', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ serial?: unknown }>().catch(() => null);
  const serial = typeof body?.serial === 'string' ? body.serial.trim() : '';
  if (!serial || serial.length > 128) {
    return c.json({ error: 'Invalid serial number' }, 400);
  }

  const validHashes = parseVipSerialHashes(c.env.VIP_SERIAL_HASHES);
  if (validHashes.length === 0) {
    return c.json({ error: 'VIP activation is unavailable' }, 503);
  }

  const date = vipAttemptDate();
  const currentAttempts = await getAttemptCount(c.env.DB, userId, date);
  if (currentAttempts >= VIP_MAX_DAILY_ATTEMPTS) {
    return c.json({
      error: 'Daily activation attempt limit reached',
      attemptsRemaining: 0,
    }, 429);
  }

  const candidateHash = await hashVipSerial(serial);
  if (!matchesVipSerialHash(candidateHash, validHashes)) {
    const attempt = await c.env.DB.prepare(
      `INSERT INTO vip_activation_attempts (user_id, attempt_date, attempt_count)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, attempt_date)
       DO UPDATE SET attempt_count = attempt_count + 1
       RETURNING attempt_count AS attemptCount`
    ).bind(userId, date).first<{ attemptCount: number }>();
    const attemptCount = attempt?.attemptCount ?? currentAttempts + 1;
    return c.json({
      error: 'Invalid serial number',
      attemptsRemaining: Math.max(0, VIP_MAX_DAILY_ATTEMPTS - attemptCount),
    }, 400);
  }

  const activatedAt = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO vip_memberships (user_id, activated_at)
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET activated_at = excluded.activated_at`
    ).bind(userId, activatedAt),
    c.env.DB.prepare(
      'DELETE FROM vip_activation_attempts WHERE user_id = ?'
    ).bind(userId),
  ]);

  return c.json({
    active: true,
    activatedAt,
    attemptsRemaining: VIP_MAX_DAILY_ATTEMPTS,
  });
});

vip.delete('/', async (c) => {
  const userId = c.get('userId');
  await c.env.DB.prepare(
    'DELETE FROM vip_memberships WHERE user_id = ?'
  ).bind(userId).run();
  return c.json({ active: false });
});

export { vip };
