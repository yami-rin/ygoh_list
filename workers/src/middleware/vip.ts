import type { MiddlewareHandler } from 'hono';

export const VIP_MAX_DAILY_ATTEMPTS = 3;

export type VipEnv = {
  Bindings: {
    DB: D1Database;
    FIREBASE_PROJECT_ID: string;
    VIP_SERIAL_HASHES: string;
  };
  Variables: { userId: string };
};

export function vipAttemptDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function parseVipSerialHashes(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map(hash => hash.trim().toLowerCase())
    .filter(hash => /^[0-9a-f]{64}$/.test(hash));
}

export async function hashVipSerial(serial: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serial)
  );
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export function matchesVipSerialHash(candidate: string, validHashes: string[]): boolean {
  let matched = 0;
  for (const validHash of validHashes) {
    let difference = candidate.length ^ validHash.length;
    const length = Math.max(candidate.length, validHash.length);
    for (let i = 0; i < length; i++) {
      difference |= (candidate.charCodeAt(i) || 0) ^ (validHash.charCodeAt(i) || 0);
    }
    matched |= Number(difference === 0);
  }
  return matched === 1;
}

export async function hasVipMembership(db: D1Database, userId: string): Promise<boolean> {
  const membership = await db.prepare(
    'SELECT 1 AS active FROM vip_memberships WHERE user_id = ?'
  ).bind(userId).first();
  return !!membership;
}

export const vipMembershipMiddleware: MiddlewareHandler<VipEnv> = async (c, next) => {
  const userId = c.get('userId');
  if (!(await hasVipMembership(c.env.DB, userId))) {
    return c.json({ error: 'VIP membership required' }, 403);
  }
  await next();
};
