-- Sonotrade live schema snapshot
-- Generated 2026-08-09 from the live database (project zvgsjbphobukppeyymfp).
--
-- THIS IS A RECORD, NOT A MIGRATION. Do not run it. The live schema is
-- applied by hand and has never been in version control, which is how
-- 20260805_sync_current_index_value.sql sat unapplied for four days while
-- a file in sql/ described it as live. This file is the baseline that
-- makes that class of drift visible: regenerate it and diff.
--
-- Produced from pg_catalog rather than pg_dump: the CLI needs the database
-- password to link, which this machine does not have. Extension-owned
-- objects (pg_trgm et al) are excluded.

-- ============================== TABLES ==============================

-- TABLE artist_daily_streams   (RLS enabled)
--   id                           bigint not null default nextval('artist_daily_streams_id_seq'::regclass)
--   artist_name                  text not null
--   index                        numeric not null
--   timestamp                    timestamp with time zone not null default now()
--   created_at                   timestamp with time zone default now()
--   ema                          numeric
--   CONSTRAINT artist_daily_streams_pkey: PRIMARY KEY (id)

-- TABLE artist_index_history   (RLS enabled)
--   spotify_id                   text not null
--   ts                           timestamp with time zone not null
--   index                        numeric not null
--   monthly_listeners            bigint
--   followers                    bigint
--   CONSTRAINT artist_index_history_index_check: CHECK ((index >= (0)::numeric))
--   CONSTRAINT artist_index_history_pkey: PRIMARY KEY (spotify_id, ts)
--   CONSTRAINT artist_index_history_spotify_id_fkey: FOREIGN KEY (spotify_id) REFERENCES artists_with_history(spotify_id) ON DELETE CASCADE

-- TABLE artists_with_history   (RLS enabled)
--   artist_name                  text not null
--   last_updated                 timestamp with time zone not null
--   data_points                  jsonb not null default '[]'::jsonb
--   current_index_value          double precision
--   change_1h                    double precision
--   change_1d                    double precision
--   change_1w                    double precision
--   change_1m                    double precision
--   change_1y                    double precision
--   volume                       double precision default 0
--   spotify_id                   text not null
--   spotify_img                  text
--   followers                    bigint
--   monthly_listeners            bigint
--   verified                     boolean
--   header_image                 text
--   gallery                      jsonb
--   facebook                     text
--   instagram                    text
--   twitter                      text
--   tiktok                       text
--   wikipedia                    text
--   other                        text
--   biography                    text
--   top_cities                   jsonb
--   related                      jsonb
--   releases                     jsonb
--   top_tracks                   jsonb
--   discovered_on                jsonb
--   appears_on                   jsonb
--   events                       jsonb
--   tradeable                    boolean not null default true
--   untradeable_reason           text
--   CONSTRAINT artists_with_history_pkey: PRIMARY KEY (spotify_id)

-- TABLE comment_likes   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   comment_id                   uuid not null
--   user_id                      uuid not null
--   created_at                   timestamp with time zone default now()
--   CONSTRAINT comment_likes_comment_id_fkey: FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
--   CONSTRAINT comment_likes_comment_id_user_id_key: UNIQUE (comment_id, user_id)
--   CONSTRAINT comment_likes_pkey: PRIMARY KEY (id)
--   CONSTRAINT comment_likes_user_id_fkey: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- TABLE comments   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   user_id                      uuid not null
--   spotify_id                   text not null
--   content                      text not null
--   parent_id                    uuid
--   created_at                   timestamp with time zone default now()
--   updated_at                   timestamp with time zone default now()
--   like_count                   integer not null default 0
--   reply_count                  integer not null default 0
--   CONSTRAINT comments_like_count_non_negative: CHECK ((like_count >= 0))
--   CONSTRAINT comments_parent_id_fkey: FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
--   CONSTRAINT comments_pkey: PRIMARY KEY (id)
--   CONSTRAINT comments_reply_count_non_negative: CHECK ((reply_count >= 0))
--   CONSTRAINT comments_spotify_id_fkey: FOREIGN KEY (spotify_id) REFERENCES artists_with_history(spotify_id) ON DELETE CASCADE
--   CONSTRAINT comments_user_id_fkey: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- TABLE feed_post_comment_likes   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   comment_id                   uuid not null
--   user_id                      uuid not null
--   created_at                   timestamp with time zone default now()
--   CONSTRAINT feed_post_comment_likes_comment_id_fkey: FOREIGN KEY (comment_id) REFERENCES feed_post_comments(id) ON DELETE CASCADE
--   CONSTRAINT feed_post_comment_likes_comment_id_user_id_key: UNIQUE (comment_id, user_id)
--   CONSTRAINT feed_post_comment_likes_pkey: PRIMARY KEY (id)
--   CONSTRAINT feed_post_comment_likes_user_id_fkey: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- TABLE feed_post_comments   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   post_id                      uuid not null
--   user_id                      uuid not null
--   content                      text not null
--   parent_id                    uuid
--   created_at                   timestamp with time zone default now()
--   updated_at                   timestamp with time zone default now()
--   CONSTRAINT feed_post_comments_parent_id_fkey: FOREIGN KEY (parent_id) REFERENCES feed_post_comments(id) ON DELETE CASCADE
--   CONSTRAINT feed_post_comments_pkey: PRIMARY KEY (id)
--   CONSTRAINT feed_post_comments_post_id_fkey: FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE
--   CONSTRAINT feed_post_comments_user_id_fkey: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- TABLE feed_post_likes   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   post_id                      uuid not null
--   user_id                      uuid not null
--   created_at                   timestamp with time zone default now()
--   CONSTRAINT feed_post_likes_pkey: PRIMARY KEY (id)
--   CONSTRAINT feed_post_likes_post_id_fkey: FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE
--   CONSTRAINT feed_post_likes_post_id_user_id_key: UNIQUE (post_id, user_id)
--   CONSTRAINT feed_post_likes_user_id_fkey: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- TABLE feed_posts   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   user_id                      uuid not null
--   content                      text not null
--   created_at                   timestamp with time zone default now()
--   updated_at                   timestamp with time zone default now()
--   CONSTRAINT feed_posts_pkey: PRIMARY KEY (id)
--   CONSTRAINT feed_posts_user_id_fkey: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- TABLE idempotency_keys   (RLS enabled)
--   key                          text not null
--   user_id                      uuid
--   endpoint                     text not null
--   response                     jsonb not null
--   created_at                   timestamp with time zone not null default now()
--   expires_at                   timestamp with time zone not null default (now() + '24:00:00'::interval)
--   CONSTRAINT idempotency_keys_pkey: PRIMARY KEY (key)

-- TABLE positions   (RLS enabled)
--   id                           uuid not null default uuid_generate_v4()
--   user_id                      uuid not null
--   spotify_id                   character varying
--   position_type                character varying not null
--   contracts                    numeric not null
--   entry_price                  numeric not null
--   current_price                numeric
--   unrealized_pnl               numeric
--   total_cost                   numeric not null
--   status                       character varying not null default 'open'::character varying
--   opened_at                    timestamp with time zone not null default now()
--   closed_at                    timestamp with time zone
--   updated_at                   timestamp with time zone not null default now()
--   artist_name                  text
--   CONSTRAINT positions_contracts_check: CHECK ((contracts > (0)::numeric))
--   CONSTRAINT positions_entry_price_positive: CHECK ((entry_price > (0)::numeric)) NOT VALID
--   CONSTRAINT positions_pkey: PRIMARY KEY (id)
--   CONSTRAINT positions_position_type_check: CHECK (((position_type)::text = ANY ((ARRAY['long'::character varying, 'short'::character varying])::text[])))
--   CONSTRAINT positions_spotify_id_fkey: FOREIGN KEY (spotify_id) REFERENCES artists_with_history(spotify_id) ON DELETE SET NULL
--   CONSTRAINT positions_spotify_id_present: CHECK ((spotify_id IS NOT NULL)) NOT VALID
--   CONSTRAINT positions_status_check: CHECK (((status)::text = ANY (ARRAY['open'::text, 'closed'::text, 'liquidated'::text])))
--   CONSTRAINT positions_total_cost_non_negative: CHECK ((total_cost >= (0)::numeric)) NOT VALID
--   CONSTRAINT positions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- TABLE trade_ledger   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   user_id                      uuid not null
--   spotify_id                   text
--   position_id                  uuid
--   action                       text not null
--   quantity                     numeric not null
--   price                        numeric not null
--   cash_delta                   numeric not null
--   realized_pnl                 numeric not null default 0
--   balance_after                numeric not null
--   idempotency_key              text
--   created_at                   timestamp with time zone not null default now()
--   CONSTRAINT trade_ledger_pkey: PRIMARY KEY (id)
--   CONSTRAINT trade_ledger_position_id_fkey: FOREIGN KEY (position_id) REFERENCES positions(id)
--   CONSTRAINT trade_ledger_price_check: CHECK ((price > (0)::numeric))
--   CONSTRAINT trade_ledger_quantity_check: CHECK ((quantity > (0)::numeric))
--   CONSTRAINT trade_ledger_spotify_id_fkey: FOREIGN KEY (spotify_id) REFERENCES artists_with_history(spotify_id)
--   CONSTRAINT trade_ledger_user_id_fkey: FOREIGN KEY (user_id) REFERENCES users(id)

-- TABLE users   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   email                        character varying not null
--   username                     character varying not null
--   password_hash                text not null
--   first_name                   character varying
--   last_name                    character varying
--   avatar_url                   text
--   balance                      numeric not null default 1000.00
--   created_at                   timestamp with time zone default now()
--   updated_at                   timestamp with time zone default now()
--   last_login                   timestamp with time zone
--   is_active                    boolean default true
--   is_verified                  boolean default false
--   verification_token           text
--   reset_password_token         text
--   reset_password_expires       timestamp with time zone
--   total_pnl                    numeric not null default 0
--   total_volume                 numeric not null default 0
--   CONSTRAINT users_balance_non_negative: CHECK ((balance >= (0)::numeric)) NOT VALID
--   CONSTRAINT users_email_key: UNIQUE (email)
--   CONSTRAINT users_pkey: PRIMARY KEY (id)
--   CONSTRAINT users_total_volume_non_negative: CHECK ((total_volume >= (0)::numeric)) NOT VALID
--   CONSTRAINT users_username_key: UNIQUE (username)

-- TABLE waitlist   (RLS enabled)
--   id                           uuid not null default gen_random_uuid()
--   email                        text not null
--   verified                     boolean not null default false
--   created_at                   timestamp with time zone not null default now()
--   otp_hash                     text
--   otp_expires_at               timestamp with time zone
--   CONSTRAINT waitlist_email_key: UNIQUE (email)
--   CONSTRAINT waitlist_pkey: PRIMARY KEY (id)

