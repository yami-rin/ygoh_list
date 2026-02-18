CREATE TABLE IF NOT EXISTS card_aliases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    alias TEXT NOT NULL,
    card_name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_aliases_user ON card_aliases(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aliases_user_alias ON card_aliases(user_id, alias);
