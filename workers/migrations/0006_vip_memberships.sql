CREATE TABLE IF NOT EXISTS vip_memberships (
    user_id TEXT PRIMARY KEY,
    activated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vip_activation_attempts (
    user_id TEXT NOT NULL,
    attempt_date TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, attempt_date)
);
