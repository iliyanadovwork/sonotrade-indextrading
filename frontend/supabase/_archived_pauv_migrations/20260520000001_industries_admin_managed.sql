-- ════════════════════════════════════════════════════════════════════
-- Industries: hardcoded whitelist → admin-managed table
-- ════════════════════════════════════════════════════════════════════
--
-- Before: profiles.industry was gated by an IMMUTABLE valid_industry()
-- function that hardcoded the 13 allowed values. Adding a new industry
-- required a code+migration deploy and the admin UI couldn't introduce
-- one on its own.
--
-- After: industries live in a real `public.industries` table seeded
-- with the existing 13. The admin app can insert new rows via the
-- SECURITY DEFINER `admin_add_industry()` RPC. profiles.industry now
-- has a real foreign key to industries.singular — so the database is
-- the authoritative whitelist and unknown industries can't sneak in.
--
-- Production-app side: the hardcoded PLURAL_TO_SINGULAR map stays as a
-- display fallback for the seed 13, with an auto-pluralize rule that
-- handles new industries without an SSR fetch. The tag bar +
-- /tag/[plural] route will surface new industries automatically when
-- profiles start carrying them.
--
-- Written defensively — every statement is idempotent so the migration
-- can replay over a partial state without erroring.

-- ─── 1. industries table ───────────────────────────────────────────
create table if not exists public.industries (
  singular   text primary key
);

-- Backfill columns one at a time so the migration tolerates a partial
-- create from a prior run.
alter table public.industries
  add column if not exists plural     text;
alter table public.industries
  add column if not exists sort_order int  not null default 100;
alter table public.industries
  add column if not exists active     boolean not null default true;
alter table public.industries
  add column if not exists created_at timestamptz not null default now();
alter table public.industries
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Bring NOT NULL + check constraints in only after the columns are
-- guaranteed populated.
update public.industries set plural = singular || 's' where plural is null;
alter table public.industries alter column plural set not null;

-- Length sanity checks (re-add idempotently).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'industries_singular_len_chk'
      and conrelid = 'public.industries'::regclass
  ) then
    alter table public.industries
      add constraint industries_singular_len_chk
      check (length(singular) between 1 and 64);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'industries_plural_len_chk'
      and conrelid = 'public.industries'::regclass
  ) then
    alter table public.industries
      add constraint industries_plural_len_chk
      check (length(plural) between 1 and 80);
  end if;
end;
$$;

-- Plural names are case-insensitive unique so /tag/[plural] resolution
-- is unambiguous.
create unique index if not exists industries_plural_unique
  on public.industries (lower(plural));

create index if not exists industries_active_sort_idx
  on public.industries (active, sort_order);

-- Seed with the canonical 13. Idempotent.
insert into public.industries (singular, plural, sort_order, active) values
  ('Athlete',      'Athletes',       10, true),
  ('Politician',   'Politicians',    20, true),
  ('Musician',     'Musicians',      30, true),
  ('Streamer',     'Streamers',      40, true),
  ('Youtuber',     'Youtubers',      50, true),
  ('Commentator',  'Commentators',   60, true),
  ('Entrepreneur', 'Entrepreneurs',  70, true),
  ('Influencer',   'Influencers',    80, true),
  ('Gamer',        'Gamers',         90, true),
  ('Actor',        'Actors',        100, true),
  ('Comedian',     'Comedians',     110, true),
  ('Fitness',      'Fitness',       120, true),
  ('Podcaster',    'Podcasters',    130, true)
on conflict (singular) do update
  set plural     = excluded.plural,
      sort_order = excluded.sort_order,
      active     = true;

-- ─── 2. RLS — industries are public-readable, write via RPC only ───
alter table public.industries enable row level security;

drop policy if exists industries_public_read on public.industries;
create policy industries_public_read
  on public.industries
  for select
  using (true);

revoke insert, update, delete on public.industries from anon, authenticated;
grant select on public.industries to anon, authenticated;

-- ─── 3. Drop the old IMMUTABLE-list CHECK on profiles.industry ─────
-- The CHECK was defined inline with the column (`check (valid_industry(industry))`)
-- so Postgres auto-named it. Drop defensively by introspecting pg_constraint.
do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
   where t.relname = 'profiles'
     and t.relnamespace = 'public'::regnamespace
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ilike '%valid_industry%';
  if v_name is not null then
    execute format('alter table public.profiles drop constraint %I', v_name);
  end if;
end;
$$;

-- ─── 4. Rewrite valid_industry() to read from the table ────────────
-- STABLE instead of IMMUTABLE because the result now depends on table
-- state. CREATE OR REPLACE preserves the existing grants.
create or replace function public.valid_industry(ind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.industries
    where singular = ind and active
  );
$$;

revoke execute on function public.valid_industry(text) from public;
grant   execute on function public.valid_industry(text) to anon, authenticated, service_role;

-- ─── 5. Real FK on profiles.industry → industries.singular ─────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_industry_fk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_industry_fk
      foreign key (industry)
      references public.industries (singular)
      on update cascade
      on delete restrict;
  end if;
end;
$$;

-- ─── 6. admin_add_industry() — append-only, idempotent ─────────────
create or replace function public.admin_add_industry(
  p_singular    text,
  p_plural      text default null,
  p_actor_email text default null
)
returns public.industries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_singular text;
  v_plural   text;
  v_row      public.industries;
  v_actor    text := case
                       when p_actor_email is not null and length(trim(p_actor_email)) > 0
                       then 'admin:' || p_actor_email
                       else 'admin'
                     end;
begin
  v_singular := nullif(trim(p_singular), '');
  if v_singular is null or length(v_singular) > 64 then
    raise exception 'invalid_singular' using errcode = '22023';
  end if;
  v_singular := upper(left(v_singular, 1)) || lower(substring(v_singular from 2));

  v_plural := nullif(trim(p_plural), '');
  if v_plural is null then
    v_plural := case
      when right(v_singular, 1) = 's' then v_singular
      else v_singular || 's'
    end;
  else
    if length(v_plural) > 80 then
      raise exception 'invalid_plural' using errcode = '22023';
    end if;
    v_plural := upper(left(v_plural, 1)) || lower(substring(v_plural from 2));
  end if;

  insert into public.industries (singular, plural, created_by, active)
  values (v_singular, v_plural, auth.uid(), true)
  on conflict (singular) do update
    set plural = excluded.plural,
        active = true
  returning * into v_row;

  insert into public.audit_log (actor, action, target_table, target_id, after, metadata)
  values (
    v_actor,
    'industry.added',
    'industries',
    null,
    to_jsonb(v_row),
    null
  );

  return v_row;
end;
$$;

revoke execute on function public.admin_add_industry(text, text, text) from public;
grant   execute on function public.admin_add_industry(text, text, text) to service_role;

comment on table  public.industries is
  'Admin-managed whitelist of profile industries. profiles.industry FKs here.';
comment on function public.admin_add_industry(text, text, text) is
  'Admin-only append/reactivate of an industry. Title-cases and auto-pluralizes.';
comment on function public.valid_industry(text) is
  'True when ind matches an active row in industries. Used by RPCs for friendly errors; FK on profiles.industry is the real gate.';