-- ============================== INDEXES ==============================
CREATE UNIQUE INDEX artist_daily_streams_artist_day_idx ON public.artist_daily_streams USING btree (artist_name, ((timezone('UTC'::text, "timestamp"))::date));
CREATE INDEX artist_daily_streams_artist_ts_idx ON public.artist_daily_streams USING btree (artist_name, "timestamp" DESC);
CREATE UNIQUE INDEX artist_daily_streams_pkey ON public.artist_daily_streams USING btree (id);
CREATE UNIQUE INDEX artist_index_history_pkey ON public.artist_index_history USING btree (spotify_id, ts);
CREATE INDEX artist_index_history_spotify_ts_covering_idx ON public.artist_index_history USING btree (spotify_id, ts DESC) INCLUDE (index);
CREATE INDEX artist_index_history_spotify_ts_desc_idx ON public.artist_index_history USING btree (spotify_id, ts DESC);
CREATE INDEX artist_index_history_ts_brin_idx ON public.artist_index_history USING brin (ts);
CREATE INDEX artists_with_history_current_index_value_idx ON public.artists_with_history USING btree (current_index_value DESC NULLS LAST);
CREATE INDEX artists_with_history_last_updated_idx ON public.artists_with_history USING btree (last_updated DESC NULLS LAST);
CREATE INDEX artists_with_history_name_idx ON public.artists_with_history USING btree (artist_name);
CREATE INDEX artists_with_history_name_trgm_idx ON public.artists_with_history USING gin (artist_name gin_trgm_ops);
CREATE UNIQUE INDEX artists_with_history_pkey ON public.artists_with_history USING btree (spotify_id);
CREATE INDEX idx_artists_change_1d ON public.artists_with_history USING btree (change_1d DESC NULLS LAST);
CREATE INDEX idx_artists_change_1h ON public.artists_with_history USING btree (change_1h DESC NULLS LAST);
CREATE INDEX idx_artists_change_1m ON public.artists_with_history USING btree (change_1m DESC NULLS LAST);
CREATE INDEX idx_artists_change_1w ON public.artists_with_history USING btree (change_1w DESC NULLS LAST);
CREATE INDEX idx_artists_change_1y ON public.artists_with_history USING btree (change_1y DESC NULLS LAST);
CREATE INDEX idx_artists_tradeable ON public.artists_with_history USING btree (tradeable) WHERE (tradeable = false);
CREATE INDEX idx_artists_volume ON public.artists_with_history USING btree (volume DESC NULLS LAST);
CREATE UNIQUE INDEX comment_likes_comment_id_user_id_key ON public.comment_likes USING btree (comment_id, user_id);
CREATE INDEX comment_likes_comment_idx ON public.comment_likes USING btree (comment_id);
CREATE UNIQUE INDEX comment_likes_pkey ON public.comment_likes USING btree (id);
CREATE UNIQUE INDEX comment_likes_unique_idx ON public.comment_likes USING btree (comment_id, user_id);
CREATE INDEX comment_likes_user_idx ON public.comment_likes USING btree (user_id);
CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes USING btree (comment_id);
CREATE INDEX idx_comment_likes_user_id ON public.comment_likes USING btree (user_id);
CREATE INDEX comments_parent_idx ON public.comments USING btree (parent_id) WHERE (parent_id IS NOT NULL);
CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id);
CREATE INDEX comments_spotify_created_idx ON public.comments USING btree (spotify_id, created_at DESC);
CREATE INDEX comments_user_idx ON public.comments USING btree (user_id);
CREATE INDEX idx_comments_created_at ON public.comments USING btree (created_at DESC);
CREATE INDEX idx_comments_parent_id ON public.comments USING btree (parent_id);
CREATE INDEX idx_comments_spotify_id ON public.comments USING btree (spotify_id);
CREATE UNIQUE INDEX feed_post_comment_likes_comment_id_user_id_key ON public.feed_post_comment_likes USING btree (comment_id, user_id);
CREATE INDEX feed_post_comment_likes_comment_idx ON public.feed_post_comment_likes USING btree (comment_id);
CREATE UNIQUE INDEX feed_post_comment_likes_pkey ON public.feed_post_comment_likes USING btree (id);
CREATE UNIQUE INDEX feed_post_comment_likes_unique_idx ON public.feed_post_comment_likes USING btree (comment_id, user_id);
CREATE INDEX idx_feed_post_comment_likes_comment_id ON public.feed_post_comment_likes USING btree (comment_id);
CREATE INDEX idx_feed_post_comment_likes_user_id ON public.feed_post_comment_likes USING btree (user_id);
CREATE UNIQUE INDEX feed_post_comments_pkey ON public.feed_post_comments USING btree (id);
CREATE INDEX feed_post_comments_post_created_idx ON public.feed_post_comments USING btree (post_id, created_at);
CREATE INDEX feed_post_comments_user_created_idx ON public.feed_post_comments USING btree (user_id, created_at DESC);
CREATE INDEX idx_feed_post_comments_created_at ON public.feed_post_comments USING btree (created_at);
CREATE INDEX idx_feed_post_comments_parent_id ON public.feed_post_comments USING btree (parent_id);
CREATE INDEX idx_feed_post_comments_post_created ON public.feed_post_comments USING btree (post_id, created_at);
CREATE INDEX idx_feed_post_comments_post_id ON public.feed_post_comments USING btree (post_id);
CREATE INDEX idx_feed_post_comments_user_id ON public.feed_post_comments USING btree (user_id);
CREATE UNIQUE INDEX feed_post_likes_pkey ON public.feed_post_likes USING btree (id);
CREATE UNIQUE INDEX feed_post_likes_post_id_user_id_key ON public.feed_post_likes USING btree (post_id, user_id);
CREATE INDEX feed_post_likes_post_idx ON public.feed_post_likes USING btree (post_id);
CREATE UNIQUE INDEX feed_post_likes_unique_idx ON public.feed_post_likes USING btree (post_id, user_id);
CREATE INDEX idx_feed_post_likes_post_id ON public.feed_post_likes USING btree (post_id);
CREATE INDEX idx_feed_post_likes_user_id ON public.feed_post_likes USING btree (user_id);
CREATE INDEX feed_posts_created_idx ON public.feed_posts USING btree (created_at DESC);
CREATE UNIQUE INDEX feed_posts_pkey ON public.feed_posts USING btree (id);
CREATE INDEX feed_posts_user_created_idx ON public.feed_posts USING btree (user_id, created_at DESC);
CREATE INDEX idx_feed_posts_created_at ON public.feed_posts USING btree (created_at DESC);
CREATE INDEX idx_feed_posts_user_created ON public.feed_posts USING btree (user_id, created_at DESC);
CREATE INDEX idx_feed_posts_user_id ON public.feed_posts USING btree (user_id);
CREATE INDEX idempotency_keys_expires_idx ON public.idempotency_keys USING btree (expires_at);
CREATE UNIQUE INDEX idempotency_keys_pkey ON public.idempotency_keys USING btree (key);
CREATE INDEX idx_positions_spotify_id ON public.positions USING btree (spotify_id, status);
CREATE INDEX idx_positions_status ON public.positions USING btree (status);
CREATE UNIQUE INDEX idx_positions_unique_open ON public.positions USING btree (user_id, spotify_id) WHERE ((status)::text = 'open'::text);
CREATE INDEX idx_positions_user ON public.positions USING btree (user_id, status);
CREATE UNIQUE INDEX positions_one_open_per_user_artist_idx ON public.positions USING btree (user_id, spotify_id) WHERE ((status)::text = 'open'::text);
CREATE UNIQUE INDEX positions_pkey ON public.positions USING btree (id);
CREATE INDEX positions_spotify_id_idx ON public.positions USING btree (spotify_id);
CREATE INDEX positions_user_artist_status_idx ON public.positions USING btree (user_id, spotify_id, status);
CREATE INDEX positions_user_status_closed_idx ON public.positions USING btree (user_id, status, closed_at DESC);
CREATE INDEX positions_user_status_opened_idx ON public.positions USING btree (user_id, status, opened_at DESC);
CREATE UNIQUE INDEX trade_ledger_pkey ON public.trade_ledger USING btree (id);
CREATE INDEX trade_ledger_spotify_created_idx ON public.trade_ledger USING btree (spotify_id, created_at DESC);
CREATE INDEX trade_ledger_user_created_idx ON public.trade_ledger USING btree (user_id, created_at DESC);
CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_username ON public.users USING btree (username);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);
CREATE UNIQUE INDEX waitlist_email_key ON public.waitlist USING btree (email);
CREATE UNIQUE INDEX waitlist_pkey ON public.waitlist USING btree (id);

-- ============================== TRIGGERS ==============================
CREATE TRIGGER trg_sync_artists_with_history AFTER INSERT ON public.artist_daily_streams FOR EACH ROW EXECUTE FUNCTION sync_artists_with_history();
CREATE TRIGGER trg_append_index_history AFTER INSERT OR UPDATE OF data_points ON public.artists_with_history FOR EACH ROW EXECUTE FUNCTION append_index_history();
CREATE TRIGGER trg_sync_current_index_value_ins BEFORE INSERT ON public.artists_with_history FOR EACH ROW EXECUTE FUNCTION sync_current_index_value();
CREATE TRIGGER trg_sync_current_index_value_upd BEFORE UPDATE OF data_points ON public.artists_with_history FOR EACH ROW WHEN ((old.data_points IS DISTINCT FROM new.data_points)) EXECUTE FUNCTION sync_current_index_value();
CREATE TRIGGER trg_zz_clamp_current_index_value_ins BEFORE INSERT ON public.artists_with_history FOR EACH ROW EXECUTE FUNCTION clamp_current_index_value();
CREATE TRIGGER trg_zz_clamp_current_index_value_upd BEFORE UPDATE ON public.artists_with_history FOR EACH ROW EXECUTE FUNCTION clamp_current_index_value();
CREATE TRIGGER trg_comment_like_count AFTER INSERT OR DELETE ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION tg_comment_like_count();
CREATE TRIGGER trg_comment_reply_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION tg_comment_reply_count();
CREATE TRIGGER trg_enforce_position_tradeable BEFORE INSERT OR UPDATE OF contracts ON public.positions FOR EACH ROW EXECUTE FUNCTION enforce_position_tradeable();
CREATE TRIGGER trg_update_user_pnl AFTER INSERT OR DELETE OR UPDATE OF unrealized_pnl ON public.positions FOR EACH ROW EXECUTE FUNCTION trigger_update_user_pnl();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================== RLS POLICIES ==============================
-- artist_daily_streams.Allow anon read  SELECT to anon  USING(true) CHECK()
-- artist_daily_streams.public_read_artist_streams  SELECT to anon,authenticated  USING(true) CHECK()
-- artist_daily_streams.streams_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- artist_index_history.artist_index_history_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- artists_with_history.artists_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- artists_with_history.public_read_artists  SELECT to anon,authenticated  USING(true) CHECK()
-- comment_likes.comment_likes_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- comment_likes.public_read_comment_likes  SELECT to anon,authenticated  USING(true) CHECK()
-- comments.comments_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- comments.public_read_comments  SELECT to anon,authenticated  USING(true) CHECK()
-- feed_post_comment_likes.feed_post_comment_likes_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- feed_post_comment_likes.public_read_feed_post_comment_likes  SELECT to anon,authenticated  USING(true) CHECK()
-- feed_post_comments.feed_post_comments_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- feed_post_comments.public_read_feed_post_comments  SELECT to anon,authenticated  USING(true) CHECK()
-- feed_post_likes.feed_post_likes_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- feed_post_likes.public_read_feed_post_likes  SELECT to anon,authenticated  USING(true) CHECK()
-- feed_posts.feed_posts_public_read  SELECT to anon,authenticated  USING(true) CHECK()
-- feed_posts.public_read_feed_posts  SELECT to anon,authenticated  USING(true) CHECK()

