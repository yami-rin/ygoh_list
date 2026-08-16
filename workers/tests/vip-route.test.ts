import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { hashVipSerial } from '../src/middleware/vip';
import { vip } from '../src/routes/vip';

type StatementAction = () => Promise<unknown>;

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly db: FakeDb,
    private readonly sql: string
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes('FROM vip_memberships')) {
      return (this.db.memberships.has(String(this.values[0])) ? { active: 1 } : null) as T | null;
    }
    if (this.sql.includes('FROM vip_activation_attempts')) {
      const key = `${this.values[0]}:${this.values[1]}`;
      const count = this.db.attempts.get(key);
      return (count === undefined ? null : { attemptCount: count }) as T | null;
    }
    if (this.sql.includes('INSERT INTO vip_activation_attempts')) {
      const key = `${this.values[0]}:${this.values[1]}`;
      const count = (this.db.attempts.get(key) ?? 0) + 1;
      this.db.attempts.set(key, count);
      return { attemptCount: count } as T;
    }
    throw new Error(`Unsupported first SQL: ${this.sql}`);
  }

  async run() {
    if (this.sql.includes('INSERT INTO vip_memberships')) {
      this.db.memberships.add(String(this.values[0]));
    } else if (this.sql.includes('DELETE FROM vip_memberships')) {
      this.db.memberships.delete(String(this.values[0]));
    } else if (this.sql.includes('DELETE FROM vip_activation_attempts')) {
      const prefix = `${this.values[0]}:`;
      for (const key of this.db.attempts.keys()) {
        if (key.startsWith(prefix)) this.db.attempts.delete(key);
      }
    } else {
      throw new Error(`Unsupported run SQL: ${this.sql}`);
    }
    return { success: true };
  }
}

class FakeDb {
  readonly memberships = new Set<string>();
  readonly attempts = new Map<string, number>();

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  async batch(statements: Array<{ run: StatementAction }>) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

const testSerial = 'test-only-vip-serial';
const testHash = await hashVipSerial(testSerial);
const db = new FakeDb();
const env = {
  DB: db as unknown as D1Database,
  FIREBASE_PROJECT_ID: 'test-project',
  VIP_SERIAL_HASHES: testHash,
};

const app = new Hono();
app.use('*', async (c, next) => {
  c.set('userId', 'test-user');
  await next();
});
app.route('/api/vip', vip);

let response = await app.request('/api/vip/status', undefined, env);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { active: false, attemptsRemaining: 3 });

for (const remaining of [2, 1, 0]) {
  response = await app.request('/api/vip/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial: 'invalid-test-value' }),
  }, env);
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { attemptsRemaining: number }).attemptsRemaining, remaining);
}

response = await app.request('/api/vip/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ serial: testSerial }),
}, env);
assert.equal(response.status, 429, 'daily limit must be enforced by the server');

db.attempts.clear();
response = await app.request('/api/vip/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ serial: testSerial }),
}, env);
assert.equal(response.status, 200);
assert.equal((await response.json() as { active: boolean }).active, true);

response = await app.request('/api/vip/status', undefined, env);
assert.deepEqual(await response.json(), { active: true, attemptsRemaining: 3 });

response = await app.request('/api/vip', { method: 'DELETE' }, env);
assert.equal(response.status, 200);
response = await app.request('/api/vip/status', undefined, env);
assert.deepEqual(await response.json(), { active: false, attemptsRemaining: 3 });

const unconfiguredEnv = { ...env, VIP_SERIAL_HASHES: '' };
response = await app.request('/api/vip/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ serial: testSerial }),
}, unconfiguredEnv);
assert.equal(response.status, 503, 'missing Worker secret must fail closed');

console.log('VIP route behavior: PASS');
