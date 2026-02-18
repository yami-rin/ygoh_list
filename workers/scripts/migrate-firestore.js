/**
 * Firestore → D1 Migration Script
 *
 * Prerequisites:
 *   1. npm install firebase-admin
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account key
 *   3. Create D1 database and apply migrations first:
 *      wrangler d1 execute card-manager-db --file=./migrations/0001_initial.sql
 *
 * Usage:
 *   node scripts/migrate-firestore.js > migration.sql
 *   wrangler d1 execute card-manager-db --remote --file=./migration.sql
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'ygoh-9bcf6',
});

const db = admin.firestore();

function escSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

/** Convert any Firestore timestamp value to milliseconds (integer) */
function toMillis(val) {
  if (val === null || val === undefined) return Date.now();
  // Firestore Timestamp object
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  // Already a number
  if (typeof val === 'number') return val;
  // ISO string or other string date
  if (typeof val === 'string') {
    const ms = new Date(val).getTime();
    return isNaN(ms) ? Date.now() : ms;
  }
  return Date.now();
}

/** Convert timestamp to escaped SQL string or NULL */
function toSQLTimestamp(val) {
  if (val === null || val === undefined) return 'NULL';
  if (val && typeof val.toDate === 'function') return escSQL(val.toDate().toISOString());
  if (typeof val === 'string') return escSQL(val);
  if (typeof val === 'number') return escSQL(new Date(val).toISOString());
  return 'NULL';
}

async function migrateUser(userId) {
  const stmts = [];

  // Migrate cards (collection)
  const cardsSnap = await db.collection('users').doc(userId).collection('cards').get();
  for (const doc of cardsSnap.docs) {
    const d = doc.data();
    const updatedAt = toMillis(d.updatedAt);
    const createdAt = toMillis(d.createdAt || d.updatedAt);
    stmts.push(
      `INSERT INTO cards (id, user_id, list_type, name, set_code, rarity, quantity, tags, selected_ciid, linked_details, updated_at, created_at) VALUES (${escSQL(doc.id)}, ${escSQL(userId)}, 'collection', ${escSQL(d['名前'] || '')}, ${escSQL(d['型番'] || '')}, ${escSQL(d['レアリティ'] || '')}, ${d['枚数'] || 1}, ${escSQL(JSON.stringify(d.tags || []))}, ${escSQL(d.selectedCiid || null)}, ${d.linkedDetails ? escSQL(JSON.stringify(d.linkedDetails)) : 'NULL'}, ${updatedAt}, ${createdAt});`
    );
  }

  // Migrate wishlist
  const wishSnap = await db.collection('users').doc(userId).collection('wishlist').get();
  for (const doc of wishSnap.docs) {
    const d = doc.data();
    const updatedAt = toMillis(d.updatedAt);
    const createdAt = toMillis(d.createdAt || d.updatedAt);
    stmts.push(
      `INSERT INTO cards (id, user_id, list_type, name, set_code, rarity, quantity, tags, selected_ciid, linked_details, updated_at, created_at) VALUES (${escSQL(doc.id)}, ${escSQL(userId)}, 'wishlist', ${escSQL(d['名前'] || '')}, ${escSQL(d['型番'] || '')}, ${escSQL(d['レアリティ'] || '')}, ${d['枚数'] || 1}, ${escSQL(JSON.stringify(d.tags || []))}, ${escSQL(d.selectedCiid || null)}, ${d.linkedDetails ? escSQL(JSON.stringify(d.linkedDetails)) : 'NULL'}, ${updatedAt}, ${createdAt});`
    );
  }

  // Migrate bookmarks
  const bmSnap = await db.collection('users').doc(userId).collection('bookmarks').get();
  for (const doc of bmSnap.docs) {
    const d = doc.data();
    const updatedAt = toMillis(d.updatedAt);
    stmts.push(
      `INSERT INTO bookmarks (id, user_id, name, set_code, rarity, quantity, tags, selected_ciid, added_at, updated_at) VALUES (${escSQL(doc.id)}, ${escSQL(userId)}, ${escSQL(d['名前'] || '')}, ${escSQL(d['型番'] || '')}, ${escSQL(d['レアリティ'] || '')}, ${d['枚数'] || 1}, ${escSQL(JSON.stringify(d.tags || []))}, ${escSQL(d.selectedCiid || null)}, ${toSQLTimestamp(d.addedAt)}, ${updatedAt});`
    );
  }

  // Migrate decks
  const decksSnap = await db.collection('users').doc(userId).collection('decks').get();
  for (const doc of decksSnap.docs) {
    const d = doc.data();
    stmts.push(
      `INSERT INTO decks (id, user_id, name, memo, main_deck, extra_deck, side_deck, created_at, updated_at) VALUES (${escSQL(doc.id)}, ${escSQL(userId)}, ${escSQL(d.name || '無題のデッキ')}, ${escSQL(d.memo || '')}, ${escSQL(JSON.stringify(d.mainDeck || []))}, ${escSQL(JSON.stringify(d.extraDeck || []))}, ${escSQL(JSON.stringify(d.sideDeck || []))}, ${toSQLTimestamp(d.createdAt)}, ${toSQLTimestamp(d.updatedAt || new Date().toISOString())});`
    );
  }

  // Migrate tags
  const tagsSnap = await db.collection('users').doc(userId).collection('tags').get();
  for (const doc of tagsSnap.docs) {
    const d = doc.data();
    stmts.push(
      `INSERT INTO tags (id, user_id, name, sort_order) VALUES (${escSQL(doc.id)}, ${escSQL(userId)}, ${escSQL(d.name)}, ${d.order || 0});`
    );
  }

  // Migrate metadata
  const metaDoc = await db.collection('users').doc(userId).collection('metadata').doc('sync').get();
  if (metaDoc.exists) {
    const d = metaDoc.data();
    const updatedAt = toMillis(d.updatedAt);
    stmts.push(
      `INSERT INTO sync_metadata (user_id, updated_at, deleted_ids) VALUES (${escSQL(userId)}, ${updatedAt}, ${escSQL(JSON.stringify(d.deletedIds || []))});`
    );
  }

  return stmts;
}

