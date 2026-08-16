import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8');

const collection = read('js/pages/card-list/collection.js');
const apiClient = read('api-client.js');
const gallery = read('js/gallery/main.js');
const workerIndex = read('workers/src/index.ts');
const vipRoute = read('workers/src/routes/vip.ts');
const vipMiddleware = read('workers/src/middleware/vip.ts');
const cardsRoute = read('workers/src/routes/cards.ts');
const migration = read('workers/migrations/0006_vip_memberships.sql');

const vipUiStart = collection.indexOf('VIP Membership System');
const vipUiEnd = collection.indexOf('VIP Features Button', vipUiStart);
assert.ok(vipUiStart >= 0 && vipUiEnd > vipUiStart, 'VIP UI block was not found');
const vipUiBlock = collection.slice(vipUiStart, vipUiEnd);

assert.doesNotMatch(vipUiBlock, /\b[0-9a-f]{64}\b/i, 'frontend must not contain serial hashes');
assert.doesNotMatch(vipUiBlock, /VALID_SERIAL_HASHES|sha256\s*\(|vip_membership|serial_attempts/,
    'frontend must not validate or self-assert VIP membership');
assert.match(vipUiBlock, /api\.getVipStatus\(\)/);
assert.match(vipUiBlock, /api\.activateVip\(serial\)/);
assert.match(vipUiBlock, /api\.deactivateVip\(\)/);
assert.doesNotMatch(gallery, /vip_membership/, 'gallery must not trust local VIP state');
assert.match(gallery, /api\.getVipStatus\(\)/);
assert.match(gallery, /\['localhost', '127\.0\.0\.1'\]\.includes\(location\.hostname\)/,
    'local test bypass must be restricted to loopback hosts');

assert.match(apiClient, /async getVipStatus\(\)/);
assert.match(apiClient, /async activateVip\(serial\)/);
assert.match(apiClient, /async deactivateVip\(\)/);
assert.match(apiClient, /err\.data = errorData/);

assert.match(workerIndex, /app\.use\('\/api\/vip\/\*', authMiddleware\)/);
assert.match(workerIndex, /app\.route\('\/api\/vip', vip\)/);
assert.match(vipRoute, /c\.env\.VIP_SERIAL_HASHES/);
assert.match(vipRoute, /vip_activation_attempts/);
assert.match(vipRoute, /VIP_MAX_DAILY_ATTEMPTS/);
assert.doesNotMatch(vipRoute, /\b[0-9a-f]{64}\b/i, 'worker source must not contain configured hashes');
assert.match(vipMiddleware, /vipMembershipMiddleware/);
assert.match(cardsRoute, /cards\.post\('\/batch-import', vipMembershipMiddleware/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS vip_memberships/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS vip_activation_attempts/);

console.log('VIP security contract: PASS');
