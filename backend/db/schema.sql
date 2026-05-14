-- CardScanner database schema
-- Run: psql $DATABASE_URL -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  is_public     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Cards (master catalog — created on first identification) ─────────────────

CREATE TABLE IF NOT EXISTS cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  team        TEXT,
  position    TEXT,
  year        INTEGER,
  set_name    TEXT,
  variant     TEXT,         -- Prizm, Refractor, Auto, Patch, Rookie, etc.
  card_number TEXT,
  sport       TEXT NOT NULL DEFAULT 'football',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cards_player_year_set ON cards (player_name, year, set_name);

-- ─── Collection Items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collection_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id            UUID REFERENCES cards(id),
  image_url          TEXT,
  condition          TEXT CHECK (condition IN ('Poor','Fair','Good','Very Good','Excellent','Near Mint','Mint','Gem Mint')),
  notes              TEXT,
  acquired_date      DATE,
  purchase_price     NUMERIC(10,2),
  for_sale           BOOLEAN DEFAULT FALSE,
  asking_price       NUMERIC(10,2),
  raw_identification JSONB,   -- full GPT-4o response stored for debugging
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS collection_items_user_id ON collection_items (user_id);
CREATE INDEX IF NOT EXISTS collection_items_card_id ON collection_items (card_id);

-- ─── Valuations (cached market prices) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS valuations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID NOT NULL REFERENCES cards(id),
  low_price  NUMERIC(10,2),
  mid_price  NUMERIC(10,2),
  high_price NUMERIC(10,2),
  source     TEXT DEFAULT 'ebay',
  sale_count INTEGER,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS valuations_card_id ON valuations (card_id);

-- ─── Social: Follows ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

-- ─── Posts (shares a collection item to the feed) ─────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_item_id UUID NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
  caption            TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_user_id    ON posts (user_id);
CREATE INDEX IF NOT EXISTS posts_created_at ON posts (created_at DESC);

-- ─── Likes ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ─── Comments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_post_id ON comments (post_id);

-- ─── Updated_at triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER collection_items_updated_at
  BEFORE UPDATE ON collection_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