async function migrateGlobalCollections() {
  const stmts = [];

  // Gamification
  const gamSnap = await db.collection('userGamification').get();
  for (const doc of gamSnap.docs) {
    stmts.push(
      `INSERT INTO user_gamification (user_id, data) VALUES (${escSQL(doc.id)}, ${escSQL(JSON.stringify(doc.data()))});`
    );
  }

  // Rankings
  const rankSnap = await db.collection('rankings').get();
  for (const doc of rankSnap.docs) {
    const d = doc.data();
    stmts.push(
      `INSERT INTO rankings (user_id, nickname, icon, total_cards, unique_cards, current_streak, total_points, last_updated) VALUES (${escSQL(doc.id)}, ${escSQL(d.nickname || '')}, ${escSQL(d.icon || '👤')}, ${d.totalCards || 0}, ${d.uniqueCards || 0}, ${d.currentStreak || 0}, ${d.totalPoints || 0}, ${toSQLTimestamp(d.lastUpdated)});`
    );
  }

  // Public profiles
  const profSnap = await db.collection('publicProfiles').get();
  for (const doc of profSnap.docs) {
    const d = doc.data();
    stmts.push(
      `INSERT INTO public_profiles (user_id, is_public, display_name, share_token, updated_at) VALUES (${escSQL(doc.id)}, ${d.isPublic ? 1 : 0}, ${escSQL(d.displayName || 'Anonymous')}, ${escSQL(d.shareToken || null)}, ${toSQLTimestamp(d.updatedAt)});`
    );
  }

  return stmts;
}

async function main() {
  console.error('Starting Firestore → D1 migration...');

  // Get all user IDs from the users collection
  const usersSnap = await db.collection('users').get();
  const userIds = usersSnap.docs.map(d => d.id);
  console.error(`Found ${userIds.length} users`);

  const allStmts = [];

  // Migrate per-user data
  for (const userId of userIds) {
    console.error(`Migrating user: ${userId}`);
    const stmts = await migrateUser(userId);
    allStmts.push(...stmts);
    console.error(`  → ${stmts.length} statements`);
  }

  // Migrate global collections
  console.error('Migrating global collections...');
  const globalStmts = await migrateGlobalCollections();
  allStmts.push(...globalStmts);
  console.error(`  → ${globalStmts.length} statements`);

  // Output all SQL to stdout (no BEGIN/COMMIT - D1 doesn't support them)
  for (const stmt of allStmts) {
    console.log(stmt);
  }

  console.error(`\nDone! Total: ${allStmts.length} statements`);
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
