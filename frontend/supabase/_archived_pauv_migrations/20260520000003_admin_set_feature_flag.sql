-- ════════════════════════════════════════════════════════════════════
-- admin_set_feature_flag — single-row update on feature_flags
-- ════════════════════════════════════════════════════════════════════
--
-- Before: feature flags were tweaked via SQL editor or one-off
-- migrations. The admin UI had no way to flip `deposits_enabled` or
-- adjust `forecasts_max_microusdc_per_trade` without an engineer.
--
-- This RPC lets the admin app PATCH a single flag with a partial
-- updates jsonb. Same pattern as admin_edit_market / admin_edit_profile:
-- pass `p_updates` with only the keys that change; missing keys are
-- left untouched, present keys (even `null`) are written through. That
-- lets us distinguish "leave alone" from "clear to null".
--
-- audit_log gets a row per change with before/after snapshots — every
-- mutation of a kill-switch or limit is replayable from the audit feed.

create or replace function public.admin_set_feature_flag(
  p_key         text,
  p_updates     jsonb,
  p_actor_email text default null
)
returns public.feature_flags
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.feature_flags;
  v_after  public.feature_flags;
  v_actor  text := case
                     when p_actor_email is not null and length(trim(p_actor_email)) > 0
                     then 'admin:' || p_actor_email
                     else 'admin'
                   end;
  v_changed_keys jsonb;
begin
  if p_key is null or length(p_key) = 0 then
    raise exception 'key_required' using errcode = '22023';
  end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception 'updates_required' using errcode = '22023';
  end if;

  -- Whitelist editable columns. `description` is intentionally NOT
  -- editable — descriptions are the docs that explain WHY a flag
  -- exists; they only change via migration so they stay reviewable.
  v_changed_keys := (
    select jsonb_agg(k order by k)
    from jsonb_object_keys(p_updates) as k
    where k in ('bool_value', 'numeric_value', 'string_value', 'jsonb_value')
  );
  if v_changed_keys is null or jsonb_array_length(v_changed_keys) = 0 then
    raise exception 'no_editable_keys' using errcode = '22023';
  end if;

  select * into v_before from public.feature_flags where key = p_key;
  if not found then
    raise exception 'flag_not_found: %', p_key using errcode = 'P0002';
  end if;

  -- Type guards on each supplied value so a fat-fingered payload
  -- can't store a string in a numeric column.
  if p_updates ? 'bool_value' and (p_updates->'bool_value') is not null
     and jsonb_typeof(p_updates->'bool_value') <> 'boolean' then
    raise exception 'invalid_bool_value' using errcode = '22023';
  end if;
  if p_updates ? 'numeric_value' and (p_updates->'numeric_value') is not null
     and jsonb_typeof(p_updates->'numeric_value') <> 'number' then
    raise exception 'invalid_numeric_value' using errcode = '22023';
  end if;
  if p_updates ? 'string_value' and (p_updates->'string_value') is not null
     and jsonb_typeof(p_updates->'string_value') <> 'string' then
    raise exception 'invalid_string_value' using errcode = '22023';
  end if;
  -- jsonb_value: any jsonb is valid (object/array/string/number/bool/null).

  update public.feature_flags
  set
    bool_value = case
      when p_updates ? 'bool_value' then (p_updates->>'bool_value')::boolean
      else bool_value
    end,
    numeric_value = case
      when p_updates ? 'numeric_value' then (p_updates->>'numeric_value')::numeric
      else numeric_value
    end,
    string_value = case
      when p_updates ? 'string_value' then p_updates->>'string_value'
      else string_value
    end,
    jsonb_value = case
      when p_updates ? 'jsonb_value' then p_updates->'jsonb_value'
      else jsonb_value
    end,
    last_changed_by = auth.uid(),
    last_changed_at = now()
  where key = p_key;

  select * into v_after from public.feature_flags where key = p_key;

  insert into public.audit_log (actor, action, target_table, target_id, before, after, metadata)
  values (
    v_actor,
    'feature_flag.updated',
    'feature_flags',
    null,
    to_jsonb(v_before),
    to_jsonb(v_after),
    jsonb_build_object('key', p_key, 'changed_keys', v_changed_keys)
  );

  return v_after;
end;
$$;

revoke execute on function public.admin_set_feature_flag(text, jsonb, text) from public;
grant   execute on function public.admin_set_feature_flag(text, jsonb, text) to service_role;

comment on function public.admin_set_feature_flag(text, jsonb, text) is
  'Admin-only single-row update on feature_flags. p_updates is a partial jsonb of bool_value / numeric_value / string_value / jsonb_value. Writes audit_log.';
