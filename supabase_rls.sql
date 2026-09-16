-- ============================================================
-- Enable RLS on every table
-- ============================================================
ALTER TABLE public.artist_daily_streams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists_with_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_likes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_comment_likes    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- artist_daily_streams — public read-only
-- ============================================================
DROP POLICY IF EXISTS "public_read_artist_streams" ON public.artist_daily_streams;
CREATE POLICY "public_read_artist_streams"
  ON public.artist_daily_streams
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- artists_with_history — public read-only
-- ============================================================
DROP POLICY IF EXISTS "public_read_artists" ON public.artists_with_history;
CREATE POLICY "public_read_artists"
  ON public.artists_with_history
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- users — NO direct client access to the raw table
-- Sensitive columns (password_hash, balance, email, tokens)
-- must never be exposed. Public profile data is served via
-- the public_profiles view below. All mutations go through
-- backend API routes using the service role.
-- ============================================================
-- (zero policies = implicit deny for all non-service roles)

-- ============================================================
-- positions — NO direct client access
-- All reads/writes go through authenticated API routes only.
-- ============================================================
-- (zero policies = implicit deny for all non-service roles)

-- ============================================================
-- comments — public read, no direct writes
-- ============================================================
DROP POLICY IF EXISTS "public_read_comments" ON public.comments;
CREATE POLICY "public_read_comments"
  ON public.comments
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- comment_likes — public read, no direct writes
-- ============================================================
DROP POLICY IF EXISTS "public_read_comment_likes" ON public.comment_likes;
CREATE POLICY "public_read_comment_likes"
  ON public.comment_likes
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- feed_posts — public read, no direct writes
-- ============================================================
DROP POLICY IF EXISTS "public_read_feed_posts" ON public.feed_posts;
CREATE POLICY "public_read_feed_posts"
  ON public.feed_posts
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- feed_post_comments — public read, no direct writes
-- ============================================================
DROP POLICY IF EXISTS "public_read_feed_post_comments" ON public.feed_post_comments;
CREATE POLICY "public_read_feed_post_comments"
  ON public.feed_post_comments
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- feed_post_likes — public read, no direct writes
-- ============================================================
DROP POLICY IF EXISTS "public_read_feed_post_likes" ON public.feed_post_likes;
CREATE POLICY "public_read_feed_post_likes"
  ON public.feed_post_likes
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- feed_post_comment_likes — public read, no direct writes
-- ============================================================
DROP POLICY IF EXISTS "public_read_feed_post_comment_likes" ON public.feed_post_comment_likes;
CREATE POLICY "public_read_feed_post_comment_likes"
  ON public.feed_post_comment_likes
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- public_profiles view — publicly readable profile data
-- Anyone can view profiles (same as viewing a Twitter/Instagram
-- profile). Mutations are blocked here; the backend API handles
-- avatar uploads, username changes etc. via the service role.
--
-- Safe to expose:  id, username, names, avatar, dates, stats
-- Never exposed:   password_hash, email, balance, tokens
-- ============================================================
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT
    id,
    username,
    first_name,
    last_name,
    avatar_url,
    created_at,
    total_pnl,
    total_volume,
    is_verified
  FROM public.users;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
