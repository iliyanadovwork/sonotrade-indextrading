-- ════════════════════════════════════════════════════════════════════
-- Admin RPCs — add `p_actor_email` parameter for audit_log attribution
-- ════════════════════════════════════════════════════════════════════
--
-- The pauv-admin dashboard is migrating off the shared `ADMIN_TOKEN`
-- cookie to Cloudflare Access with Google `@pauv.com` sign-in. Each
-- request now carries the operator's email in the
-- `Cf-Access-Authenticated-User-Email` header.
--
-- We thread that email through the API routes to the RPCs so audit_log
-- entries record the real operator instead of the generic `'admin:token'`
-- placeholder. The new param defaults to NULL so SQL-editor calls (which
-- have no email context) still work — those write `'admin'` as the actor.
--
-- Function signatures change (param added), so we drop the old versions
-- first. Pre-existing callers (admin app) must be redeployed in sync.

-- ─── Drop existing signatures ──────────────────────────────────────
drop function if exists admin_create_profile(text, text, text, text, text, jsonb, jsonb, numeric);
drop function if exists admin_edit_profile(uuid, jsonb);
drop function if exists admin_decide_claim(uuid, text, text);
drop function if exists admin_edit_market(uuid, jsonb);

-- ─── admin_create_profile ──────────────────────────────────────────
create or replace function admin_create_profile(
  p_ticker            text,
  p_name              text,
  p_industry          text,
  p_bio               text,
  p_photo_url         text,
  p_socials           jsonb,
  p_info              jsonb,
  p_p0_override       numeric default null,
  p_actor_email       text    default null
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
  v_actor text := case when p_actor_email is not null then 'admin:' || p_actor_email else 'admin' end;
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
    v_actor, 'profile.created', 'profiles', v_profile_id,
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

revoke execute on function admin_create_profile(text, text, text, text, text, jsonb, jsonb, numeric, text) from public;
grant   execute on function admin_create_profile(text, text, text, text, text, jsonb, jsonb, numeric, text) to service_role;

-- ─── admin_edit_profile ────────────────────────────────────────────
create or replace function admin_edit_profile(
  p_profile_id uuid,
  p_updates    jsonb,
  p_actor_email text default null
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
  v_actor text := case when p_actor_email is not null then 'admin:' || p_actor_email else 'admin' end;
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
    v_actor, 'profile.edited', 'profiles', p_profile_id,
    v_before, v_after,
    jsonb_build_object('updated_keys', (select jsonb_agg(k) from jsonb_object_keys(p_updates) k))
  );

  return jsonb_build_object('ok', true, 'profile_id', p_profile_id);
end;
$$;

revoke execute on function admin_edit_profile(uuid, jsonb, text) from public;
grant   execute on function admin_edit_profile(uuid, jsonb, text) to service_role;

-- ─── admin_decide_claim ────────────────────────────────────────────
create or replace function admin_decide_claim(
  p_profile_id uuid,
  p_decision   text,
  p_notes      text default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before claim_status;
  v_new claim_status;
  v_actor text := case when p_actor_email is not null then 'admin:' || p_actor_email else 'admin' end;
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
    v_actor, 'profile.claim_decided', 'profiles', p_profile_id,
    jsonb_build_object('claim_status', v_before),
    jsonb_build_object('claim_status', v_new),
    jsonb_build_object('notes', p_notes)
  );

  return jsonb_build_object('ok', true, 'profile_id', p_profile_id, 'claim_status', v_new);
end;
$$;

revoke execute on function admin_decide_claim(uuid, text, text, text) from public;
grant   execute on function admin_decide_claim(uuid, text, text, text) to service_role;

-- ─── admin_edit_market ─────────────────────────────────────────────
create or replace function admin_edit_market(
  p_market_id uuid,
  p_updates   jsonb,
  p_actor_email text default null
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
  v_actor text := case when p_actor_email is not null then 'admin:' || p_actor_email else 'admin' end;
begin
  select to_jsonb(m.*) into v_before from markets m where profile_id = p_market_id;
  if v_before is null then
    raise exception 'market_not_found' using errcode = 'P0002';
  end if;

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
    v_actor, 'market.edited', 'markets', p_market_id,
    v_before, v_after,
    jsonb_build_object('updated_keys', (select jsonb_agg(k) from jsonb_object_keys(p_updates) k))
  );

  return jsonb_build_object('ok', true, 'profile_id', p_market_id, 'latest_price_cents', v_new_price_cents);
end;
$$;

revoke execute on function admin_edit_market(uuid, jsonb, text) from public;
grant   execute on function admin_edit_market(uuid, jsonb, text) to service_role;

comment on function admin_create_profile(text, text, text, text, text, jsonb, jsonb, numeric, text) is
  'Admin-only profile + market creation. Atomic. Records actor as admin:<email> in audit_log.';
comment on function admin_edit_profile(uuid, jsonb, text) is
  'Admin-only profile edit. Records actor as admin:<email> in audit_log.';
comment on function admin_decide_claim(uuid, text, text, text) is
  'Admin-only claim decision. Records actor as admin:<email> in audit_log.';
comment on function admin_edit_market(uuid, jsonb, text) is
  'Admin-only market edit (p0 + frozen only). Records actor as admin:<email> in audit_log.';
