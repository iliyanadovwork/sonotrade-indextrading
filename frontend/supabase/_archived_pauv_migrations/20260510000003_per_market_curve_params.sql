-- ════════════════════════════════════════════════════════════════════
-- Per-market curve parameters
-- ════════════════════════════════════════════════════════════════════
--
-- Previously every market shared a single global `curve_params` row.
-- The admin dashboard now lets operators set p0 (and b / fee_rate /
-- alpha / liquidation_threshold) per market at creation time and edit
-- them later. The engine adapter reads from the market row instead of
-- the global table.
--
-- `curve_params` stays around as the **default source** for new markets
-- — admin_create_profile reads the latest row and copies values onto the
-- new market unless an explicit override is supplied. Existing markets
-- are backfilled from the same source.

-- ─── 1. Add columns ────────────────────────────────────────────────
alter table markets
  add column if not exists p0                    numeric(38,18),
  add column if not exists b                     numeric(38,18),
  add column if not exists alpha                 numeric(38,18),
  add column if not exists fee_rate              numeric(6,5),
  add column if not exists liquidation_threshold numeric(6,5);

-- ─── 2. Backfill from latest curve_params ──────────────────────────
update markets m
set
  p0                    = c.p0,
  b                     = c.b,
  alpha                 = c.alpha,
  fee_rate              = c.fee_rate,
  liquidation_threshold = c.liquidation_threshold
from (
  select p0, b, alpha, fee_rate, liquidation_threshold
  from curve_params
  order by effective_at desc
  limit 1
) c
where m.p0 is null;

-- ─── 3. Enforce NOT NULL + sensible checks ─────────────────────────
alter table markets
  alter column p0                    set not null,
  alter column b                     set not null,
  alter column alpha                 set not null,
  alter column fee_rate              set not null,
  alter column liquidation_threshold set not null;

alter table markets
  add constraint markets_p0_positive check (p0 > 0),
  add constraint markets_b_nonneg check (b >= 0),
  add constraint markets_alpha_positive check (alpha > 0),
  add constraint markets_fee_rate_range check (fee_rate >= 0 and fee_rate < 0.1),
  add constraint markets_liq_range check (liquidation_threshold > 0 and liquidation_threshold < 1);

comment on column markets.p0 is
  'Baseline NPSI in USD at q=0 for this market. Set by admin at create time; can be edited later. Engine reads this instead of curve_params.p0.';

-- ─── 4. Update admin_create_profile to set the per-market columns ──
-- Reads curve_params for defaults (b, alpha, fee_rate, liquidation_threshold)
-- and uses p_p0_override if set, else curve_params.p0.
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
  v_curve record;
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

  select p0, b, alpha, fee_rate, liquidation_threshold
    into v_curve
  from curve_params
  order by effective_at desc
  limit 1;

  if v_curve is null then
    raise exception 'no_curve_params' using errcode = 'P0001';
  end if;

  v_p0 := coalesce(p_p0_override, v_curve.p0);
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

  insert into markets (
    profile_id, q, latest_price_cents,
    p0, b, alpha, fee_rate, liquidation_threshold
  ) values (
    v_profile_id, 0, v_initial_price_cents,
    v_p0, v_curve.b, v_curve.alpha, v_curve.fee_rate, v_curve.liquidation_threshold
  );

  insert into audit_log (actor, action, target_table, target_id, after, metadata)
  values (
    'admin:token',
    'profile.created',
    'profiles',
    v_profile_id,
    jsonb_build_object(
      'ticker', p_ticker, 'name', p_name, 'industry', p_industry,
      'initial_price_cents', v_initial_price_cents, 'p0', v_p0
    ),
    null
  );

  return jsonb_build_object(
    'ok', true,
    'profile_id', v_profile_id,
    'ticker', p_ticker,
    'initial_price_cents', v_initial_price_cents,
    'p0', v_p0
  );
end;
$$;

-- ─── 5. New admin_edit_market RPC for inline edits ─────────────────
-- Editable fields: p0, b, fee_rate, alpha, liquidation_threshold, frozen.
-- ticker is NOT editable (immutable identity).
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
  v_new_price_cents bigint;
  v_p0 numeric;
  v_b numeric;
  v_alpha numeric;
  v_q numeric;
begin
  select to_jsonb(m.*) into v_before from markets m where profile_id = p_market_id;
  if v_before is null then
    raise exception 'market_not_found' using errcode = 'P0002';
  end if;

  -- Validate optional incoming numeric values
  if p_updates ? 'p0' and (p_updates->>'p0')::numeric <= 0 then
    raise exception 'invalid_p0' using errcode = '22023';
  end if;
  if p_updates ? 'b' and (p_updates->>'b')::numeric < 0 then
    raise exception 'invalid_b' using errcode = '22023';
  end if;
  if p_updates ? 'alpha' and (p_updates->>'alpha')::numeric <= 0 then
    raise exception 'invalid_alpha' using errcode = '22023';
  end if;
  if p_updates ? 'fee_rate' then
    declare v_fee numeric := (p_updates->>'fee_rate')::numeric;
    begin
      if v_fee < 0 or v_fee >= 0.1 then
        raise exception 'invalid_fee_rate' using errcode = '22023';
      end if;
    end;
  end if;

  update markets set
    p0 = case when p_updates ? 'p0' then (p_updates->>'p0')::numeric else p0 end,
    b  = case when p_updates ? 'b'  then (p_updates->>'b')::numeric  else b end,
    alpha = case when p_updates ? 'alpha' then (p_updates->>'alpha')::numeric else alpha end,
    fee_rate = case when p_updates ? 'fee_rate' then (p_updates->>'fee_rate')::numeric else fee_rate end,
    liquidation_threshold = case when p_updates ? 'liquidation_threshold'
                                  then (p_updates->>'liquidation_threshold')::numeric
                                  else liquidation_threshold end,
    frozen = case when p_updates ? 'frozen' then (p_updates->>'frozen')::boolean else frozen end,
    frozen_reason = case when p_updates ? 'frozen_reason' then p_updates->>'frozen_reason' else frozen_reason end,
    latest_tick_at = now()
  where profile_id = p_market_id
  returning p0, b, alpha, q into v_p0, v_b, v_alpha, v_q;

  -- Recompute latest_price_cents from the new curve. For alpha=1 (linear) this
  -- is just p0 + b*q. For general alpha we use signed power matching the engine.
  if v_q >= 0 then
    v_new_price_cents := round((v_p0 + v_b * power(v_q, v_alpha)) * 100)::bigint;
  else
    v_new_price_cents := round((v_p0 - v_b * power(abs(v_q), v_alpha)) * 100)::bigint;
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

revoke execute on function admin_edit_market(uuid, jsonb) from public;
grant   execute on function admin_edit_market(uuid, jsonb) to service_role;

comment on function admin_edit_market(uuid, jsonb) is
  'Admin-only edit of per-market curve params (p0, b, alpha, fee_rate, liq) + freeze toggle. Recomputes latest_price_cents from the new curve.';
