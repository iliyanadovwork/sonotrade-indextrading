# Sonotrade, artist index market

A paper-trading market on music-artist indexes. An artist's index price moves with
their listener numbers; users take long or short positions against it with virtual
balances. Web app, native mobile client, admin console, a daily data pipeline and a
landing site, in one monorepo.

Next.js and Supabase/Postgres on the web side, Expo / React Native on mobile.

A team project.

---

## Layout

```
frontend/         Next.js web app + Supabase schema, RPCs and migrations   (237 files)
frontend-expo/    Expo / React Native mobile client                         (68 files)
admin-panel/      operator console
landing/          marketing site
scraper/          daily listener-data pipeline
video/            generated promo media
```

## Running it

Each workspace is independent, install and run the one you need.

```bash
cd frontend && npm install && npm run dev
cd frontend-expo && npm install && npx expo start
```

Copy the `.env.example` in a workspace to `.env.local` and fill it in. Supabase
credentials are the only hard requirement for the web app to boot.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request.
Typecheck and the unit suites are blocking; lint on changed files is advisory.
`frontend-ci.yml` adds the web app's lint, typecheck and Vitest run on changes under
`frontend/`. `scraper.yml` runs the artist-index scrape on manual dispatch.

## Trading on mobile

Orders are placed from a swipe panel in the Expo client. `executeTrade()` sits behind a
build-time flag, so the panel can be driven end to end in development without moving a
balance, and a release build cannot reach that path. The chart under it renders from the
same series the web app draws, so a position opened on the phone and one opened in the
browser read the same price.

## Note on `_archived_pauv_migrations/`

That directory holds the SQL from Sonotrade's earlier prediction-market product, kept
for reference after the pivot to artist indexes. It is not applied by the current app, the exactly-once USDC crediting and hold-then-release withdrawal machinery in there
belongs to the previous venue.
