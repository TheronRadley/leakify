# AGENTS.md — working on Leakify

## What this is

Leakify — privacy-first subscription/expense tracker. Expo SDK 57 + RN 0.86 + TypeScript
strict + Expo Router + NativeWind v4 + @rn-primitives (RNR-style UI) + Supabase (optional).

## Commands

- `npm run typecheck` · `npm run lint` · `npm test` — must all pass before shipping changes.
- `npm start` dev server; `npx expo export --platform web|android` to verify bundles.

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
7. **Recurrence**: step from the anchor (`anchor + n·interval`), never chained — otherwise
   month-end schedules drift. There's a test for that; keep it green.
8. Store mutations are write-through (no optimistic updates without rollback machinery).
9. Secrets: never commit service-role keys; client uses `EXPO_PUBLIC_*` anon key only,
   with RLS enforcing per-user access at the database.

## Layout map

Routes: `app/`. UI: `components/ui|shared|branding`. Features: `features/{subscriptions,
notifications,insights,calendar,auth}`. Domain: `lib/`, `types/`. Data: `services/`.
DB: `supabase/migrations/`.
