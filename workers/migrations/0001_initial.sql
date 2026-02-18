-- カードコレクション + ウィッシュリスト（統合テーブル）
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    list_type TEXT NOT NULL DEFAULT 'collection',
    name TEXT NOT NULL,
    set_code TEXT DEFAULT '',
    rarity TEXT DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    tags TEXT DEFAULT '[]',
    selected_ciid TEXT,
    linked_details TEXT,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_cards_user_list ON cards(user_id, list_type);
CREATE INDEX IF NOT EXISTS idx_cards_user_updated ON cards(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_cards_dedup ON cards(user_id, list_type, name, set_code, rarity);

-- ブックマーク
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    set_code TEXT DEFAULT '',
    rarity TEXT DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    tags TEXT DEFAULT '[]',
    selected_ciid TEXT,
    added_at TEXT,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_updated ON bookmarks(user_id, updated_at);

-- デッキ
CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '無題のデッキ',
    memo TEXT DEFAULT '',
    main_deck TEXT DEFAULT '[]',
    extra_deck TEXT DEFAULT '[]',
    side_deck TEXT DEFAULT '[]',
    created_at TEXT,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);

-- タグ
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

-- 同期メタデータ（デルタ同期用）
CREATE TABLE IF NOT EXISTS sync_metadata (
    user_id TEXT PRIMARY KEY,
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted_ids TEXT DEFAULT '[]'
);

-- ゲーミフィケーション（JSONブロブ）
CREATE TABLE IF NOT EXISTS user_gamification (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}'
);

-- ランキング
CREATE TABLE IF NOT EXISTS rankings (
    user_id TEXT PRIMARY KEY,
    nickname TEXT DEFAULT '',
    icon TEXT DEFAULT '👤',
    total_cards INTEGER DEFAULT 0,
    unique_cards INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    last_updated TEXT
);
CREATE INDEX IF NOT EXISTS idx_rankings_total ON rankings(total_cards DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_points ON rankings(total_points DESC);

-- 公開プロフィール
CREATE TABLE IF NOT EXISTS public_profiles (
    user_id TEXT PRIMARY KEY,
    is_public INTEGER NOT NULL DEFAULT 0,
    display_name TEXT DEFAULT 'Anonymous',
    share_token TEXT,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_profiles_public ON public_profiles(is_public, updated_at DESC);
