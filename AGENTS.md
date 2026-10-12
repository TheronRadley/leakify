# AGENTS.md — working on Leakify

## What this is

Leakify — privacy-first subscription/expense tracker. Expo SDK 57 + RN 0.86 + TypeScript
strict + Expo Router + NativeWind v4 + @rn-primitives (RNR-style UI) + Supabase (optional).

## Commands

- `npm run typecheck` · `npm run lint` · `npm test` — must all pass before shipping changes.
  `npm test` includes the database suite (`supabase/tests/`, real Postgres via PGlite).
- `npm start` dev server; `npx expo export --platform web|android` to verify bundles.
- CI mirrors these plus a non-UTC test run, secret scanning and a dependency audit report
  (`.github/workflows/ci.yml`, see `SECURITY.md`).

## Non-negotiables

1. **Money**: integer minor units + ISO currency. NEVER sum unlike currencies; NEVER add
   currency conversion without a rate source + timestamp.
2. **Financial/date logic stays pure and tested** (see `lib/`, `features/notifications/engine.ts`).
   No React Native imports in pure modules — tests run in Node (`jest-expo/node`).
3. **Honesty**: no fake bank sync, no auto-cancel claims, no "unused" detection without
   user input, savings are estimates until cancellation is confirmed.
4. **UI**: compose `components/ui/*` (RNR-style) + RN primitives. No new UI libraries.
   NativeWind classes for styling; light + dark themes via CSS vars in `global.css`.
5. **Data**: screens only touch `services/repository.ts` interfaces. Local (AsyncStorage)
   and Supabase implementations must stay behaviorally equivalent.
6. **Notifications**: schedule ONLY via `features/notifications/service.ts` +
   pure engine. Deterministic dedup keys. Never notify for canceled/paused/archived subs.
   Before wiping local data (account deletion, demo reset) call `cancelAllScheduled` FIRST —
   once the bookkeeping is gone nothing can cancel what the OS still holds.
7. **Recurrence**: step from the anchor (`anchor + n·interval`), never chained — otherwise
   month-end schedules drift. There's a test for that; keep it green.
8. Store mutations are write-through (no optimistic updates without rollback machinery).
9. Secrets: never commit service-role keys; client uses `EXPO_PUBLIC_*` anon key only,
   with RLS enforcing per-user access at the database. `.gitignore` ignores `.env*` and
   re-includes only `.env.example`.
10. **User-supplied URLs** go through `lib/links.ts` (HTTPS-only) at form time *and* at open
    time via `services/external-links.ts`. Never call `Linking.openURL` on stored data.
11. **Local storage** is read through `readStored`/`readStoredOrNull`, which validate the
    payload and THROW on corrupt data — do not swallow it into a fallback. Changing a stored
    shape means bumping `CURRENT_SCHEMA_VERSION` and adding an entry to `MIGRATIONS`.
12. **Data-mode switches** must be checked with
    `features/subscriptions/mode-transition.ts` and confirmed by the user when data would
    leave the screen. A switch never deletes; say so in the copy.
13. **Database changes** are additive migrations in `supabase/migrations/`, and
    `supabase/tests/` runs every migration against a real Postgres as two different users.
    A policy or FK change without a test there is not done.

## Layout map

Routes: `app/`. UI: `components/ui|shared|branding`. Features: `features/{subscriptions,
notifications,insights,calendar,auth}`. Domain: `lib/`, `types/`. Data: `services/`.
DB: `supabase/migrations/`.