-- ============================== FUNCTION GRANTS ==============================
-- _artist_history_points(p_data jsonb, p_current_index double precision, p_window text)
--     postgres=X/postgres | service_role=X/postgres | anon=X/postgres | authenticated=X/postgres
-- _artist_history_points_v2(p_spotify_ids text[], p_window text)
--     postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
-- append_index_history()
--     postgres=X/postgres | service_role=X/postgres
-- artist_history(p_spotify_id text, p_window text)
--     postgres=X/postgres | service_role=X/postgres | anon=X/postgres | authenticated=X/postgres
-- artist_history_batch(p_spotify_ids text[], p_window text)
--     postgres=X/postgres | service_role=X/postgres | anon=X/postgres | authenticated=X/postgres
-- artist_history_v2(p_spotify_id text, p_window text, p_max_points integer)
--     postgres=X/postgres | service_role=X/postgres | anon=X/postgres | authenticated=X/postgres
-- calculate_artist_volume_24h(p_artist_name character varying)
--     postgres=X/postgres | service_role=X/postgres
-- calculate_growth_indexes(data_points jsonb)
--     postgres=X/postgres | service_role=X/postgres
-- clamp_current_index_value()
--     =X/postgres | postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
-- close_position_tx(p_user_id uuid, p_spotify_id text, p_idempotency_key text)
--     postgres=X/postgres | service_role=X/postgres
-- compute_change(dp jsonb, period_hours double precision)
--     postgres=X/postgres | service_role=X/postgres
-- compute_index_change(dp jsonb, period_hours double precision)
--     postgres=X/postgres | service_role=X/postgres
-- enforce_position_tradeable()
--     postgres=X/postgres | service_role=X/postgres
-- generate_order_id()
--     postgres=X/postgres | service_role=X/postgres
-- get_artist_history(p_artist_name text, p_days_back integer)
--     postgres=X/postgres | service_role=X/postgres
-- get_latest_streams()
--     postgres=X/postgres | service_role=X/postgres
-- get_trending_artists(p_days integer)
--     postgres=X/postgres | service_role=X/postgres
-- handle_new_user()
--     postgres=X/postgres | service_role=X/postgres
-- increment_artist_volume(p_artist_name text, p_amount double precision)
--     postgres=X/postgres | service_role=X/postgres
-- increment_artist_volume(p_spotify_id text, p_amount numeric)
--     postgres=X/postgres | service_role=X/postgres
-- index_history_drift()
--     postgres=X/postgres | service_role=X/postgres
-- index_history_reconcile()
--     postgres=X/postgres | service_role=X/postgres
-- match_order_atomic(p_artist_name character varying, p_side character varying, p_order_type character varying, p_price numeric, p_quantity integer)
--     postgres=X/postgres | service_role=X/postgres
-- pct_change_from(p_spotify_id text, p_current numeric, p_interval interval)
--     postgres=X/postgres | service_role=X/postgres
-- pct_change_since(p_points jsonb, p_current numeric, p_cutoff timestamp with time zone)
--     postgres=X/postgres | service_role=X/postgres
-- place_order_tx(p_user_id uuid, p_spotify_id text, p_side text, p_quantity numeric, p_idempotency_key text)
--     postgres=X/postgres | service_role=X/postgres
-- place_order_v2(p_user_id uuid, p_spotify_id text, p_side text, p_quantity numeric, p_notional numeric, p_expected_price numeric, p_idempotency_key text)
--     postgres=X/postgres | service_role=X/postgres
-- poller_ingest(p_items jsonb)
--     postgres=X/postgres | service_role=X/postgres
-- purge_expired_idempotency_keys()
--     postgres=X/postgres | service_role=X/postgres
-- recalculate_change_columns()
--     postgres=X/postgres | service_role=X/postgres
-- recalculate_user_pnl(p_user_id uuid)
--     postgres=X/postgres | service_role=X/postgres
-- recompute_artist_changes(p_spotify_id text)
--     postgres=X/postgres | service_role=X/postgres
-- recompute_change_columns(p_spotify_ids text[])
--     postgres=X/postgres | service_role=X/postgres
-- refresh_artists_view()
--     postgres=X/postgres | service_role=X/postgres
-- refresh_orderbook_summary()
--     postgres=X/postgres | service_role=X/postgres
-- scraper_ingest(p_spotify_id text, p_artist_name text, p_monthly_listeners bigint, p_index numeric)
--     postgres=X/postgres | service_role=X/postgres
-- scraper_ingest_v2(p_spotify_id text, p_index numeric, p_listeners bigint, p_ts timestamp with time zone)
--     postgres=X/postgres | service_role=X/postgres
-- sonotrade_invariants()
--     postgres=X/postgres | service_role=X/postgres
-- sync_artists_with_history()
--     postgres=X/postgres | service_role=X/postgres
-- sync_current_index_value()
--     =X/postgres | postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
-- tg_comment_like_count()
--     postgres=X/postgres | service_role=X/postgres
-- tg_comment_reply_count()
--     postgres=X/postgres | service_role=X/postgres
-- thin_old_index_history(p_older_than interval)
--     postgres=X/postgres | service_role=X/postgres
-- trigger_update_user_pnl()
--     postgres=X/postgres | service_role=X/postgres
-- update_artist_metrics_after_history()
--     postgres=X/postgres | service_role=X/postgres
-- update_artist_metrics_after_trade()
--     postgres=X/postgres | service_role=X/postgres
-- update_balance(p_user_id uuid, p_amount numeric)
--     postgres=X/postgres | service_role=X/postgres
-- update_balance(p_user_id uuid, p_amount numeric, p_locked_delta numeric)
--     postgres=X/postgres | service_role=X/postgres
-- update_updated_at()
--     postgres=X/postgres | service_role=X/postgres
-- update_updated_at_column()
--     postgres=X/postgres | service_role=X/postgres

