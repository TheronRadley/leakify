> **🟢 Live demo:** try the sample account by choosing **"Explore the demo"** in onboarding. All data is illustrative and stored locally.

<div align="center">

# 💧 Leakify

### Stop the money leaks.

Know what leaves your wallet, see what's coming next, and take control before you get charged.

</div>

Leakify is a privacy-first subscription and recurring-expense tracker for iOS, Android and web,
built with **Expo SDK 57 / React Native 0.86**, **TypeScript (strict)**, **Expo Router**,
**NativeWind v4**, **React Native Reusables**-style UI primitives and **Supabase**.

---

## ✨ What it does

- **Home dashboard** — monthly recurring spend, projected annual cost, next-7-days forecast
  (marked as a forecast), upcoming renewals, leak-detector summary, quick actions.
- **Subscriptions** — full CRUD with search, sorting (next billing / price / recent / A-Z),
  category & status filters. Track name, provider, amount, currency, billing frequency
  (weekly / monthly / 3-month / 6-month / yearly / custom), dates (start, next billing,
  trial end), category, payment-method label, cancellation URL, notes, status and reminders.
- **Smart reminders** — configurable lead times per subscription (7 / 3 / 1 / same-day and
  trial reminders) with on-device scheduling, dedup-safe re-scheduling, weekly digest option,
  and a reminders inbox that shows exactly what will fire.
- **Insights** — category breakdown, largest subscriptions, renewal clusters, recorded
  spending trend (only from payments you confirm), duplicate candidates, trials ending,
  missing billing dates, user-flagged unused, recorded price increases, and a clearly
  labelled **potential savings** estimate for cancellation candidates.
- **Billing calendar** — month navigation, charge highlights (renewals vs trial deadlines),
  per-day detail lists, per-currency totals. Month-end and leap-day schedules are handled
  correctly (Jan 31 → Feb 28/29 → Mar 31).
- **Cancellation assistant** — provider cancellation links and instructions, trial-deadline
  warnings, and an honest "mark as canceled" flow that records *your* action (never claims
  the provider confirmed it).
- **Privacy-first** — local-only by default (demo + on-device modes), zero analytics SDK,
  JSON data export, full data deletion, and Row Level Security on every table in cloud mode.

## 🚀 Getting started

```bash
npm install
npm start          # Expo dev server
npm run android    # ...or iOS (macOS) / web
```

You can use the app **without any backend**: choose *Add subscriptions manually* (local
mode) or *Explore the demo* in onboarding.

> ⚠️ In Expo Go on Android, local notifications still schedule, but a **development build**
> (`npx expo run:android` / EAS) is recommended for the full notification experience.
> On web, native notifications are unavailable and the app degrades gracefully.

## 🔐 Optional: cloud sync with Supabase

Cloud mode is **opt-in** and fully disabled until configured.

