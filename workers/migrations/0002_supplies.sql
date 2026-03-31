-- サプライ管理テーブル
CREATE TABLE IF NOT EXISTS supplies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    sealed INTEGER NOT NULL DEFAULT 1,
    tags TEXT DEFAULT '[]',
    image_data TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supplies_user ON supplies(user_id);
CREATE INDEX IF NOT EXISTS idx_supplies_user_updated ON supplies(user_id, updated_at);
