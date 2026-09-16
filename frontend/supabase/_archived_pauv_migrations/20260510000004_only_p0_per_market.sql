-- ════════════════════════════════════════════════════════════════════
-- Lock the curve param model: only p0 is per-market.
-- ════════════════════════════════════════════════════════════════════
--
-- Migration 20260510000003 accidentally added b / alpha / fee_rate /
-- liquidation_threshold columns to the `markets` table. Per product spec:
--
--   p0                    → PER-PROFILE, admin-editable        (kept on markets)
--   b                     → GLOBAL, fixed (0.0005)             (curve_params only)
--   alpha                 → GLOBAL, fixed (1)                  (curve_params only)
--   fee_rate              → GLOBAL, fixed (0.018)              (curve_params only)
--   liquidation_threshold → GLOBAL, fixed (0.95)               (curve_params only)
--
-- Drop the extra columns from markets so the schema enforces the rule.
-- The engine adapter (and admin app) read p0 from markets, everything
-- else from curve_params.

-- ─── 1. Drop the extra columns ─────────────────────────────────────
alter table markets
  drop constraint if exists markets_b_nonneg,
  drop constraint if exists markets_alpha_positive,
  drop constraint if exists markets_fee_rate_range,
  drop constraint if exists markets_liq_range;

alter table markets
  drop column if exists b,
  drop column if exists alpha,
  drop column if exists fee_rate,
  drop column if exists liquidation_threshold;

-- ─── 2. admin_create_profile — write only markets.p0 ──────────────
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
  v_default_p0 numeric;
  v_p0 numeric;
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

  select p0 into v_default_p0
  from curve_params
  order by effective_at desc
  limit 1;

  if v_default_p0 is null then
    raise exception 'no_curve_params' using errcode = 'P0001';
  end if;

  v_p0 := coalesce(p_p0_override, v_default_p0);
  if v_p0 <= 0 then
    raise exception 'invalid_p0' using errcode = '22023';
  end if;
  v_initial_price_cents := round(v_p0 * 100)::bigint;

  insert into profiles (
    ticker, name, bio, photo_url, industry,
    info_location, info_subcategory, info_active_since, info_language,
    social_spotify, social_applemusic, social_genius, social_x,
    social_instagram, social_tiktok, social_youtube, social_facebook,
    social_linkedin, social_linktree, social_reddit, social_telegram,
    social_threads, social_twitch, social_ticketmaster, social_imdb,
    social_website
  ) values (
    p_ticker, p_name,
    coalesce(p_bio, ''), coalesce(p_photo_url, ''), p_industry,
    p_info->>'location', p_info->>'subcategory', p_info->>'active_since', p_info->>'language',
    coalesce(p_socials->>'spotify', ''),    coalesce(p_socials->>'applemusic', ''),
    coalesce(p_socials->>'genius', ''),     coalesce(p_socials->>'x', ''),
    coalesce(p_socials->>'instagram', ''),  coalesce(p_socials->>'tiktok', ''),
    coalesce(p_socials->>'youtube', ''),    coalesce(p_socials->>'facebook', ''),
    coalesce(p_socials->>'linkedin', ''),   coalesce(p_socials->>'linktree', ''),
    coalesce(p_socials->>'reddit', ''),     coalesce(p_socials->>'telegram', ''),
    coalesce(p_socials->>'threads', ''),    coalesce(p_socials->>'twitch', ''),
    coalesce(p_socials->>'ticketmaster', ''),coalesce(p_socials->>'imdb', ''),
    coalesce(p_socials->>'website', '')
  )
  returning id into v_profile_id;

  insert into markets (profile_id, q, latest_price_cents, p0)
  values (v_profile_id, 0, v_initial_price_cents, v_p0);

  insert into audit_log (actor, action, target_table, target_id, after, metadata)
  values (
    'admin:token', 'profile.created', 'profiles', v_profile_id,
    jsonb_build_object(
      'ticker', p_ticker, 'name', p_name, 'industry', p_industry,
      'initial_price_cents', v_initial_price_cents, 'p0', v_p0
    ),
    null
  );

  return jsonb_build_object(
    'ok', true, 'profile_id', v_profile_id, 'ticker', p_ticker,
    'initial_price_cents', v_initial_price_cents, 'p0', v_p0
  );
end;
$$;

-- ─── 3. admin_edit_market — only p0 + frozen + frozen_reason editable ─
create or replace function admin_edit_market(
  p_market_id uuid,
  p_updates   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_new_p0 numeric;
  v_b numeric;
  v_alpha numeric;
  v_q numeric;
  v_new_price_cents bigint;
begin
  select to_jsonb(m.*) into v_before from markets m where profile_id = p_market_id;
  if v_before is null then
    raise exception 'market_not_found' using errcode = 'P0002';
  end if;

  -- Reject any global-curve fields if a caller still tries to send them.
  if p_updates ? 'b' or p_updates ? 'alpha' or p_updates ? 'fee_rate' or p_updates ? 'liquidation_threshold' then
    raise exception 'field_not_editable: b/alpha/fee_rate/liquidation_threshold are global; edit curve_params'
      using errcode = '22023';
  end if;

  if p_updates ? 'p0' and (p_updates->>'p0')::numeric <= 0 then
    raise exception 'invalid_p0' using errcode = '22023';
  end if;

  update markets set
    p0 = case when p_updates ? 'p0' then (p_updates->>'p0')::numeric else p0 end,
    frozen = case when p_updates ? 'frozen' then (p_updates->>'frozen')::boolean else frozen end,
    frozen_reason = case when p_updates ? 'frozen_reason' then p_updates->>'frozen_reason' else frozen_reason end,
    latest_tick_at = now()
  where profile_id = p_market_id
  returning p0, q into v_new_p0, v_q;

  -- Recompute latest_price_cents from new p0 + global curve_params b/alpha.
  select b, alpha into v_b, v_alpha
  from curve_params
  order by effective_at desc
  limit 1;

  if v_q >= 0 then
    v_new_price_cents := round((v_new_p0 + v_b * power(v_q, v_alpha)) * 100)::bigint;
  else
    v_new_price_cents := round((v_new_p0 - v_b * power(abs(v_q), v_alpha)) * 100)::bigint;
  end if;
  v_new_price_cents := greatest(v_new_price_cents, 0);

  update markets
  set latest_price_cents = v_new_price_cents
  where profile_id = p_market_id;

  select to_jsonb(m.*) into v_after from markets m where profile_id = p_market_id;

  insert into audit_log (actor, action, target_table, target_id, before, after, metadata)
  values (
    'admin:token', 'market.edited', 'markets', p_market_id,
    v_before, v_after,
    jsonb_build_object('updated_keys', (select jsonb_agg(k) from jsonb_object_keys(p_updates) k))
  );

  return jsonb_build_object('ok', true, 'profile_id', p_market_id, 'latest_price_cents', v_new_price_cents);
end;
$$;

comment on function admin_edit_market(uuid, jsonb) is
  'Admin-only per-market edit. Editable fields: p0, frozen, frozen_reason. Global params (b, alpha, fee_rate, liquidation_threshold) live on curve_params and are NOT editable here.';
