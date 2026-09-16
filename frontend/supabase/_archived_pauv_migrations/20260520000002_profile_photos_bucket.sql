-- ════════════════════════════════════════════════════════════════════
-- Provision the `profile-photos` Supabase Storage bucket.
-- ════════════════════════════════════════════════════════════════════
--
-- Why this exists as a migration: the bucket was originally created via
-- the dashboard and isn't reproducible in fresh environments. New
-- branches / staging projects / disaster-recovery rebuilds need this to
-- be in source control so they can be brought online without a manual
-- click-through.
--
-- The pauv-admin app uploads profile photos here (sharp-resized 512×512
-- WebP @85, ≤8 MB raw input). The user-facing app reads them via
-- `profiles.photo_url`, which embeds the public bucket URL — so the
-- bucket must be public-readable.
--
-- Idempotent: re-running is a no-op for the row insert; policies use
-- the standard pg_policies guard.

-- 1. Bucket row. The unique key is the id; we use it as the name too
--    so the `name` column matches the public URL slug.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  8388608,  -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Read policy. With `public = true` Supabase serves objects via the
--    `.../object/public/...` URL without any auth header; the policy is
--    only consulted for the authenticated REST API path. Adding it
--    explicitly mirrors the dashboard "Public bucket" toggle and keeps
--    things sane if someone flips `public` back to false later.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'profile_photos_public_read'
  ) then
    create policy profile_photos_public_read
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'profile-photos');
  end if;
end;
$$;

-- 3. Writes are gated to service_role only — the admin app uploads via
--    the service-role key from a Node server runtime; nothing
--    user-facing should be able to write here directly. No `to anon`
--    or `to authenticated` policy. This matches the existing trust
--    model on the user-facing app (writes happen via Edge Functions /
--    API routes, never browser → storage).
