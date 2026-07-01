-- Duel simulator shares: store board/replay blobs so share URLs can be short (id only)
CREATE TABLE IF NOT EXISTS duel_shares (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,          -- 'board' | 'replay'
  data       TEXT NOT NULL,          -- LZString-compressed payload (the part after #b= / #r=)
  user_id    TEXT,                   -- creator (nullable)
  created_at INTEGER NOT NULL
);
