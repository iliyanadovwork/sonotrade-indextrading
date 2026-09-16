-- ════════════════════════════════════════════════════════════════════
-- Industry whitelist: replace the old list with the canonical 13.
-- Mirrors the hardcoded list in src/lib/industries.ts — both must
-- stay in sync. (Same arrangement as the original migration in
-- 20260430000001 — kept intentionally simple instead of a separate
-- table, because the cost of duplication is low and the upside of
-- not needing an SSR fetch on every page render outweighs it.)
-- ════════════════════════════════════════════════════════════════════

-- 1. Remap any profile whose existing industry isn't in the new list,
--    so the CHECK constraint stays satisfied. Mapping picks the
--    closest semantic neighbour; admins should review post-deploy and
--    reassign if needed.
update public.profiles
set industry = case
  when industry = 'Rapper'         then 'Musician'
  when industry = 'Artist'         then 'Musician'
  when industry = 'Author'         then 'Commentator'
  when industry = 'Chef'           then 'Entrepreneur'
  when industry = 'Coach'          then 'Entrepreneur'
  when industry = 'Designer'       then 'Entrepreneur'
  when industry = 'Filmmaker'      then 'Entrepreneur'
  when industry = 'Journalist'     then 'Commentator'
  when industry = 'Public Speaker' then 'Commentator'
  when industry = 'Fashion'        then 'Influencer'
  else 'Entrepreneur'
end
where industry not in (
  'Athlete', 'Politician', 'Musician', 'Streamer', 'Youtuber',
  'Commentator', 'Entrepreneur', 'Influencer', 'Gamer', 'Actor',
  'Comedian', 'Fitness', 'Podcaster'
);

-- 2. Replace the validator function. CREATE OR REPLACE rebinds the
--    body in place; the existing CHECK constraint on profiles.industry
--    keeps using it without any DDL on the table itself.
create or replace function public.valid_industry(ind text)
returns boolean
language sql
immutable
as $$
  select ind in (
    'Athlete', 'Politician', 'Musician', 'Streamer', 'Youtuber',
    'Commentator', 'Entrepreneur', 'Influencer', 'Gamer', 'Actor',
    'Comedian', 'Fitness', 'Podcaster'
  );
$$;