1. Create a project at [supabase.com](https://supabase.com).
2. Run the schema: paste `supabase/migrations/0001_initial_schema.sql` into the SQL editor
   (or `supabase db push` with the CLI).
3. Enable Email auth in *Authentication → Providers*.
4. Configure the app with **public** env vars (anon key only — service keys must never ship):

```bash
# .env (gitignored)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

5. Restart the dev server. "Sign in & sync" appears on onboarding / sign-in screens.

Authorization is enforced by **Row Level Security policies** in the migration — every table
(`profiles`, `subscriptions`, `billing_events`, `notification_preferences`,
`notification_records`) only exposes rows where `auth.uid() = user_id`. The repositories in
`services/supabase-repository.ts` also scope every query client-side, but the database is
the real boundary.

## 🧭 Project structure

```
app/                    # Expo Router routes (screens compose features)
  (tabs)/               # Home · Subscriptions · Insights · Calendar · Settings
  (auth)/               # sign-in / sign-up / recover
  subscription/[id]/    # detail + edit modal
  subscription/new.tsx  # add modal
  savings.tsx reminders.tsx privacy.tsx onboarding.tsx
components/
  ui/                   # React-Native-Reusables-style primitives (RNR source of truth)
  shared/               # Screen, EmptyState, MoneyText, SubscriptionRow, DatePickerField…
  branding/             # Leakify logo (SVG droplet + contained waterline)
features/
  subscriptions/        # store (observable), leak detector, demo data, form, tests
  notifications/        # pure scheduling ENGINE + expo-notifications service + sync hook
  insights/             # insight & trend calculations
  calendar/             # month grid + charge computation
  auth/                 # auth context, data modes, route guard
lib/                    # billing math, dates, currency, validation (zod), constants, theme
services/               # repository interfaces + local (AsyncStorage) + Supabase impls
supabase/migrations/    # 0001_initial_schema.sql (tables, indexes, RLS, triggers)
types/                  # shared domain models
```

## 💰 Design decisions worth knowing

- **Money is stored as integer minor units** (cents) + ISO currency code. Totals are always
  grouped **per currency — Leakify never silently converts** between currencies (no
  exchange-rate source is configured, honestly by design).
- **Recurring math is exact**: weekly ⇒ ×52/12 per month, quarterly ⇒ ÷3, semiannual ⇒ ÷6,
  yearly ⇒ ÷12, custom intervals generalized. Annual projection = monthly × 12.
- **Recurrence steps from the anchor date** (anchor + n·interval) so the 29th/30th/31st and
  Feb-29 never drift, with date-fns clamping short months.
- **No optimistic UI**: mutations write through the repository and then update state — no
  rollback traps, no phantom data.
- **Billing history is real**: it only contains payments you confirmed with “Record
  payment” (which also rolls the billing date forward). Nothing is fabricated.
- **Honest insights**: unused-subscription findings require *your* flag; duplicates are
  *candidates*; savings estimates are labeled as estimates until a cancellation is
  confirmed. No bank sync is claimed anywhere — there is a clean repository seam for a
  future, consented integration.

## 🔔 Notification architecture

`features/notifications/engine.ts` is a **pure function module** (compute plans → diff
against persisted schedule → {schedule, cancel}), fully unit-tested in Node —
no duplicates after repeated edits, canceled/paused subscriptions never notify, past dates
are dropped, and the schedule is capped under the iOS 64-notification limit.
`service.ts` is the thin wrapper that applies diffs through `expo-notifications`
(local DATE triggers, 9:00 AM local time, Android channel `reminders`).
`useNotificationSync()` re-syncs after every data change and on app foregrounding.

## ✅ Quality gates

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint (expo flat config)
npm test            # 109 unit/integration tests
```

Test coverage includes: recurrence & leap-year math, every billing interval, currency
separation/formatting/rounding, reminder scheduling, dedup & cancellation of reminders,
duplicate detection, repository CRUD + cancellation-state transitions + payment recording,
demo-seeding scoping, form validation, renewal clusters and recorded-spend trends.

> User-level access control at the **database** level (RLS) is enforced by migration
> policies; the client-side scope is covered by tests (`LocalSubscriptionRepository`
> user isolation). RLS verification requires a running Supabase project (see section above).

## 🧱 Tech

Expo 57 · React Native 0.86 · TypeScript strict · Expo Router 6 · NativeWind 4 ·
@rn-primitives · Supabase JS v2 · expo-notifications · react-hook-form + zod · date-fns ·
lucide-react-native · jest-expo.

## ⚠️ Known platform limitations

- **Web**: no native local notifications (in-app reminders inbox still works).
- **Expo Go (Android)**: remote push tokens are unavailable since SDK 53; local scheduling
  works, but a dev build is the tested target for reminders.
- **Auth on web**: Supabase email links need your deployed URL in Supabase redirect allow-list.
- iOS builds require macOS/Xcode or EAS — not verifiable in CI sandbox; the JS bundle is
  verified via `expo export`.
