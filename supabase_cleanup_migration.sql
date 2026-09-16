-- ============================================================
-- CLEANUP MIGRATION: Remove orderbook/event-sourcing schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. Update update_balance function FIRST (before dropping locked_balance column)
--    Remove p_locked_delta — now a no-op kept for call-site safety during rollout
CREATE OR REPLACE FUNCTION public.update_balance(
  p_user_id      uuid,
  p_amount       numeric,
  p_locked_delta numeric DEFAULT 0   -- ignored, column is gone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET
    balance    = balance + p_amount,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- 2. Drop RPCs that are no longer used
DROP FUNCTION IF EXISTS public.place_and_match_order CASCADE;

-- 3. Drop orderbook views / materialized views
DROP VIEW IF EXISTS public.orderbook_summary CASCADE;
DROP VIEW IF EXISTS public.order_book_depth CASCADE;

-- 4. Drop tables that are no longer written to
--    (CASCADE drops any dependent views/constraints automatically)
DROP TABLE IF EXISTS public.orders          CASCADE;
DROP TABLE IF EXISTS public.events          CASCADE;
DROP TABLE IF EXISTS public.funding_payments CASCADE;
DROP TABLE IF EXISTS public.funding_rates   CASCADE;

-- 5. Drop unused columns
ALTER TABLE public.users          DROP COLUMN IF EXISTS locked_balance;
ALTER TABLE public.artist_metrics DROP COLUMN IF EXISTS trade_ids;

-- ============================================================
-- Resulting clean schema (tables that remain):
--
--   artist_daily_streams  — index price time-series (core)
--   artist_metrics        — per-artist stats (volume, changes, image_url)
--   positions             — open/closed user positions
--   users                 — accounts, balance, profile
--   comments              — artist comments
--   comment_likes         — comment like records
--   feed_posts            — social feed posts
--   feed_post_comments    — comments on feed posts
--   feed_post_comment_likes
--   feed_post_likes
-- ============================================================
