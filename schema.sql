CREATE TABLE IF NOT EXISTS chats (
  chat_id INTEGER PRIMARY KEY,
  username TEXT,
  title TEXT,
  kind TEXT,
  phash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
