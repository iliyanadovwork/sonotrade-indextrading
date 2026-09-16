-- ════════════════════════════════════════════════════════════════════
-- Admin RPCs — adapted for shared-token auth in pauv-admin
-- ════════════════════════════════════════════════════════════════════
--
-- The pauv-admin dashboard moved from Supabase email/password auth to
-- a shared ADMIN_TOKEN cookie (matching the pauv.io demo pattern). With
-- token auth there is no Supabase JWT, so `auth.uid()` is NULL inside
-- the SECURITY DEFINER functions, which made `is_admin(auth.uid())`
-- always reject.
--
-- We redefine the four admin RPCs without the `is_admin()` gate. The
-- gate is now at the API route layer (admin-auth.ts: cookie === env).
-- These functions remain locked down via GRANT — only service_role
-- can EXECUTE, so anyone calling them from outside the admin app's
-- server runtime already holds the service-role key (and thus already
-- has full DB access).
--
-- audit_log actor is now the literal 'admin:token' since we no longer
-- have per-admin attribution under the shared-token model. If/when the
-- admin app migrates to per-user auth, we'll restore per-actor IDs.

-- ─────────────────────────────────────────────────────────────────────
-- admin_create_profile (no is_admin gate; actor = 'admin:token')
-- ─────────────────────────────────────────────────────────────────────
create or replace function admin_create_profile(
  p_ticker            text,
  p_name              text,
  p_industry          text,
  p_bio               text,
  p_photo_url         text,
  p_socials           jsonb,
  p_info              jsonb,
  p_p0_override       numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_curve_p0 numeric;
  v_initial_price_cents bigint;
begin
  if p_ticker is null or length(p_ticker) = 0 then
    raise exception 'ticker_required' using errcode = '22023';
  end if;
  if p_name is null or length(p_name) = 0 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if not valid_industry(p_industry) then
    raise exception 'invalid_industry: %', p_industry using errcode = '22023';
  end if;

  select p0 into v_curve_p0
  from curve_params
  order by effective_at desc
  limit 1;

  if v_curve_p0 is null then
    raise exception 'no_curve_params' using errcode = 'P0001';
  end if;

  v_initial_price_cents := round(coalesce(p_p0_override, v_curve_p0) * 100)::bigint;

  insert into profiles (
    ticker, name, bio, photo_url, industry,
    info_location, info_subcategory, info_active_since, info_language,
    social_spotify, social_applemusic, social_genius, social_x,
    social_instagram, social_tiktok, social_youtube, social_facebook,
    social_linkedin, social_linktree, social_reddit, social_telegram,
    social_threads, social_twitch, social_ticketmaster, social_imdb,
    social_website
  ) values (
    p_ticker,
    p_name,
    coalesce(p_bio, ''),
    coalesce(p_photo_url, ''),
    p_industry,
    p_info->>'location',
    p_info->>'subcategory',
    p_info->>'active_since',
    p_info->>'language',
    coalesce(p_socials->>'spotify', ''),
    coalesce(p_socials->>'applemusic', ''),
    coalesce(p_socials->>'genius', ''),
    coalesce(p_socials->>'x', ''),
    coalesce(p_socials->>'instagram', ''),
    coalesce(p_socials->>'tiktok', ''),
    coalesce(p_socials->>'youtube', ''),
    coalesce(p_socials->>'facebook', ''),
    coalesce(p_socials->>'linkedin', ''),
    coalesce(p_socials->>'linktree', ''),
    coalesce(p_socials->>'reddit', ''),
    coalesce(p_socials->>'telegram', ''),
    coalesce(p_socials->>'threads', ''),
    coalesce(p_socials->>'twitch', ''),
    coalesce(p_socials->>'ticketmaster', ''),
    coalesce(p_socials->>'imdb', ''),
    coalesce(p_socials->>'website', '')
  )
  returning id into v_profile_id;

  insert into markets (profile_id, q, latest_price_cents)
  values (v_profile_id, 0, v_initial_price_cents);

  insert into audit_log (actor, action, target_table, target_id, after, metadata)
  values (
    'admin:token',
    'profile.created',
    'profiles',
    v_profile_id,
    jsonb_build_object(
      'ticker', p_ticker,
      'name', p_name,
      'industry', p_industry,
      'initial_price_cents', v_initial_price_cents
    ),
    null
  );

  return jsonb_build_object(
    'ok', true,
    'profile_id', v_profile_id,
    'ticker', p_ticker,
    'initial_price_cents', v_initial_price_cents
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- admin_edit_profile
-- ─────────────────────────────────────────────────────────────────────
create or replace function admin_edit_profile(
  p_profile_id uuid,
  p_updates    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_industry text;
begin
  select to_jsonb(p.*) into v_before from profiles p where id = p_profile_id;
  if v_before is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if p_updates ? 'industry' then
    v_industry := p_updates->>'industry';
    if not valid_industry(v_industry) then
      raise exception 'invalid_industry: %', v_industry using errcode = '22023';
    end if;
  end if;

  if p_updates ? 'ticker' then
    raise exception 'ticker_immutable' using errcode = '22023';
  end if;

  update profiles set
    name = coalesce(p_updates->>'name', name),
    bio = coalesce(p_updates->>'bio', bio),
    photo_url = coalesce(p_updates->>'photo_url', photo_url),
    industry = coalesce(p_updates->>'industry', industry),
    info_location = coalesce(p_updates->>'info_location', info_location),
    info_subcategory = coalesce(p_updates->>'info_subcategory', info_subcategory),
    info_active_since = coalesce(p_updates->>'info_active_since', info_active_since),
    info_language = coalesce(p_updates->>'info_language', info_language),
    social_spotify = coalesce(p_updates->>'social_spotify', social_spotify),
    social_applemusic = coalesce(p_updates->>'social_applemusic', social_applemusic),
    social_genius = coalesce(p_updates->>'social_genius', social_genius),
    social_x = coalesce(p_updates->>'social_x', social_x),
    social_instagram = coalesce(p_updates->>'social_instagram', social_instagram),
    social_tiktok = coalesce(p_updates->>'social_tiktok', social_tiktok),
    social_youtube = coalesce(p_updates->>'social_youtube', social_youtube),
    social_facebook = coalesce(p_updates->>'social_facebook', social_facebook),
    social_linkedin = coalesce(p_updates->>'social_linkedin', social_linkedin),
    social_linktree = coalesce(p_updates->>'social_linktree', social_linktree),
    social_reddit = coalesce(p_updates->>'social_reddit', social_reddit),
    social_telegram = coalesce(p_updates->>'social_telegram', social_telegram),
    social_threads = coalesce(p_updates->>'social_threads', social_threads),
    social_twitch = coalesce(p_updates->>'social_twitch', social_twitch),
    social_ticketmaster = coalesce(p_updates->>'social_ticketmaster', social_ticketmaster),
    social_imdb = coalesce(p_updates->>'social_imdb', social_imdb),
    social_website = coalesce(p_updates->>'social_website', social_website),
    updated_at = now()
  where id = p_profile_id;

  select to_jsonb(p.*) into v_after from profiles p where id = p_profile_id;

  insert into audit_log (actor, action, target_table, target_id, before, after, metadata)
  values (
    'admin:token',
    'profile.edited',
    'profiles',
    p_profile_id,
    v_before,
    v_after,
    jsonb_build_object('updated_keys', (select jsonb_agg(k) from jsonb_object_keys(p_updates) k))
  );

  return jsonb_build_object('ok', true, 'profile_id', p_profile_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- admin_decide_claim
-- ─────────────────────────────────────────────────────────────────────
create or replace function admin_decide_claim(
  p_profile_id uuid,
  p_decision   text,
  p_notes      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before claim_status;
  v_new claim_status;
begin
  if p_decision not in ('verified', 'rejected') then
    raise exception 'invalid_decision: %', p_decision using errcode = '22023';
  end if;

  select claim_status into v_before
  from profiles
  where id = p_profile_id;

  if v_before is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if v_before not in ('submitted', 'in_progress') then
    raise exception 'not_pending: %', v_before using errcode = 'P0001';
  end if;

  v_new := p_decision::claim_status;

  update profiles
  set claim_status = v_new, updated_at = now()
  where id = p_profile_id;

  insert into audit_log (actor, action, target_table, target_id, before, after, metadata)
  values (
    'admin:token',
    'profile.claim_decided',
    'profiles',
    p_profile_id,
    jsonb_build_object('claim_status', v_before),
    jsonb_build_object('claim_status', v_new),
    jsonb_build_object('notes', p_notes)
  );

  return jsonb_build_object('ok', true, 'profile_id', p_profile_id, 'claim_status', v_new);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- admin_user_summaries — drop the is_admin() WHERE-clause gate
-- ─────────────────────────────────────────────────────────────────────
create or replace function admin_user_summaries(
  p_limit  int default 50,
  p_offset int default 0,
  p_search text default null
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  handle text,
  role user_role,
  kyc_status kyc_status,
  account_status account_status,
  available_microusdc bigint,
  pending_withdrawal_microusdc bigint,
  open_positions int,
  closed_positions int,
  total_trades int,
  deposits_credited int,
  deposits_total_microusdc bigint,
  withdrawals_completed int,
  withdrawals_total_microusdc bigint,
  last_activity_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    u.email,
    up.display_name,
    up.handle,
    up.role,
    up.kyc_status,
    up.account_status,
    coalesce(ub.available_microusdc, 0) as available_microusdc,
    coalesce(ub.pending_withdrawal_microusdc, 0) as pending_withdrawal_microusdc,
    coalesce((select count(*)::int from positions where user_id = u.id and status = 'open'), 0) as open_positions,
    coalesce((select count(*)::int from positions where user_id = u.id and status in ('closed', 'liquidated')), 0) as closed_positions,
    coalesce((select count(*)::int from transactions where user_id = u.id), 0) as total_trades,
    coalesce((select count(*)::int from pending_deposits where user_id = u.id and status = 'credited'), 0) as deposits_credited,
    coalesce((select sum(amount_microusdc)::bigint from ledger_entries where account_id = u.id and kind = 'deposit_credit' and direction = 'credit'), 0) as deposits_total_microusdc,
    coalesce((select count(*)::int from withdrawals where user_id = u.id and status = 'completed'), 0) as withdrawals_completed,
    coalesce((select sum(amount_microusdc)::bigint from withdrawals where user_id = u.id and status = 'completed'), 0) as withdrawals_total_microusdc,
    greatest(
      u.last_sign_in_at,
      (select max(created_at) from transactions where user_id = u.id),
      (select max(created_at) from pending_deposits where user_id = u.id),
      (select max(created_at) from withdrawals where user_id = u.id)
    ) as last_activity_at,
    u.created_at
  from auth.users u
  left join user_profiles up on up.user_id = u.id
  left join user_balances ub on ub.user_id = u.id
  where
    p_search is null
    or u.email ilike '%' || p_search || '%'
    or up.display_name ilike '%' || p_search || '%'
    or up.handle ilike '%' || p_search || '%'
  order by last_activity_at desc nulls last
  limit p_limit
  offset p_offset;
$$;

-- Tighten EXECUTE to service_role only — no more authenticated path.
revoke execute on function admin_user_summaries(int, int, text) from authenticated;
revoke execute on function admin_user_summaries(int, int, text) from public;
grant execute on function admin_user_summaries(int, int, text) to service_role;

comment on function admin_create_profile(text, text, text, text, text, jsonb, jsonb, numeric) is
  'Admin-only profile + market creation. Gated at the API route layer (ADMIN_TOKEN cookie). Only callable via service_role.';
comment on function admin_edit_profile(uuid, jsonb) is
  'Admin-only partial UPDATE on profiles. ticker is immutable. Gated at the API route layer.';
comment on function admin_decide_claim(uuid, text, text) is
  'Admin-only claim approve/reject. Gated at the API route layer.';
comment on function admin_user_summaries(int, int, text) is
  'Per-user aggregations. service_role only.';
