/**
 * Field mapping between Japanese Firestore field names and English DB column names.
 * Firestore uses Japanese keys (名前, 型番, レアリティ, 枚数).
 * D1 uses English columns (name, set_code, rarity, quantity).
 */

/** Convert a card row from D1 (English) to the API response format (Japanese field names preserved for frontend compatibility) */
export function rowToCard(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    '名前': row.name as string,
    '型番': row.set_code as string,
    'レアリティ': row.rarity as string,
    '枚数': row.quantity as number,
    tags: JSON.parse((row.tags as string) || '[]'),
    selectedCiid: row.selected_ciid as string | null,
    linkedDetails: row.linked_details ? JSON.parse(row.linked_details as string) : null,
    updatedAt: row.updated_at as number,
    createdAt: row.created_at as number,
  };
}

/** Convert a bookmark row from D1 to API response format */
export function rowToBookmark(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    '名前': row.name as string,
    '型番': row.set_code as string,
    'レアリティ': row.rarity as string,
    '枚数': row.quantity as number,
    tags: JSON.parse((row.tags as string) || '[]'),
    selectedCiid: row.selected_ciid as string | null,
    addedAt: row.added_at as string | null,
    updatedAt: row.updated_at as number,
  };
}

/** Convert a deck row from D1 to API response format */
export function rowToDeck(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    memo: row.memo as string,
    mainDeck: JSON.parse((row.main_deck as string) || '[]'),
    extraDeck: JSON.parse((row.extra_deck as string) || '[]'),
    sideDeck: JSON.parse((row.side_deck as string) || '[]'),
    createdAt: row.created_at as string | null,
    updatedAt: row.updated_at as string,
  };
}

/** Convert a tag row from D1 to API response format */
export function rowToTag(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    order: row.sort_order as number,
  };
}

/** Convert an alias row from D1 to API response format */
export function rowToAlias(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    alias: row.alias as string,
    cardName: row.card_name as string,
    createdAt: row.created_at as number,
  };
}