-- ============================== FUNCTIONS ==============================
CREATE OR REPLACE FUNCTION public._artist_history_points(p_data jsonb, p_current_index double precision, p_window text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
with cfg as (
  select
    case p_window
      when '1h'  then now() - interval '1 hour'
      when '24h' then now() - interval '24 hours'
      when '7d'  then now() - interval '7 days'
      when '30d' then now() - interval '30 days'
      else null::timestamptz                          -- 'all' or anything else
    end as cutoff,
    case p_window
      when '1h'  then 30000::bigint                   -- 30 s
      when '24h' then 900000::bigint                  -- 15 min
      when '7d'  then 3600000::bigint                 -- 1 h
      when '30d' then 14400000::bigint                -- 4 h
      else 3600000::bigint                            -- 'all' -> 1 h
    end as bucket_ms
),
pts as (
  select
    (e.dp->>'index')::float8          as price,       -- float8 = JS Number semantics
    e.dp->>'timestamp'                as ts_raw,      -- re-emitted verbatim (byte parity with JS)
    (e.dp->>'timestamp')::timestamptz as ts,
    e.ord
  from jsonb_array_elements(coalesce(p_data, '[]'::jsonb))
       with ordinality as e(dp, ord)
  where ( jsonb_typeof(e.dp->'index') = 'number'
          or e.dp->>'index' ~ '^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$' )
    and e.dp->>'timestamp' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}'
),
windowed as (
  select p.* from pts p cross join cfg
  where cfg.cutoff is null or p.ts >= cfg.cutoff
),
span as (
  select count(*)                                        as n,
         extract(epoch from min(ts)) * 1000              as t0_ms,
         extract(epoch from max(ts)) * 1000              as t1_ms
  from windowed
),
eff as (
  -- Fixed windows are bounded by construction (<=180 buckets). 'all' spans
  -- arbitrary history, so its bucket adapts: span/240, floored at 1h.
  select case
    when cfg.cutoff is null
      then greatest(cfg.bucket_ms, ceil((s.t1_ms - s.t0_ms) / 240)::bigint)
    else cfg.bucket_ms
  end as bucket_ms
  from cfg cross join span s
),
ranked as (
  -- rn=1 marks the LAST point per time bucket (max ts, ties -> later array
  -- index), matching the JS Map-overwrite downsample. n = points in window.
  select w.*,
         s.n,
         row_number() over (
           partition by floor(extract(epoch from w.ts) * 1000 / e.bucket_ms)
           order by w.ts desc, w.ord desc
         ) as rn
  from windowed w cross join span s cross join eff e
),
sampled as (
  select price, ts_raw, ts, ord
  from ranked
  where n <= 240 or rn = 1          -- JS: downsample only when length > 240
)
select case
  when exists (select 1 from sampled) then
    (select jsonb_agg(jsonb_build_object('price', price, 'timestamp', ts_raw)
                      order by ts asc, ord asc)
       from sampled)
  when p_current_index is not null then
    jsonb_build_array(jsonb_build_object(
      'price',     p_current_index,
      'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
  else '[]'::jsonb
end
$function$
;

CREATE OR REPLACE FUNCTION public._artist_history_points_v2(p_spotify_ids text[], p_window text)
 RETURNS TABLE(spotify_id text, points jsonb)
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  with cfg as (
    select
      case p_window
        when '1h'  then now() - interval '1 hour'
        when '24h' then now() - interval '24 hours'
        when '7d'  then now() - interval '7 days'
        when '30d' then now() - interval '30 days'
        else null::timestamptz
      end as cutoff,
      case p_window
        when '1h'  then 30000::bigint      -- 30 s
        when '24h' then 900000::bigint     -- 15 min
        when '7d'  then 3600000::bigint    -- 1 h
        when '30d' then 14400000::bigint   -- 4 h
        else 3600000::bigint               -- 'all' -> 1 h floor
      end as bucket_ms
  ),
  windowed as (
    select h.spotify_id, h.ts, h.index::float8 as price
    from public.artist_index_history h
    cross join cfg
    where h.spotify_id = any(p_spotify_ids)
      and (cfg.cutoff is null or h.ts >= cfg.cutoff)
  ),
  span as (
    select w.spotify_id,
           count(*) as n,
           extract(epoch from min(w.ts)) * 1000 as t0_ms,
           extract(epoch from max(w.ts)) * 1000 as t1_ms
    from windowed w
    group by w.spotify_id
  ),
  eff as (
    select s.spotify_id, s.n,
           case
             when cfg.cutoff is null
               then greatest(cfg.bucket_ms, ceil((s.t1_ms - s.t0_ms) / 240)::bigint)
             else cfg.bucket_ms
           end as bucket_ms
    from span s cross join cfg
  ),
  ranked as (
    select w.spotify_id, w.ts, w.price, e.n,
           row_number() over (
             partition by w.spotify_id,
                          floor(extract(epoch from w.ts) * 1000 / e.bucket_ms)
             order by w.ts desc
           ) as rn
    from windowed w
    join eff e on e.spotify_id = w.spotify_id
  ),
  sampled as (
    select r.spotify_id, r.ts, r.price
    from ranked r
    where r.n <= 240 or r.rn = 1     -- downsample only past the cap, as before
  )
  select s.spotify_id,
         jsonb_agg(
           -- to_json on a timestamptz emits ISO-8601 with the 'T' separator,
           -- matching the strings data_points stored. A bare ::text would give
           -- '2026-08-03 02:47:34+00', which not every JS engine parses.
           jsonb_build_object('price', s.price, 'timestamp', to_json(s.ts) #>> '{}')
           order by s.ts asc
         )
  from sampled s
  group by s.spotify_id;
$function$
;

CREATE OR REPLACE FUNCTION public.append_index_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_last jsonb;
begin
  if new.data_points is null
     or jsonb_typeof(new.data_points) <> 'array'
     or jsonb_array_length(new.data_points) = 0 then
    return null;
  end if;

  v_last := new.data_points -> -1;
  if v_last is null or not (v_last ? 'index') or not (v_last ? 'timestamp') then
    return null;
  end if;

  begin
    insert into public.artist_index_history (
      spotify_id, ts, index, monthly_listeners, followers
    )
    values (
      new.spotify_id,
      (v_last ->> 'timestamp')::timestamptz,
      (v_last ->> 'index')::numeric,
      new.monthly_listeners,
      new.followers
    )
    on conflict (spotify_id, ts) do update
      set index = excluded.index,
          -- coalesce, not overwrite: a later writer that does not know the
          -- listener count must not erase one already recorded.
          monthly_listeners = coalesce(excluded.monthly_listeners, public.artist_index_history.monthly_listeners),
          followers         = coalesce(excluded.followers, public.artist_index_history.followers);
  exception when others then
    -- A malformed tail point must never fail the artist write.
    null;
  end;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.artist_history(p_spotify_id text, p_window text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select coalesce(
    (select p.points
       from public._artist_history_points_v2(array[p_spotify_id], p_window) p
      limit 1),
    -- No history yet (a market listed today): one synthetic point at the
    -- current price, so a fresh chart draws a flat line instead of nothing.
    (select jsonb_build_array(jsonb_build_object(
              'price', a.current_index_value::float8,
              'timestamp', to_json(now()) #>> '{}'))
       from public.artists_with_history a
      where a.spotify_id = p_spotify_id
        and a.current_index_value is not null),
    '[]'::jsonb
  );
$function$
;

CREATE OR REPLACE FUNCTION public.artist_history_batch(p_spotify_ids text[], p_window text DEFAULT '30d'::text)
 RETURNS TABLE(spotify_id text, points jsonb)
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select p.spotify_id, p.points
  from public._artist_history_points_v2(p_spotify_ids, p_window) p;
$function$
;

CREATE OR REPLACE FUNCTION public.artist_history_v2(p_spotify_id text, p_window text DEFAULT 'all'::text, p_max_points integer DEFAULT 240)
 RETURNS TABLE(ts timestamp with time zone, index numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_since timestamptz;
  v_total int;
  v_stride int;
begin
  v_since := case p_window
    when '1h' then now() - interval '1 hour'
    when '1d' then now() - interval '1 day'
    when '1w' then now() - interval '7 days'
    when '1m' then now() - interval '30 days'
    when '1y' then now() - interval '365 days'
    else '-infinity'::timestamptz
  end;

  select count(*) into v_total
    from public.artist_index_history h
   where h.spotify_id = p_spotify_id and h.ts >= v_since;

  -- Keep every point when the window is already small enough; otherwise
  -- take every Nth so the payload is bounded regardless of history depth.
  v_stride := greatest(1, ceil(v_total::numeric / greatest(p_max_points, 1))::int);

  return query
    with ordered as (
      select h.ts, h.index, row_number() over (order by h.ts) as rn
        from public.artist_index_history h
       where h.spotify_id = p_spotify_id and h.ts >= v_since
    )
    select o.ts, o.index
      from ordered o
     where o.rn % v_stride = 0 or o.rn = v_total
     order by o.ts;
end $function$
;

CREATE OR REPLACE FUNCTION public.calculate_artist_volume_24h(p_artist_name character varying)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_volume DECIMAL(20, 2);
BEGIN
  -- Sum total_value from trade_history for the last 24 hours
  -- This counts BOTH buys and sells
  SELECT COALESCE(SUM(total_value), 0)
  INTO v_volume
  FROM trade_history
  WHERE artist_name = p_artist_name
    AND filled_at >= NOW() - INTERVAL '24 hours';
  
  RETURN v_volume;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_growth_indexes(data_points jsonb)
 RETURNS TABLE(growth_index_1d double precision, growth_index_1w double precision, growth_index_1m double precision, growth_index_1y double precision, growth_rate_1d double precision, growth_rate_1w double precision, growth_rate_1m double precision, growth_rate_1y double precision, momentum_1d double precision, momentum_1w double precision, momentum_1m double precision, momentum_1y double precision)
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_index DOUBLE PRECISION;
    current_ts TIMESTAMP WITH TIME ZONE;
    
    -- Indexes at different timeframes
    index_1d DOUBLE PRECISION;
    index_2d DOUBLE PRECISION;
    index_1w DOUBLE PRECISION;
    index_2w DOUBLE PRECISION;
    index_1m DOUBLE PRECISION;
    index_2m DOUBLE PRECISION;
    index_1y DOUBLE PRECISION;
    index_2y DOUBLE PRECISION;
    
    -- Growth rates
    growth_1d DOUBLE PRECISION;
    growth_1w DOUBLE PRECISION;
    growth_1m DOUBLE PRECISION;
    growth_1y DOUBLE PRECISION;
    
    -- Previous growth rates (for momentum)
    prev_growth_1d DOUBLE PRECISION;
    prev_growth_1w DOUBLE PRECISION;
    prev_growth_1m DOUBLE PRECISION;
    prev_growth_1y DOUBLE PRECISION;
    
    -- Momentum scores
    mom_1d DOUBLE PRECISION;
    mom_1w DOUBLE PRECISION;
    mom_1m DOUBLE PRECISION;
    mom_1y DOUBLE PRECISION;
    
    -- Calculated growth indexes
    gi_1d DOUBLE PRECISION;
    gi_1w DOUBLE PRECISION;
    gi_1m DOUBLE PRECISION;
    gi_1y DOUBLE PRECISION;
    
    -- Helper variables
    point JSONB;
    point_ts TIMESTAMP WITH TIME ZONE;
    point_index DOUBLE PRECISION;
    days_diff DOUBLE PRECISION;
    
    -- Track closest matches for each timeframe
    min_diff_1d DOUBLE PRECISION := 999;
    min_diff_2d DOUBLE PRECISION := 999;
    min_diff_1w DOUBLE PRECISION := 999;
    min_diff_2w DOUBLE PRECISION := 999;
    min_diff_1m DOUBLE PRECISION := 999;
    min_diff_2m DOUBLE PRECISION := 999;
    min_diff_1y DOUBLE PRECISION := 999;
    min_diff_2y DOUBLE PRECISION := 999;
BEGIN
    -- Check if we have enough data points
    IF jsonb_array_length(data_points) < 2 THEN
        RETURN QUERY SELECT 
            100.0::DOUBLE PRECISION, 100.0::DOUBLE PRECISION, 100.0::DOUBLE PRECISION, 100.0::DOUBLE PRECISION,
            NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION,
            NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION, NULL::DOUBLE PRECISION;
        RETURN;
    END IF;
    
    -- Get current (most recent) data point
    current_index := (data_points -> (jsonb_array_length(data_points) - 1) ->> 'index')::DOUBLE PRECISION;
    current_ts := (data_points -> (jsonb_array_length(data_points) - 1) ->> 'timestamp')::TIMESTAMP WITH TIME ZONE;
    
    -- Find closest data points for each timeframe
    FOR i IN 0..(jsonb_array_length(data_points) - 2) LOOP
        point := data_points -> i;
        point_ts := (point ->> 'timestamp')::TIMESTAMP WITH TIME ZONE;
        point_index := (point ->> 'index')::DOUBLE PRECISION;
        days_diff := EXTRACT(EPOCH FROM (current_ts - point_ts)) / 86400;
        
        -- 1 day ago
        IF ABS(days_diff - 1) < min_diff_1d THEN
            min_diff_1d := ABS(days_diff - 1);
            index_1d := point_index;
        END IF;
        
        -- 2 days ago (for momentum)
        IF ABS(days_diff - 2) < min_diff_2d THEN
            min_diff_2d := ABS(days_diff - 2);
            index_2d := point_index;
        END IF;
        
        -- 7 days ago (1 week)
        IF ABS(days_diff - 7) < min_diff_1w THEN
            min_diff_1w := ABS(days_diff - 7);
            index_1w := point_index;
        END IF;
        
        -- 14 days ago (2 weeks, for momentum)
        IF ABS(days_diff - 14) < min_diff_2w THEN
            min_diff_2w := ABS(days_diff - 14);
            index_2w := point_index;
        END IF;
        
        -- 30 days ago (1 month)
        IF ABS(days_diff - 30) < min_diff_1m THEN
            min_diff_1m := ABS(days_diff - 30);
            index_1m := point_index;
        END IF;
        
        -- 60 days ago (2 months, for momentum)
        IF ABS(days_diff - 60) < min_diff_2m THEN
            min_diff_2m := ABS(days_diff - 60);
            index_2m := point_index;
        END IF;
        
        -- 365 days ago (1 year)
        IF ABS(days_diff - 365) < min_diff_1y THEN
            min_diff_1y := ABS(days_diff - 365);
            index_1y := point_index;
        END IF;
        
        -- 730 days ago (2 years, for momentum)
        IF ABS(days_diff - 730) < min_diff_2y THEN
            min_diff_2y := ABS(days_diff - 730);
            index_2y := point_index;
        END IF;
    END LOOP;
    
    -- Calculate growth rates for each timeframe
    growth_1d := CASE WHEN index_1d IS NOT NULL THEN ((current_index - index_1d) / NULLIF(index_1d, 0)) * 100 ELSE NULL END;
    growth_1w := CASE WHEN index_1w IS NOT NULL THEN ((current_index - index_1w) / NULLIF(index_1w, 0)) * 100 ELSE NULL END;
    growth_1m := CASE WHEN index_1m IS NOT NULL THEN ((current_index - index_1m) / NULLIF(index_1m, 0)) * 100 ELSE NULL END;
    growth_1y := CASE WHEN index_1y IS NOT NULL THEN ((current_index - index_1y) / NULLIF(index_1y, 0)) * 100 ELSE NULL END;
    
    -- Calculate previous growth rates (for momentum)
    prev_growth_1d := CASE WHEN index_1d IS NOT NULL AND index_2d IS NOT NULL THEN ((index_1d - index_2d) / NULLIF(index_2d, 0)) * 100 ELSE NULL END;
    prev_growth_1w := CASE WHEN index_1w IS NOT NULL AND index_2w IS NOT NULL THEN ((index_1w - index_2w) / NULLIF(index_2w, 0)) * 100 ELSE NULL END;
    prev_growth_1m := CASE WHEN index_1m IS NOT NULL AND index_2m IS NOT NULL THEN ((index_1m - index_2m) / NULLIF(index_2m, 0)) * 100 ELSE NULL END;
    prev_growth_1y := CASE WHEN index_1y IS NOT NULL AND index_2y IS NOT NULL THEN ((index_1y - index_2y) / NULLIF(index_2y, 0)) * 100 ELSE NULL END;
    
    -- Calculate momentum (acceleration)
    mom_1d := CASE WHEN growth_1d IS NOT NULL AND prev_growth_1d IS NOT NULL THEN growth_1d - prev_growth_1d ELSE 0 END;
    mom_1w := CASE WHEN growth_1w IS NOT NULL AND prev_growth_1w IS NOT NULL THEN growth_1w - prev_growth_1w ELSE 0 END;
    mom_1m := CASE WHEN growth_1m IS NOT NULL AND prev_growth_1m IS NOT NULL THEN growth_1m - prev_growth_1m ELSE 0 END;
    mom_1y := CASE WHEN growth_1y IS NOT NULL AND prev_growth_1y IS NOT NULL THEN growth_1y - prev_growth_1y ELSE 0 END;
    
    -- Calculate growth-based indexes with CALIBRATED multipliers
    -- Target: ~5% weekly, ~15% monthly, ~30% yearly average moves
    
    gi_1d := GREATEST(1, 100 + (COALESCE(growth_1d, 0) * 10) + (COALESCE(mom_1d, 0) * 3));
    gi_1w := GREATEST(1, 100 + (COALESCE(growth_1w, 0) * 3.5) + (COALESCE(mom_1w, 0) * 1.5));
    gi_1m := GREATEST(1, 100 + (COALESCE(growth_1m, 0) * 2.7) + (COALESCE(mom_1m, 0) * 1.0));
    gi_1y := GREATEST(1, 100 + (COALESCE(growth_1y, 0) * 2.5) + (COALESCE(mom_1y, 0) * 0.5));
    
    RETURN QUERY SELECT 
        gi_1d, gi_1w, gi_1m, gi_1y,
        growth_1d, growth_1w, growth_1m, growth_1y,
        mom_1d, mom_1w, mom_1m, mom_1y;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.clamp_current_index_value()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.current_index_value is not null and new.current_index_value < 0.01 then
    new.current_index_value := 0.01;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.close_position_tx(p_user_id uuid, p_spotify_id text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pos          public.positions;
  v_price        numeric;
  v_proceeds     numeric;
  v_realized_pnl numeric;
  v_balance      numeric;
  v_rows         integer;
  v_cached       jsonb;
  v_result       jsonb;
  v_now          timestamptz := now();
begin
  if p_idempotency_key is not null then
    select response into v_cached from public.idempotency_keys
      where key = p_idempotency_key and expires_at > v_now;
    if v_cached is not null then
      return v_cached || jsonb_build_object('replayed', true);
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('sonotrade:user:' || p_user_id::text));

  select * into v_pos from public.positions
    where user_id = p_user_id and spotify_id = p_spotify_id and status = 'open'
    for update;
  if v_pos.id is null then
    raise exception 'no open position found' using errcode = 'P0002';
  end if;

  select current_index_value into v_price
    from public.artists_with_history where spotify_id = p_spotify_id;
  if v_price is null or v_price = 'NaN'::numeric or v_price <= 0 then
    raise exception 'price unavailable for %', p_spotify_id using errcode = '55000';
  end if;

  if v_pos.position_type = 'long' then
    v_proceeds := round(v_price * v_pos.contracts, 2);
  else
    v_proceeds := greatest(
      0,
      round(v_pos.total_cost + (round(v_pos.total_cost / v_pos.contracts, 8) - v_price) * v_pos.contracts, 2)
    );
  end if;
  v_realized_pnl := round(v_proceeds - v_pos.total_cost, 2);

  -- Re-asserting status='open' is what makes a concurrent double-close
  -- impossible even if the advisory lock were removed.
  update public.positions set
    -- 'liquidated' when the short floor bound and the whole margin was
    -- lost. Nothing in the codebase ever wrote this status before, even
    -- though /api/trades/history reads it.
    status         = case
                       when v_pos.position_type = 'short' and v_proceeds = 0 then 'liquidated'
                       else 'closed'
                     end,
    current_price  = v_price,
    unrealized_pnl = v_realized_pnl,
    closed_at      = v_now,
    updated_at     = v_now
  where id = v_pos.id and status = 'open';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'position already closed' using errcode = '40001';
  end if;

  update public.users set
    balance    = round(balance + v_proceeds, 2),
    total_pnl  = coalesce(total_pnl, 0) + v_realized_pnl,
    updated_at = v_now
  where id = p_user_id
  returning balance into v_balance;

  insert into public.trade_ledger (
    user_id, spotify_id, position_id, action, quantity, price,
    cash_delta, realized_pnl, balance_after, idempotency_key
  ) values (
    p_user_id, p_spotify_id, v_pos.id,
    case when v_pos.position_type = 'long' then 'close_long' else 'close_short' end,
    v_pos.contracts, v_price, v_proceeds, v_realized_pnl, v_balance, p_idempotency_key
  );

  v_result := jsonb_build_object(
    'success', true,
    'position_id', v_pos.id,
    'contracts', v_pos.contracts,
    'price', v_price,
    'proceeds', v_proceeds,
    'realized_pnl', v_realized_pnl,
    'balance', v_balance
  );

  if p_idempotency_key is not null then
    insert into public.idempotency_keys (key, user_id, endpoint, response)
      values (p_idempotency_key, p_user_id, 'trades/close', v_result)
      on conflict (key) do nothing;
  end if;

  return v_result;
end $function$
;

CREATE OR REPLACE FUNCTION public.compute_change(dp jsonb, period_hours double precision)
 RETURNS double precision
 LANGUAGE plpgsql
AS $function$
  DECLARE                                                                                                                 
    n int := jsonb_array_length(dp);
    latest_index float;
    old_index float := NULL;
    cutoff timestamptz;
    i int;
  BEGIN
    IF n < 2 THEN RETURN NULL; END IF;
    latest_index := (dp->(n-1)->>'index')::float;                                                                         
    cutoff := NOW() - (period_hours * interval '1 hour');
    FOR i IN REVERSE (n-2)..0 LOOP                                                                                        
      IF (dp->i->>'timestamp')::timestamptz <= cutoff THEN                                                                
        old_index := (dp->i->>'index')::float;
        EXIT;                                                                                                             
      END IF;     
    END LOOP;
    IF old_index IS NULL THEN
      old_index := (dp->0->>'index')::float;                                                                              
    END IF;
    IF old_index IS NULL OR old_index = 0 THEN RETURN NULL; END IF;                                                       
    RETURN ((latest_index - old_index) / old_index) * 100;
  END;                                                                                                                    
  $function$
;

CREATE OR REPLACE FUNCTION public.compute_index_change(dp jsonb, period_hours double precision)
 RETURNS double precision
 LANGUAGE plpgsql
AS $function$                                                                                                     
  DECLARE                                                   
    n int := jsonb_array_length(dp);
    latest_index float;
    old_index float := NULL;
    cutoff timestamptz;                                                                                                   
    i int;
  BEGIN                                                                                                                   
    IF n < 2 THEN RETURN NULL; END IF;                      
    latest_index := (dp->(n-1)->>'index')::float;
    cutoff := NOW() - (period_hours * interval '1 hour');
    FOR i IN REVERSE (n-2)..0 LOOP                                                                                        
      IF (dp->i->>'timestamp')::timestamptz <= cutoff THEN
        old_index := (dp->i->>'index')::float;                                                                            
        EXIT;                                                                                                             
      END IF;
    END LOOP;                                                                                                             
    IF old_index IS NULL THEN                               
      old_index := (dp->0->>'index')::float;
    END IF;
    IF old_index IS NULL OR old_index = 0 THEN RETURN NULL; END IF;
    RETURN ((latest_index - old_index) / old_index) * 100;                                                                
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.enforce_position_tradeable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_tradeable boolean;
  v_reason    text;
  v_price     numeric;
begin
  if tg_op = 'UPDATE' and new.contracts <= old.contracts then
    return new;   -- reducing or closing: always allowed
  end if;

  select a.tradeable, a.untradeable_reason, a.current_index_value
    into v_tradeable, v_reason, v_price
  from public.artists_with_history a
  where a.spotify_id = new.spotify_id;

  if not found then
    raise exception 'artist not found: %', new.spotify_id using errcode = 'P0002';
  end if;

  if coalesce(v_tradeable, false) = false then
    raise exception 'market closed for this artist (%)', coalesce(v_reason, 'not tradeable')
      using errcode = '55000';
  end if;

  if v_price is null or v_price <= 0 then
    raise exception 'market closed for this artist (price unavailable)'
      using errcode = '55000';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_order_id()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_artist_history(p_artist_name text, p_days_back integer DEFAULT 30)
 RETURNS TABLE(daily_streams numeric, recorded_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT daily_streams, timestamp
    FROM artist_daily_streams
    WHERE artist_name = p_artist_name
        AND timestamp > NOW() - (p_days_back || ' days')::INTERVAL
    ORDER BY timestamp DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_latest_streams()
 RETURNS TABLE(artist_name text, daily_streams numeric, recorded_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT DISTINCT ON (artist_name)
        artist_name,
        daily_streams,
        timestamp
    FROM artist_daily_streams
    ORDER BY artist_name, timestamp DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_trending_artists(p_days integer DEFAULT 7)
 RETURNS TABLE(artist_name text, current_streams numeric, previous_streams numeric, change numeric, change_percent numeric)
 LANGUAGE sql
 STABLE
AS $function$
    WITH current_data AS (
        SELECT DISTINCT ON (artist_name)
            artist_name,
            daily_streams as current_streams,
            timestamp
        FROM artist_daily_streams
        ORDER BY artist_name, timestamp DESC
    ),
    previous_data AS (
        SELECT DISTINCT ON (artist_name)
            artist_name,
            daily_streams as previous_streams
        FROM artist_daily_streams
        WHERE timestamp < NOW() - (p_days || ' days')::INTERVAL
        ORDER BY artist_name, timestamp DESC
    )
    SELECT 
        c.artist_name,
        c.current_streams,
        p.previous_streams,
        (c.current_streams - p.previous_streams) as change,
        ROUND(((c.current_streams - p.previous_streams) / p.previous_streams * 100)::NUMERIC, 2) as change_percent
    FROM current_data c
    JOIN previous_data p ON c.artist_name = p.artist_name
    ORDER BY change DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_artist_volume(p_artist_name text, p_amount double precision)
 RETURNS void
 LANGUAGE sql
AS $function$                                                                                                      
    UPDATE artists_with_history
    SET volume = COALESCE(volume, 0) + p_amount                                                                           
    WHERE artist_name = p_artist_name;                      
  $function$
;

CREATE OR REPLACE FUNCTION public.increment_artist_volume(p_spotify_id text, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_amount is null or p_amount = 'NaN'::numeric or p_amount < 0 then
    return;
  end if;
  update public.artists_with_history
     set volume = coalesce(volume, 0) + p_amount
   where spotify_id = p_spotify_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.index_history_drift()
 RETURNS TABLE(check_name text, detail text, magnitude bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  -- The trigger's own health: an artist written today whose point never
  -- reached the history table. Index scan on last_updated, ~1 ms.
  select 'points_missing_today'::text,
         'artists updated today with no artist_index_history row for today'::text,
         count(*)::bigint
  from public.artists_with_history a
  where a.last_updated >= date_trunc('day', now())
    and not exists (
      select 1 from public.artist_index_history h
      where h.spotify_id = a.spotify_id
        and h.ts >= date_trunc('day', now())
    )
  having count(*) > 0

  union all
  -- Nothing written anywhere for 36 hours. exists() over the BRIN index, ~3 ms.
  -- The feed failed 7 of the 15 runs before 2026-08-09 (07-28 through 08-02,
  -- and 08-06), writing nothing at all on 08-01 and 08-02, and no one knew.
  -- This is the check that would have said so.
  select 'catalog_stale'::text,
         'no index point written anywhere in the last 36 hours'::text,
         1::bigint
  where not exists (
    select 1 from public.artist_index_history
    where ts >= now() - interval '36 hours'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.index_history_reconcile()
 RETURNS TABLE(check_name text, detail text, magnitude bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with j as (
    select a.spotify_id, (dp->>'timestamp')::timestamptz as ts, (dp->>'index')::numeric as idx
    from public.artists_with_history a,
         lateral jsonb_array_elements(coalesce(a.data_points, '[]'::jsonb)) dp
    where dp->>'index' ~ '^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$'
      and dp->>'timestamp' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}'
  )
  select 'points_missing_from_history', 'in data_points, absent from artist_index_history',
         count(*)::bigint
  from j left join public.artist_index_history h
    on h.spotify_id = j.spotify_id and h.ts = j.ts
  where h.spotify_id is null
  having count(*) > 0

  union all
  select 'history_rows_without_source', 'in artist_index_history, absent from data_points',
         count(*)::bigint
  from public.artist_index_history h
  left join j on j.spotify_id = h.spotify_id and j.ts = h.ts
  where j.spotify_id is null
  having count(*) > 0

  union all
  select 'value_mismatch', 'same (spotify_id, ts), different index',
         count(*)::bigint
  from j join public.artist_index_history h
    on h.spotify_id = j.spotify_id and h.ts = j.ts
  where h.index is distinct from j.idx
  having count(*) > 0;
$function$
;

CREATE OR REPLACE FUNCTION public.match_order_atomic(p_artist_name character varying, p_side character varying, p_order_type character varying, p_price numeric, p_quantity integer)
 RETURNS TABLE(matched_order_id uuid, matched_price numeric, matched_quantity integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_remaining_qty INTEGER := p_quantity;
  v_maker_order RECORD;
BEGIN
  -- Lock the relevant orders for this artist
  -- FOR UPDATE locks rows, preventing other transactions from modifying them
  
  IF p_side = 'buy' THEN
    -- For buy orders, match against sell orders (asks)
    FOR v_maker_order IN
      SELECT * FROM public.orders
      WHERE artist_name = p_artist_name
        AND side = 'sell'
        AND status IN ('open', 'partial')
        AND remaining_quantity > 0
        AND (
          p_order_type = 'market' 
          OR price <= p_price
        )
      ORDER BY price ASC, created_at ASC
      FOR UPDATE SKIP LOCKED  -- Skip rows that are locked by other transactions
    LOOP
      EXIT WHEN v_remaining_qty = 0;
      
      -- Calculate match quantity
      DECLARE
        v_match_qty INTEGER := LEAST(v_remaining_qty, v_maker_order.remaining_quantity);
      BEGIN
        -- Update maker order
        UPDATE public.orders
        SET 
          filled_quantity = filled_quantity + v_match_qty,
          remaining_quantity = remaining_quantity - v_match_qty,
          status = CASE 
            WHEN remaining_quantity - v_match_qty = 0 THEN 'filled'
            ELSE 'partial'
          END,
          updated_at = NOW()
        WHERE id = v_maker_order.id;
        
        -- Return match result
        matched_order_id := v_maker_order.id;
        matched_price := v_maker_order.price;
        matched_quantity := v_match_qty;
        RETURN NEXT;
        
        v_remaining_qty := v_remaining_qty - v_match_qty;
      END;
    END LOOP;
    
  ELSE -- p_side = 'sell'
    -- For sell orders, match against buy orders (bids)
    FOR v_maker_order IN
      SELECT * FROM public.orders
      WHERE artist_name = p_artist_name
        AND side = 'buy'
        AND status IN ('open', 'partial')
        AND remaining_quantity > 0
        AND (
          p_order_type = 'market'
          OR price >= p_price
        )
      ORDER BY price DESC, created_at ASC
      FOR UPDATE SKIP LOCKED
    LOOP
      EXIT WHEN v_remaining_qty = 0;
      
      DECLARE
        v_match_qty INTEGER := LEAST(v_remaining_qty, v_maker_order.remaining_quantity);
      BEGIN
        UPDATE public.orders
        SET 
          filled_quantity = filled_quantity + v_match_qty,
          remaining_quantity = remaining_quantity - v_match_qty,
          status = CASE 
            WHEN remaining_quantity - v_match_qty = 0 THEN 'filled'
            ELSE 'partial'
          END,
          updated_at = NOW()
        WHERE id = v_maker_order.id;
        
        matched_order_id := v_maker_order.id;
        matched_price := v_maker_order.price;
        matched_quantity := v_match_qty;
        RETURN NEXT;
        
        v_remaining_qty := v_remaining_qty - v_match_qty;
      END;
    END LOOP;
  END IF;
  
  RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pct_change_from(p_spotify_id text, p_current numeric, p_interval interval)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- The point at or immediately before the window boundary; one index
  -- lookup instead of a full array scan.
  select case
           when prev.index is null or prev.index = 0 then null
           else round(((p_current - prev.index) / prev.index) * 100, 4)
         end
    from (
      select index
        from public.artist_index_history
       where spotify_id = p_spotify_id
         and ts <= now() - p_interval
       order by ts desc
       limit 1
    ) prev;
$function$
;

CREATE OR REPLACE FUNCTION public.pct_change_since(p_points jsonb, p_current numeric, p_cutoff timestamp with time zone)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  with baseline as (
    select (e->>'index')::numeric as idx
    from jsonb_array_elements(p_points) e
    where (e->>'timestamp')::timestamptz <= p_cutoff
    order by (e->>'timestamp')::timestamptz desc
    limit 1
  )
  select case
    when (select idx from baseline) is null then null
    when (select idx from baseline) = 0     then null
    else round(((p_current - (select idx from baseline)) / (select idx from baseline)) * 100, 6)
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.place_order_tx(p_user_id uuid, p_spotify_id text, p_side text, p_quantity numeric, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_qty            numeric;
  v_price          numeric;
  v_artist_name    text;
  v_balance        numeric;
  v_pos            public.positions;
  v_is_long        boolean;
  v_same_side      boolean;
  v_cash_delta     numeric := 0;
  v_realized_pnl   numeric := 0;
  v_notional       numeric;
  v_qty_to_close   numeric;
  v_portion_cost   numeric;
  v_proceeds       numeric;
  v_flip_qty       numeric;
  v_flip_cost      numeric;
  v_new_contracts  numeric;
  v_new_total_cost numeric;
  v_position_id    uuid;
  v_action         text;
  v_cached         jsonb;
  v_result         jsonb;
  v_now            timestamptz := now();
begin
  -- ---- input validation -------------------------------------------------
  -- The route used `!quantity` and `quantity <= 0`, which a non-numeric
  -- value passes (NaN comparisons are false), producing NaN -> NULL and
  -- bricking the balance. Validate hard here so no caller can bypass it.
  if p_side not in ('buy', 'sell') then
    raise exception 'invalid side: %', p_side using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity = 'NaN'::numeric then
    raise exception 'quantity must be a number' using errcode = '22023';
  end if;

  v_qty := round(p_quantity, 2);
  if v_qty <= 0 then
    raise exception 'quantity must be greater than zero' using errcode = '22023';
  end if;
  if v_qty > 1000000 then
    raise exception 'quantity exceeds the maximum of 1,000,000' using errcode = '22023';
  end if;

  -- ---- idempotency replay ----------------------------------------------
  if p_idempotency_key is not null then
    select response into v_cached from public.idempotency_keys
      where key = p_idempotency_key and expires_at > v_now;
    if v_cached is not null then
      return v_cached || jsonb_build_object('replayed', true);
    end if;
  end if;

  -- ---- serialise all of this user's money movement ----------------------
  -- Transaction-scoped: released automatically on commit or rollback, so a
  -- validation failure can never leave a stuck lock (the Redis lock it
  -- replaces was only released inside a narrow finally block, so every
  -- early return held it for the full TTL).
  perform pg_advisory_xact_lock(hashtext('sonotrade:user:' || p_user_id::text));

  select balance into v_balance from public.users where id = p_user_id for update;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  -- ---- price: server-derived, and it must be real -----------------------
  select current_index_value, artist_name into v_price, v_artist_name
    from public.artists_with_history where spotify_id = p_spotify_id;
  if not found then
    raise exception 'artist not found' using errcode = 'P0002';
  end if;
  -- current_index_value is nullable (an artist whose data_points is empty,
  -- or whose ingest failed). The read routes all guard with `?? 0`; the
  -- trade routes did a bare parseFloat -> NaN -> NULL balance.
  if v_price is null or v_price = 'NaN'::numeric or v_price <= 0 then
    raise exception 'price unavailable for %', p_spotify_id using errcode = '55000';
  end if;

  v_notional := round(v_price * v_qty, 2);
  if v_notional <= 0 then
    raise exception 'order value rounds to zero — increase the quantity' using errcode = '22023';
  end if;

  -- The partial unique index from part 1 guarantees at most one open row.
  select * into v_pos from public.positions
    where user_id = p_user_id and spotify_id = p_spotify_id and status = 'open'
    for update;

  if v_pos.id is null then
    -- ============ open a brand-new position ============
    if v_balance < v_notional then
      raise exception 'insufficient funds: need %, have %', v_notional, v_balance
        using errcode = '23514';
    end if;
    v_cash_delta := -v_notional;
    v_action := case when p_side = 'buy' then 'open_long' else 'open_short' end;

    insert into public.positions (
      user_id, spotify_id, artist_name, position_type, contracts,
      entry_price, total_cost, status, opened_at, updated_at
    ) values (
      p_user_id, p_spotify_id, v_artist_name,
      case when p_side = 'buy' then 'long' else 'short' end,
      v_qty, v_price, v_notional, 'open', v_now, v_now
    ) returning id into v_position_id;

  else
    v_is_long   := (v_pos.position_type = 'long');
    v_same_side := (v_is_long and p_side = 'buy') or (not v_is_long and p_side = 'sell');
    v_position_id := v_pos.id;

    if v_same_side then
      -- ============ add to the existing position ============
      if v_balance < v_notional then
        raise exception 'insufficient funds: need %, have %', v_notional, v_balance
          using errcode = '23514';
      end if;
      v_cash_delta     := -v_notional;
      v_new_contracts  := round(v_pos.contracts + v_qty, 2);
      -- Running sum of real debits. The old code recomputed this as
      -- round(avg_price * contracts), which did not equal the cash taken.
      v_new_total_cost := round(v_pos.total_cost + v_notional, 2);
      v_action := case when v_is_long then 'add_long' else 'add_short' end;

      update public.positions set
        contracts   = v_new_contracts,
        total_cost  = v_new_total_cost,
        entry_price = round(v_new_total_cost / v_new_contracts, 8),
        updated_at  = v_now
      where id = v_pos.id;

    else
      -- ============ opposite side: reduce, close, or flip ============
      v_qty_to_close := least(v_qty, v_pos.contracts);
      v_portion_cost := round(v_pos.total_cost * (v_qty_to_close / v_pos.contracts), 2);

      if v_is_long then
        -- Selling longs: receive market value for the closed portion.
        v_proceeds := round(v_price * v_qty_to_close, 2);
      else
        -- Buying back shorts: margin portion returned, adjusted by the
        -- price move, floored at zero so a runaway short cannot drive the
        -- balance negative (there is no margin engine and no liquidation
        -- job in this system).
        v_proceeds := greatest(
          0,
          round(v_portion_cost + (round(v_pos.total_cost / v_pos.contracts, 8) - v_price) * v_qty_to_close, 2)
        );
      end if;

      v_realized_pnl := round(v_proceeds - v_portion_cost, 2);
      v_cash_delta   := v_proceeds;

      if v_qty < v_pos.contracts then
        -- partial reduction
        v_new_contracts  := round(v_pos.contracts - v_qty_to_close, 2);
        v_new_total_cost := round(v_pos.total_cost - v_portion_cost, 2);
        v_action := case when v_is_long then 'reduce_long' else 'reduce_short' end;

        update public.positions set
          contracts   = v_new_contracts,
          total_cost  = v_new_total_cost,
          entry_price = round(v_new_total_cost / v_new_contracts, 8),
          updated_at  = v_now
        where id = v_pos.id;

      else
        -- full close (and possibly a flip)
        v_action := case when v_is_long then 'close_long' else 'close_short' end;

        update public.positions set
          status         = 'closed',
          current_price  = v_price,
          unrealized_pnl = v_realized_pnl,
          closed_at      = v_now,
          updated_at     = v_now
        where id = v_pos.id;

        if v_qty > v_pos.contracts then
          v_flip_qty  := round(v_qty - v_pos.contracts, 2);
          v_flip_cost := round(v_price * v_flip_qty, 2);
          if v_balance + v_cash_delta < v_flip_cost then
            raise exception 'insufficient funds to flip: need %, have %',
              v_flip_cost, round(v_balance + v_cash_delta, 2) using errcode = '23514';
          end if;
          v_cash_delta := round(v_cash_delta - v_flip_cost, 2);
          v_action := case when p_side = 'buy' then 'flip_to_long' else 'flip_to_short' end;

          insert into public.positions (
            user_id, spotify_id, artist_name, position_type, contracts,
            entry_price, total_cost, status, opened_at, updated_at
          ) values (
            p_user_id, p_spotify_id, v_artist_name,
            case when p_side = 'buy' then 'long' else 'short' end,
            v_flip_qty, v_price, v_flip_cost, 'open', v_now, v_now
          ) returning id into v_position_id;
        end if;
      end if;
    end if;
  end if;

  -- ---- apply the balance change (same transaction) ----------------------
  update public.users set
    balance      = round(balance + v_cash_delta, 2),
    total_volume = coalesce(total_volume, 0) + v_notional,
    total_pnl    = coalesce(total_pnl, 0) + v_realized_pnl,
    updated_at   = v_now
  where id = p_user_id
  returning balance into v_balance;

  if v_balance < 0 then
    raise exception 'trade would make balance negative (%)', v_balance using errcode = '23514';
  end if;

  -- ---- market volume ---------------------------------------------------
  update public.artists_with_history
     set volume = coalesce(volume, 0) + v_notional
   where spotify_id = p_spotify_id;

  -- ---- audit trail -----------------------------------------------------
  insert into public.trade_ledger (
    user_id, spotify_id, position_id, action, quantity, price,
    cash_delta, realized_pnl, balance_after, idempotency_key
  ) values (
    p_user_id, p_spotify_id, v_position_id, v_action, v_qty, v_price,
    v_cash_delta, v_realized_pnl, v_balance, p_idempotency_key
  );

  v_result := jsonb_build_object(
    'success', true,
    'action', v_action,
    'position_id', v_position_id,
    'filled_quantity', v_qty,
    'price', v_price,
    'cash_delta', v_cash_delta,
    'realized_pnl', v_realized_pnl,
    'balance', v_balance
  );

  if p_idempotency_key is not null then
    insert into public.idempotency_keys (key, user_id, endpoint, response)
      values (p_idempotency_key, p_user_id, 'orders/place', v_result)
      on conflict (key) do nothing;
  end if;

  return v_result;
end $function$
;

CREATE OR REPLACE FUNCTION public.place_order_v2(p_user_id uuid, p_spotify_id text, p_side text, p_quantity numeric DEFAULT NULL::numeric, p_notional numeric DEFAULT NULL::numeric, p_expected_price numeric DEFAULT NULL::numeric, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_price numeric;
  v_qty   numeric;
begin
  if (p_quantity is null) = (p_notional is null) then
    raise exception 'pass exactly one of quantity or notional' using errcode = '22023';
  end if;

  select a.current_index_value into v_price
  from public.artists_with_history a
  where a.spotify_id = p_spotify_id;

  if v_price is null or v_price <= 0 then
    raise exception 'price unavailable for %', p_spotify_id using errcode = '55000';
  end if;

  -- Slippage: reject if the live price has moved more than 1% from what the
  -- user's screen showed. Without this, a price that ticks between render and
  -- submit fills at a number the user never saw.
  if p_expected_price is not null and p_expected_price > 0
     and abs(v_price - p_expected_price) * 100 > p_expected_price then
    raise exception 'price just updated — review and confirm again' using errcode = '40001';
  end if;

  if p_notional is not null then
    if p_notional <= 0 then
      raise exception 'notional must be greater than zero' using errcode = '22023';
    end if;
    -- FLOOR, not round. place_order_tx charges quantity * price, and quantity
    -- carries 2 decimals, so rounding up overshoots the amount the user asked
    -- to spend: $100 at 45.464326 rounds to 2.2 contracts and bills $100.02.
    -- Harmless there, fatal at "spend my whole balance" — the order would fail
    -- on insufficient funds for a cent the user never agreed to.
    v_qty := floor(p_notional / v_price * 100) / 100;
    if v_qty <= 0 then
      raise exception 'order too small for this price — increase the amount'
        using errcode = '22023';
    end if;
  else
    v_qty := p_quantity;
  end if;

  -- Delegates to the audited path: advisory lock, FOR UPDATE on balance and
  -- position, ledger row, sqlstate error contract. All of it still applies.
  return public.place_order_tx(p_user_id, p_spotify_id, p_side, v_qty, p_idempotency_key);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.poller_ingest(p_items jsonb)
 RETURNS TABLE(hot_updated integer, cold_updated integer, priced_today integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_now   timestamptz := now();
  v_start timestamptz := date_trunc('day', now());
  v_hot   integer := 0;
  v_cold  integer := 0;
  v_today integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array' using errcode = '22023';
  end if;

  -- ---- hot path: price, listeners, and today's data point ----------------
  -- One point per artist per UTC day. A second run on the same day refreshes
  -- metadata and leaves the point alone — the rule the Python already applied,
  -- moved here so it holds regardless of caller.
  with input as (
    select distinct on (x.spotify_id) x.spotify_id, x.index_value,
           x.monthly_listeners, x.followers
    from jsonb_to_recordset(p_items) as x(
      spotify_id text, index_value numeric,
      monthly_listeners bigint, followers bigint
    )
    where x.spotify_id is not null and x.index_value is not null
    order by x.spotify_id
  ),
  upd as (
    update public.artists_with_history a
    set
      current_index_value = greatest(i.index_value, 0.01),
      monthly_listeners   = coalesce(i.monthly_listeners, a.monthly_listeners),
      followers           = coalesce(i.followers, a.followers),
      last_updated        = v_now,
      data_points = case
        when jsonb_typeof(a.data_points) = 'array'
         and jsonb_array_length(a.data_points) > 0
         and (a.data_points -> -1 ->> 'timestamp')::timestamptz >= v_start
        then a.data_points
        else coalesce(a.data_points, '[]'::jsonb) || jsonb_build_array(
               jsonb_build_object('index', greatest(i.index_value, 0.01),
                                  'timestamp', v_now))
      end
    from input i
    where a.spotify_id = i.spotify_id
    returning 1
  )
  select count(*)::int into v_hot from upd;

  -- ---- cold path: metadata, written only where it differs ---------------
  -- coalesce(new, old) on every column: a field missing from the response
  -- means "Apify did not report it", never "delete what we have".
  with input as (
    select distinct on (x.spotify_id) x.*
    from jsonb_to_recordset(p_items) as x(
      spotify_id text,
      spotify_img text, verified boolean, header_image text, biography text,
      facebook text, instagram text, twitter text, tiktok text,
      wikipedia text, other text,
      gallery jsonb, top_cities jsonb, related jsonb, releases jsonb,
      top_tracks jsonb, discovered_on jsonb, appears_on jsonb, events jsonb
    )
    where x.spotify_id is not null
    order by x.spotify_id
  ),
  upd as (
    update public.artists_with_history a
    set
      spotify_img   = coalesce(i.spotify_img,   a.spotify_img),
      verified      = coalesce(i.verified,      a.verified),
      header_image  = coalesce(i.header_image,  a.header_image),
      biography     = coalesce(i.biography,     a.biography),
      facebook      = coalesce(i.facebook,      a.facebook),
      instagram     = coalesce(i.instagram,     a.instagram),
      twitter       = coalesce(i.twitter,       a.twitter),
      tiktok        = coalesce(i.tiktok,        a.tiktok),
      wikipedia     = coalesce(i.wikipedia,     a.wikipedia),
      other         = coalesce(i.other,         a.other),
      gallery       = coalesce(i.gallery,       a.gallery),
      top_cities    = coalesce(i.top_cities,    a.top_cities),
      related       = coalesce(i.related,       a.related),
      releases      = coalesce(i.releases,      a.releases),
      top_tracks    = coalesce(i.top_tracks,    a.top_tracks),
      discovered_on = coalesce(i.discovered_on, a.discovered_on),
      appears_on    = coalesce(i.appears_on,    a.appears_on),
      events        = coalesce(i.events,        a.events)
    from input i
    where a.spotify_id = i.spotify_id
      and (
        coalesce(i.spotify_img,   a.spotify_img),
        coalesce(i.verified,      a.verified),
        coalesce(i.header_image,  a.header_image),
        coalesce(i.biography,     a.biography),
        coalesce(i.facebook,      a.facebook),
        coalesce(i.instagram,     a.instagram),
        coalesce(i.twitter,       a.twitter),
        coalesce(i.tiktok,        a.tiktok),
        coalesce(i.wikipedia,     a.wikipedia),
        coalesce(i.other,         a.other),
        coalesce(i.gallery,       a.gallery),
        coalesce(i.top_cities,    a.top_cities),
        coalesce(i.related,       a.related),
        coalesce(i.releases,      a.releases),
        coalesce(i.top_tracks,    a.top_tracks),
        coalesce(i.discovered_on, a.discovered_on),
        coalesce(i.appears_on,    a.appears_on),
        coalesce(i.events,        a.events)
      ) is distinct from (
        a.spotify_img, a.verified, a.header_image, a.biography,
        a.facebook, a.instagram, a.twitter, a.tiktok, a.wikipedia, a.other,
        a.gallery, a.top_cities, a.related, a.releases, a.top_tracks,
        a.discovered_on, a.appears_on, a.events
      )
    returning 1
  )
  select count(*)::int into v_cold from upd;

  -- How many of the artists in this batch now carry a point dated today.
  -- Reported so the caller can gate on coverage rather than on HTTP 200.
  select count(*)::int into v_today
  from public.artists_with_history a
  where a.spotify_id in (
          select value ->> 'spotify_id' from jsonb_array_elements(p_items)
        )
    and jsonb_typeof(a.data_points) = 'array'
    and jsonb_array_length(a.data_points) > 0
    and (a.data_points -> -1 ->> 'timestamp')::timestamptz >= v_start;

  return query select v_hot, v_cold, v_today;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.purge_expired_idempotency_keys()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_n integer;
begin
  delete from public.idempotency_keys where expires_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end $function$
;

CREATE OR REPLACE FUNCTION public.recalculate_change_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
  BEGIN
    NEW.change_1h = public.compute_change(NEW.data_points, 1);
    NEW.change_1d = public.compute_change(NEW.data_points, 24);                                        
    NEW.change_1w = public.compute_change(NEW.data_points, 168);
    NEW.change_1m = public.compute_change(NEW.data_points, 720);                                       
    NEW.change_1y = public.compute_change(NEW.data_points, 8760);
    RETURN NEW;                                                                                        
  END;                                                      
  $function$
;

CREATE OR REPLACE FUNCTION public.recalculate_user_pnl(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
  BEGIN
    UPDATE users
    SET
      total_pnl = COALESCE((SELECT SUM(unrealized_pnl) FROM positions WHERE user_id = p_user_id), 0),
      total_volume = COALESCE((SELECT SUM(total_cost) FROM positions WHERE user_id = p_user_id), 0)
    WHERE id = p_user_id;
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.recompute_artist_changes(p_spotify_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current numeric;
begin
  select index into v_current
    from public.artist_index_history
   where spotify_id = p_spotify_id
   order by ts desc limit 1;

  if v_current is null then
    return;
  end if;

  update public.artists_with_history a set
    current_index_value = v_current,
    change_1h = public.pct_change_from(p_spotify_id, v_current, interval '1 hour'),
    change_1d = public.pct_change_from(p_spotify_id, v_current, interval '1 day'),
    change_1w = public.pct_change_from(p_spotify_id, v_current, interval '7 days'),
    change_1m = public.pct_change_from(p_spotify_id, v_current, interval '30 days'),
    change_1y = public.pct_change_from(p_spotify_id, v_current, interval '365 days')
  where a.spotify_id = p_spotify_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.recompute_change_columns(p_spotify_ids text[] DEFAULT NULL::text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_now   timestamptz := now();
  v_ids   text[];
  v_chunk text[];
  v_total integer := 0;
  v_n     integer;
  v_i     integer;
begin
  if p_spotify_ids is null then
    select array_agg(a.spotify_id) into v_ids from public.artists_with_history a;
  else
    v_ids := p_spotify_ids;
  end if;

  for v_i in 1 .. coalesce(array_length(v_ids, 1), 0) by 200 loop
  v_chunk := v_ids[v_i : v_i + 199];

  with calc as (
    select
      a.spotify_id,
      a.current_index_value::numeric as cur,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id
        order by h.ts asc limit 1) as first_index,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '1 hour'
        order by h.ts desc limit 1) as p_1h,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '1 day'
        order by h.ts desc limit 1) as p_1d,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '7 days'
        order by h.ts desc limit 1) as p_1w,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '30 days'
        order by h.ts desc limit 1) as p_1m,
      (select h.index from public.artist_index_history h
        where h.spotify_id = a.spotify_id and h.ts <= v_now - interval '365 days'
        order by h.ts desc limit 1) as p_1y
    from public.artists_with_history a
    where a.spotify_id = any(v_chunk)
      and a.current_index_value is not null
  ),
  pct as (
    select
      c.spotify_id,
      case when coalesce(c.p_1h, c.first_index) is null or coalesce(c.p_1h, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1h, c.first_index)) / coalesce(c.p_1h, c.first_index)) * 100 end as ch_1h,
      case when coalesce(c.p_1d, c.first_index) is null or coalesce(c.p_1d, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1d, c.first_index)) / coalesce(c.p_1d, c.first_index)) * 100 end as ch_1d,
      case when coalesce(c.p_1w, c.first_index) is null or coalesce(c.p_1w, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1w, c.first_index)) / coalesce(c.p_1w, c.first_index)) * 100 end as ch_1w,
      case when coalesce(c.p_1m, c.first_index) is null or coalesce(c.p_1m, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1m, c.first_index)) / coalesce(c.p_1m, c.first_index)) * 100 end as ch_1m,
      case when coalesce(c.p_1y, c.first_index) is null or coalesce(c.p_1y, c.first_index) = 0
           then null else ((c.cur - coalesce(c.p_1y, c.first_index)) / coalesce(c.p_1y, c.first_index)) * 100 end as ch_1y
    from calc c
  ),
  upd as (
    update public.artists_with_history a
    set change_1h = p.ch_1h,
        change_1d = p.ch_1d,
        change_1w = p.ch_1w,
        change_1m = p.ch_1m,
        change_1y = p.ch_1y
    from pct p
    where a.spotify_id = p.spotify_id
      -- Only touch rows whose numbers actually moved. Six indexes cover these
      -- columns; rewriting all 2,526 rows daily to change none of them is the
      -- churn this file exists to remove.
      and (a.change_1h, a.change_1d, a.change_1w, a.change_1m, a.change_1y)
          is distinct from (p.ch_1h, p.ch_1d, p.ch_1w, p.ch_1m, p.ch_1y)
    returning 1
  )
  select count(*)::int into v_n from upd;

  v_total := v_total + coalesce(v_n, 0);
  end loop;

  return v_total;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_artists_view()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY artists_with_history;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_orderbook_summary()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY orderbook_summary;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.scraper_ingest(p_spotify_id text, p_artist_name text, p_monthly_listeners bigint, p_index numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now   timestamptz := now();
  v_pts   jsonb;
begin
  -- 1. raw observation (audit trail + recomputation source)
  insert into artist_daily_streams (artist_name, index, timestamp, created_at)
  values (p_artist_name, p_index, v_now, v_now);

  -- 2. append the new point, keeping the array chronological
  select coalesce(data_points, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('timestamp', v_now, 'index', p_index))
    into v_pts
  from artists_with_history
  where spotify_id = p_spotify_id
  for update;

  if v_pts is null then
    raise exception 'unknown artist %', p_spotify_id;
  end if;

  -- 3 + 4. snapshot columns and the change windows, derived from v_pts.
  -- Each change_* is (now vs the last point at//before the cutoff), in percent.
  -- NB: current_index_value is a GENERATED column —
  --   data_points[last]->>'index'
  -- so appending the point below IS how the price updates. Never assign it
  -- directly (Postgres rejects writes to generated columns, 428C9), and keep
  -- data_points chronological: the LAST element defines the current price.
  update artists_with_history a
  set data_points        = v_pts,
      monthly_listeners   = p_monthly_listeners,
      last_updated        = v_now,
      change_1h = pct_change_since(v_pts, p_index, v_now - interval '1 hour'),
      change_1d = pct_change_since(v_pts, p_index, v_now - interval '1 day'),
      change_1w = pct_change_since(v_pts, p_index, v_now - interval '7 days'),
      change_1m = pct_change_since(v_pts, p_index, v_now - interval '30 days'),
      change_1y = pct_change_since(v_pts, p_index, v_now - interval '365 days')
  where a.spotify_id = p_spotify_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.scraper_ingest_v2(p_spotify_id text, p_index numeric, p_listeners bigint DEFAULT NULL::bigint, p_ts timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_index is null or p_index = 'NaN'::numeric or p_index < 0 then
    raise exception 'scraper_ingest_v2: invalid index %', p_index using errcode = '22023';
  end if;

  -- One point per artist per day; a same-day re-run overwrites rather than
  -- appending a duplicate.
  insert into public.artist_index_history (spotify_id, ts, index)
    values (p_spotify_id, date_trunc('day', p_ts), p_index)
    on conflict (spotify_id, ts) do update set index = excluded.index;

  -- ON CONFLICT has to name the same immutable expression the unique index in
  -- part 1 was built on, or Postgres cannot infer the arbiter.
  insert into public.artist_daily_streams (artist_name, index, "timestamp")
    select a.artist_name, p_index, date_trunc('day', p_ts)
      from public.artists_with_history a
     where a.spotify_id = p_spotify_id
  on conflict (artist_name, ((timezone('UTC', "timestamp"))::date)) do update
    set index = excluded.index;

  update public.artists_with_history
     set monthly_listeners = coalesce(p_listeners, monthly_listeners),
         last_updated = greatest(last_updated, p_ts)
   where spotify_id = p_spotify_id;

  perform public.recompute_artist_changes(p_spotify_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.sonotrade_invariants()
 RETURNS TABLE(check_name text, entity text, detail text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  -- 1. Cash must equal the ledger's own running balance. place_order_tx and
  --    close_position_tx both stamp balance_after; if users.balance has drifted
  --    from it, something wrote a balance outside the trade RPCs.
  select 'balance_vs_ledger'::text,
         coalesce(u.username, u.id::text)::text,
         ('balance=' || u.balance || ' last_ledger_balance_after=' || l.balance_after)::text
  from public.users u
  join lateral (
    select t.balance_after
    from public.trade_ledger t
    where t.user_id = u.id
    order by t.created_at desc, t.id desc
    limit 1
  ) l on true
  where abs(u.balance - l.balance_after) > 0.005

  union all
  -- 2. An open position's size must equal the signed sum of its ledger rows.
  --    Action vocabulary is open_long/open_short/add_long/add_short (increase)
  --    and close_*/reduce_* (decrease) — read off the live table, not guessed.
  select 'position_qty_vs_ledger',
         p.spotify_id,
         'contracts=' || p.contracts || ' ledger_qty=' || coalesce(x.qty, 0)
  from public.positions p
  left join lateral (
    select sum(case
                 when t.action like 'open%' or t.action like 'add%'    then t.quantity
                 when t.action like 'close%' or t.action like 'reduce%' then -t.quantity
                 else 0
               end) as qty
    from public.trade_ledger t
    where t.position_id = p.id
  ) x on true
  where p.status = 'open'
    and abs(p.contracts - coalesce(x.qty, 0)) > 0.005

  union all
  -- 3. total_cost is the running sum of cash actually debited — never an
  --    average price multiplied back out. That recomputation is exactly where
  --    the pre-hardening rounding drift came from.
  select 'total_cost_vs_cash_debited',
         p.spotify_id,
         'total_cost=' || p.total_cost || ' cash_out=' || round(-coalesce(x.cash, 0), 2)
  from public.positions p
  left join lateral (
    select sum(t.cash_delta) as cash
    from public.trade_ledger t
    where t.position_id = p.id
  ) x on true
  where p.status = 'open'
    and abs(p.total_cost + coalesce(x.cash, 0)) > 0.02

  union all
  -- 4. The balance CHECK constraint is NOT VALID on this table, so it is not
  --    enforced for pre-existing rows. Verify rather than assume.
  select 'negative_balance',
         coalesce(u.username, u.id::text),
         'balance=' || u.balance
  from public.users u
  where u.balance < 0

  union all
  -- 5. The 0.01 floor, checked rather than trusted. Three separate things now
  --    enforce it (the poller, poller_ingest, and trg_zz_clamp_*); this is what
  --    notices if all three are bypassed.
  select 'index_below_floor',
         a.spotify_id,
         'current_index_value=' || a.current_index_value
  from public.artists_with_history a
  where a.current_index_value is not null
    and a.current_index_value < 0.01

  union all
  -- 6. An open position on a market with no usable price cannot be closed:
  --    close_position_tx raises 55000 and the user is stuck holding it.
  select 'open_position_unpriced',
         p.spotify_id,
         'position=' || p.id || ' price=' || coalesce(a.current_index_value::text, 'null')
  from public.positions p
  join public.artists_with_history a on a.spotify_id = p.spotify_id
  where p.status = 'open'
    and (a.current_index_value is null or a.current_index_value <= 0)

  union all
  -- 7. At most one open position per user per artist. A partial unique index
  --    from hardening part 1 is supposed to guarantee this, and close_position_tx
  --    resolves a position by spotify_id on that assumption — so if the index
  --    is not actually live, closes would hit the wrong row.
  select 'duplicate_open_position',
         p.spotify_id,
         'user=' || p.user_id || ' open_rows=' || count(*)
  from public.positions p
  where p.status = 'open'
  group by p.user_id, p.spotify_id
  having count(*) > 1

  union all
  -- 8. The tradeable price and the newest charted point must agree. They are
  --    written by the same statement in poller_ingest, so a divergence means
  --    another writer moved one without the other.
  select 'price_vs_newest_history',
         a.spotify_id,
         'current=' || a.current_index_value || ' newest_point=' || h.index
  from public.artists_with_history a
  join lateral (
    select h2.index
    from public.artist_index_history h2
    where h2.spotify_id = a.spotify_id
    order by h2.ts desc
    limit 1
  ) h on true
  where a.current_index_value is not null
    and abs(a.current_index_value - h.index) > greatest(0.01, a.current_index_value * 0.05);
$function$
;

CREATE OR REPLACE FUNCTION public.sync_artists_with_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$           
  DECLARE
    new_dp jsonb;
  BEGIN
    INSERT INTO public.artists_with_history (artist_name, last_updated, data_points)
    VALUES (                                                                                                              
      NEW.artist_name,
      NEW.timestamp,                                                                                                      
      jsonb_build_array(jsonb_build_object('index', NEW.index, 'timestamp', NEW.timestamp))
    )                                                                                                                     
    ON CONFLICT (artist_name) DO UPDATE
      SET                                                                                                                 
        last_updated = GREATEST(artists_with_history.last_updated, NEW.timestamp),
        data_points  = CASE
          WHEN NEW.timestamp > artists_with_history.last_updated                                                          
            THEN artists_with_history.data_points
                 || jsonb_build_array(jsonb_build_object('index', NEW.index, 'timestamp', NEW.timestamp))                 
          ELSE artists_with_history.data_points                                                                           
        END;
                                                                                                                          
    -- Re-read the updated data_points for this artist                                                                    
    SELECT data_points INTO new_dp
    FROM public.artists_with_history                                                                                      
    WHERE artist_name = NEW.artist_name;
                                                                                                                          
    -- Recalculate all change columns
    UPDATE public.artists_with_history                                                                                    
    SET           
      change_1h = public.compute_change(new_dp, 1),
      change_1d = public.compute_change(new_dp, 24),
      change_1w = public.compute_change(new_dp, 168),                                                                     
      change_1m = public.compute_change(new_dp, 720),
      change_1y = public.compute_change(new_dp, 8760)                                                                     
    WHERE artist_name = NEW.artist_name;                                                                                  
  
    RETURN NEW;                                                                                                           
  END;            
  $function$
;

CREATE OR REPLACE FUNCTION public.sync_current_index_value()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_last jsonb;
begin
  if new.data_points is not null
     and jsonb_typeof(new.data_points) = 'array'
     and jsonb_array_length(new.data_points) > 0 then
    v_last := new.data_points -> -1;
    if v_last ? 'index' then
      begin
        new.current_index_value := (v_last ->> 'index')::numeric;
      exception when others then
        -- Malformed index value in the newest point: keep whatever the writer
        -- set rather than failing the whole write.
        null;
      end;
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_comment_like_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.comments set like_count = greatest(0, like_count - 1) where id = old.comment_id;
    return old;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_comment_reply_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' and new.parent_id is not null then
    update public.comments set reply_count = reply_count + 1 where id = new.parent_id;
  elsif tg_op = 'DELETE' and old.parent_id is not null then
    update public.comments set reply_count = greatest(0, reply_count - 1) where id = old.parent_id;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.thin_old_index_history(p_older_than interval DEFAULT '2 years'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_n integer;
begin
  delete from public.artist_index_history h
   where h.ts < now() - p_older_than
     and extract(dow from h.ts) <> 1;   -- keep Mondays
  get diagnostics v_n = row_count;
  return v_n;
end $function$
;

CREATE OR REPLACE FUNCTION public.trigger_update_user_pnl()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_user_pnl(OLD.user_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM recalculate_user_pnl(NEW.user_id);
  ELSE -- UPDATE
    PERFORM recalculate_user_pnl(NEW.user_id);
    -- If user_id changed (edge case), update old user too
    IF OLD.user_id <> NEW.user_id THEN
      PERFORM recalculate_user_pnl(OLD.user_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_artist_metrics_after_history()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update or insert artist_metrics with volume from trade_history
  INSERT INTO artist_metrics (artist_name, volume, updated_at)
  VALUES (
    NEW.artist_name,
    calculate_artist_volume_24h(NEW.artist_name),
    NOW()
  )
  ON CONFLICT (artist_name)
  DO UPDATE SET
    volume = calculate_artist_volume_24h(NEW.artist_name),
    updated_at = NOW();

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_artist_metrics_after_trade()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_trade_ids UUID[];
BEGIN
  -- Get all trade IDs for this artist from the last 24 hours
  SELECT ARRAY_AGG(id)
  INTO v_trade_ids
  FROM trades
  WHERE artist_name = NEW.artist_name
    AND opened_at >= NOW() - INTERVAL '24 hours'
    AND status IN ('open', 'closed');

  -- Update or insert artist_metrics
  INSERT INTO artist_metrics (artist_name, volume, trade_ids, updated_at)
  VALUES (
    NEW.artist_name,
    calculate_artist_volume_24h(NEW.artist_name),
    v_trade_ids,
    NOW()
  )
  ON CONFLICT (artist_name)
  DO UPDATE SET
    volume = calculate_artist_volume_24h(NEW.artist_name),
    trade_ids = v_trade_ids,
    updated_at = NOW();

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_balance(p_user_id uuid, p_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new numeric;
begin
  if p_amount is null or p_amount = 'NaN'::numeric then
    raise exception 'update_balance: amount must be a real number (got %)', p_amount
      using errcode = '22023';
  end if;

  update public.users
     set balance = round(balance + p_amount, 2),
         updated_at = now()
   where id = p_user_id
  returning balance into v_new;

  if not found then
    raise exception 'update_balance: user % not found', p_user_id using errcode = 'P0002';
  end if;
  if v_new < 0 then
    raise exception 'update_balance: would make balance negative (%).', v_new
      using errcode = '23514';
  end if;
  return v_new;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_balance(p_user_id uuid, p_amount numeric, p_locked_delta numeric DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.users
  SET
    balance    = balance + p_amount,
    updated_at = now()
  WHERE id = p_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;


-- ============================== PENDING CLEANUP ==============================
-- Two functions exist as ambiguous overload pairs. PostgREST cannot resolve a
-- call by name when the argument names do not uniquely match, which is what
-- returns PGRST203 — it is the only reason update_balance was not reachable
-- with the public key before 20260809_function_execute_lockdown.sql.
--
--   update_balance(p_user_id uuid, p_amount numeric)
--   update_balance(p_user_id uuid, p_amount numeric, p_locked_delta numeric)
--   increment_artist_volume(p_spotify_id text, p_amount numeric)
--   increment_artist_volume(p_artist_name text, p_amount double precision)
--
-- NOT DROPPED, deliberately. All four are unreferenced by this repo, by
-- admin-panel, by frontend-expo, and by every other database function — but
-- track_functions is 'none', so there is no call history to confirm nothing
-- external ever calls them, and the outstanding cleanup notes flag unverified
-- mobile API consumers. They are now service_role-only, so the ambiguity is
-- no longer reachable from a client and the risk of leaving them is ~zero.
--
-- Once external consumers are confirmed dead, this is the whole cleanup:
--
--   drop function if exists public.update_balance(uuid, numeric);
--   drop function if exists public.update_balance(uuid, numeric, numeric);
--   drop function if exists public.increment_artist_volume(text, numeric);
--   drop function if exists public.increment_artist_volume(text, double precision);
--
-- Likely dead alongside them (orderbook remnants from the removed backend):
--   match_order_atomic, refresh_orderbook_summary, refresh_artists_view,
--   compute_change, compute_index_change, recalculate_change_columns
--   (the last three orphaned by 20260809_change_columns_set_based.sql).
