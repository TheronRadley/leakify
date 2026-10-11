# Leakify: Audit Findings — Resolved (full-source pass)

**Date:** 2026-10-11
**Supersedes:** the config/docs-level audit (Appendix C of which asked for source access).
**Method:** every file in Appendix C list was read in full, plus `features/`, `app/`, `components/`,
`lib/`, `services/`, tests, and configs. The following were also **run** in a clean `npm ci` checkout:

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ pass |
| `npm run lint` | ✅ pass |
| `npm test -- --ci` | ✅ **109/109 pass** (9 suites) — README's "109 tests" claim is exactly right |
| `TZ=America/Los_Angeles npx jest --ci` | ✅ 109/109 |
| `TZ=Pacific/Auckland npx jest --ci` | ✅ 109/109 |
| `npm audit --omit=dev` | ⚠️ 43 vulns (16 moderate, 27 high, 0 critical) — see S-12 |
| `npx expo export --platform web` | ✅ builds; 1 chunk, **4.8 MB raw / 0.8 MB gzip** — see R-03 |
| `git check-ignore .env.production` | ❌ no match — S-08 confirmed empirically |
| Dependency source inspection | `@supabase/auth-js@2.117.3` and `expo-secure-store@57.0.4` tarballs downloaded and read (S-02, S-03) |
| Edge-case script against real modules | currency exponents, annual rounding, date/TZ chains, URL validation (C-01…C-03, S-05) |

**Nothing in the repo was modified.** This document is the only addition.

---

## 0. Verdict summary

| Status | Count | Findings |
|---|---|---|
| **CONFIRMED** (real issue, fix needed) | 11 | S-01 (residual), S-03, S-04 (+2 new sub-findings), S-05 (residual), S-06, S-07, S-08, S-09, S-10, U-01, U-04, R-01, R-02, C-02 (by design), Q-01…Q-05, U-02, U-05 |
| **PARTIALLY CONFIRMED** (less severe than feared) | 5 | S-02, S-05, C-04, U-03, R-04 |
| **CLEARED** (concern does not hold in code) | 7 | S-01 (policy correctness), S-11 (logging), C-01, C-03, C-05, R-05, S-01 item 6 |
| **RUN/PERFORMED now** | 2 | S-12 (npm audit), Q-01 (CI steps all validated to run) |
| **Still needs a device / live Supabase project** | 5 | S-01 (live two-user test), S-06 (adb backup), S-10 (dashboard), C-04 (Android battery), U-03 (full a11y pass) |

**New findings not in the original audit:** N-01 (stale/duplicate OS notifications after local
delete & demo reset), N-02 (`notification_preferences` omitted from cloud account deletion),
N-03 (silent mode-switch orphaning — formalizes U-04's hypothesis), N-04 (two-step
`recordPayment` partial-failure window).

**Best single next move is unchanged:** two-user RLS test suite + CI. The policies themselves
survived source inspection (see S-01), but nothing enforces them, and CI was validated to work
today (all five steps of Appendix A.2 pass in this checkout).

---

## 1. Security findings — resolved

### S-01 · RLS — **POLICIES CORRECT (CLEARED); test gap + composite FK gap CONFIRMED**
Read `supabase/migrations/0001_initial_schema.sql` in full.

Checklist results:

| # | Item | Result |
|---|---|---|
| 1 | RLS enabled on all five tables | ✅ `enable row level security` ×5 (profiles, subscriptions, billing_events, notification_preferences, notification_records) |
| 2 | Per-operation policies, `to authenticated` implicit, `with check` on insert **and** update | ✅ all four ops per table; insert/update carry `with check (auth.uid() = …)` |
| 3 | No `using (true)` | ✅ grep clean |
| 4 | `user_id` defaults to `auth.uid()`, unchangeable on update | ⚠️ **no default** (repository always sets it explicitly — `supabase-repository.ts` create/upsert paths); update `with check` prevents reassignment. Not a vulnerability; deviation from the checklist only. |
| 5 | Composite FKs on `billing_events.subscription_id`, `notification_records.subscription_id` | ❌ **CONFIRMED GAP** — plain `references public.subscriptions (id)` only. Cross-user attach is possible with a known UUID (FK checks bypass RLS). UUIDv4 knowledge is required, so exploitability is low — but the cheap fix stands. |
| 6 | `SECURITY DEFINER` + explicit `search_path`, not RPC-callable | ✅ `handle_new_user` is `security definer set search_path = public`; it (and `touch_updated_at`) are **trigger functions** (`returns trigger`) — Postgres refuses direct/`rpc` calls to them. |
| 7 | No public table with `rowsecurity = false` | ✅ all five tables in the migration have RLS on; the migration creates no others |

**Remaining risk is exactly what the original audit said:** no automated test. There is no
`supabase/tests/` directory, no pgTAP, no CI (Q-01). The policies are correct *as written today*;
one future edit can silently break them. Severity stays High-conditional; fix = Appendix A.4 + CI.

### S-02 · Session storage — **LARGELY CLEARED** (was Medium → now Low)
- `services/supabase.ts`: native uses **`expo-secure-store` directly** (Keychain/Keystore-backed,
  encrypted) — strictly better than the plaintext-AsyncStorage default the audit assumed.
- The 2048-byte limit that motivated Supabase's `LargeSecureStore` recipe **does not exist in
  `expo-secure-store@57.0.4`** (verified from the published tarball: no size check anywhere in
  `setItemAsync` / native sources). The missing `aes-js` / `react-native-get-random-values`
  packages are therefore **irrelevant** — the custom adapter is not needed on this SDK version.
- `detectSessionInUrl: Platform.OS === 'web'` → **false on native**, as recommended. ✅
- Residual (all Low): (a) web sessions live in `localStorage` (inherent SPA tradeoff — CSP matters, S-11); (b) **no `startAutoRefresh`/`stopAutoRefresh` AppState lifecycle anywhere** (grep clean) — a token-refresh reliability nit, not a security hole; (c) a debug-device storage inspection is still the only way to be 100% sure nothing falls back silently.

### S-03 · Auth deep links / recovery — **CONFIRMED** (Medium stands)
- `@supabase/auth-js@2.117.3` **defaults to `flowType: 'implicit'`** (verified in package source);
  `services/supabase.ts` never sets `flowType` → the app runs implicit. Tokens appear in redirect
  URLs for email links.
- No `exchangeCodeForSession` / PKCE code handling exists anywhere (grep clean).
- `resetPasswordForEmail(email)` is called **without `redirectTo`** (`auth-context.tsx:169`).
- `app/(auth)/` contains only `recover`, `sign-in`, `sign-up` — **no route handles a returned
  auth token/code**, yet `recover.tsx` tells the user "The link opens Leakify and lets you set a
  new password." That claim is not supported by any code path I can find; the link will open the
  Supabase Site URL in a browser unless the dashboard is doing something undocumented (S-10).
- Custom scheme `leakify://` in `app.json` (scheme hijack concern on Android stands as written).

**Fix as the audit specified:** `auth.flowType: 'pkce'`, exchange in a dedicated route, exact
redirect allow-list, and fix the recover-screen copy to match reality.

### S-04 · "Full data deletion" in cloud mode — **CONFIRMED**, plus two sub-findings
Deletion flow (`settings.tsx:154`): `deleteAllAccountData()` → rows deleted → `auth.signOut()`.
- ❌ **The `auth.users` row is never deleted.** `SupabaseProfileRepository.deleteAccountData`
  (`supabase-repository.ts:355`) even documents this: *"lets the caller delete the auth user
  (needs a server-side function)"* — and **no such function exists**: `supabase/` contains only
  `migrations/`; no Edge Functions, no admin RPC. The account and email survive "full deletion".
  Store-policy exposure (Apple 5.1.1(v), Play) as the audit described. **CONFIRMED.**
- ❌ **N-02 (new):** `deleteAccountData` deletes `subscriptions`, `billing_events`,
  `notification_records`, `profiles` — but **not `notification_preferences`**. Those rows persist
  indefinitely (their FK cascades only if the auth user is ever deleted, which never happens).
- ⚠️ Local mode equivalent is complete at the storage-key level (all 5 keys removed) but see
  **N-01** below for what happens to already-scheduled OS notifications.

**Fix:** Edge Function (JWT-verified) → delete rows (all six tables/keys) → admin-API user
delete. Verify per the original checklist.

### S-05 · User-supplied URLs — **PARTIALLY MITIGATED** (was Medium-Low → now Low)
Empirically tested against the real `subscriptionFormSchema`:

| Input | Result |
|---|---|
| `javascript:alert(1)` | ✅ rejected |
| `intent://x#Intent;…` | ✅ rejected |
| `file:///etc/passwd` | ✅ rejected |
| `http://example.com/x` | ⚠️ **accepted** (policy decision to make) |
| `https://example.com/x` | ✅ accepted |
| `HTTPS://EXAMPLE.COM` | rejected (cosmetic — regex is case-sensitive) |

- The form regex `/^https?:\/\/.+\..+/` (`validation.ts:74`) does restrict the scheme, so the
  injection vector the audit feared is closed **at the form**.
- ❌ **No re-check at open time:** `app/subscription/[id]/index.tsx:299` calls
  `Linking.openURL(sub.cancellationUrl!)` unguarded. Defense-in-depth missing.
- No import path exists today (U-01), so pasted form input is the only in-app writer. (The local
  repository's `assertValidInput` does not check schemes, and any client can write arbitrary
  URLs to its *own* rows via the anon key — self-harm only under RLS.)
- **Fix:** decide https-only vs http-allowed, add the Appendix A.3 open-guard, keep the rule for
  when import lands.

### S-06 · Local data at rest — **CONFIRMED as-is** (Low-Medium)
AsyncStorage (unencrypted; `localStorage` on web), `app.json` sets **no** backup policy
(`android.allowBackup` unset → prebuild default true), no backup rules file, no app lock. Exactly
as the audit described; device/`adb` verification still needs a debug build.

### S-07 · Lock-screen notification text — **CONFIRMED** (Low)
Engine titles embed name + amount, e.g. `` `${name} bills today — ${amount}` `` (`engine.ts:134`).
No generic-text setting exists. As designed; the suggested privacy setting stands.

### S-08 · `.gitignore` env coverage — **CONFIRMED empirically** (Low-Medium)
`git check-ignore -v .env.production` → no match. `.env` and `.env*.local` only. Apply
Appendix A.1 verbatim (`.env*` + `!.env.example`).

### S-09 · No security automation — **CONFIRMED** (Medium)
No `.github/`, no `SECURITY.md`, no Dependabot config (`.github` does not exist). GitHub
repo-settings toggles can't be seen from a clone — everything else stands.

### S-10 · Supabase auth settings undocumented — **CONFIRMED** (Low-Medium)
README step 3 is exactly `Enable Email auth in Authentication → Providers` — nothing about
confirmation, password policy, rate limits, redirect lists, or recovery-link behavior. Worse,
`recover.tsx` user-facing copy depends on undocumented dashboard configuration (S-03).

### S-11 · Web headers & release logging — **LOGGING CLEARED; headers N/A-in-repo**
- Grep for `console.log/warn/error/info` across `app/ features/ lib/ services/` (excluding
  tests): **zero hits.** Logging concern cleared at source level.
- No header config of any kind exists (expected — headers are the host's job on a static
  export). CSP/HSTS checklist remains for wherever the web build is deployed.

### S-12 · Dependency scan — **PERFORMED NOW**
`npm audit --omit=dev`: **43 advisories (16 moderate, 27 high, 0 critical)**; with dev: 72.
Reading the module list: the overwhelming majority are **build/dev tooling** that npm attributes
to production because `expo` and `react-native` sit in `dependencies` — Metro, `@expo/*`,
`babel-jest`/`jest-*`, `braces`/`micromatch`, `node-forge` (code-signing), `xcode`.
Genuinely bundle-adjacent hits: `react-native/virtualized-lists`, `datetimepicker`,
`expo-router` (via `query-string`/`decode-uri-component` — DoS-class), `uuid` (v3/v5/v6 with
buffer — supabase uses v4-style IDs). **No advisories in `supabase-js`, `zod`, `date-fns`,
`react`, or auth/crypto libraries.**
**Action:** `npm audit fix`, re-run, and track the residue; treat "27 high" as mostly toolchain
noise — but say so explicitly rather than ignore the number.

---

## 2. Money & date correctness — resolved

### C-01 · Currency minor-unit exponent — **CLEARED**
Implementation is Intl-driven (`currencyFractionDigits` → `resolvedOptions().maximumFractionDigits`)
and used consistently in `formatMoney`, `decimalToMinorUnits`, `minorUnitsToDecimal`.
Measured against the real modules:

```
JPY digits=0  format(1500)=¥1,500  parse('1500')=1500  parse('1500.5')=null
KWD digits=3  format(1234)=KWD 1.234  parse('1.234')=1234  parse('1.2345')=null
```

- JPY/KRW (0-digit) are in the picker; tests cover JPY round-trips (`currency.test.ts`).
- KWD is **not** in `SUPPORTED_CURRENCIES` (16 codes, no 3-digit currency), but the code path is
  correct anyway — my script exercised it.
- Residual nit: if `Intl` were ever unavailable, the catch falls back to `digits = 2`, which
  would mis-scale zero/three-digit currencies. Hermes ships Intl on current Expo; worth one
  on-device sanity check, not a code change.

### C-02 · Annual projection rounding — **CONFIRMED (by design, with measured drift)**
```ts
monthlyEquivalentCents = Math.round(amount * periodsPerMonth)   // rounds FIRST
annualEquivalentCents  = monthlyEquivalentCents * 12            // then ×12
```
Measured: weekly `199` → monthly `862`, **annual `10344` vs exact `10348` (drift 4)** — the
audit's exact example reproduces. Both README and `billing.test.ts` *define* annual as
"12 months of the monthly equivalent" for headline consistency, so this is deliberate; the
drift versus exact-period math is real and accumulates per subscription (≤ ~5.5 minor units each,
plus per-subscription rounding before summation). **Decision needed:** keep (document it) or
compute annual exactly and round once. Adding the A.5 test either way will force the choice.

### C-03 · Date-only values / time zones — **CLEARED**
`parseISODate` uses date-fns `parseISO`, which yields **local** midnight for date-only strings
(the classic `new Date('YYYY-MM-DD')` UTC trap does not apply). Measured the audit's exact cases
against the real modules under `TZ=UTC`, `America/Los_Angeles`, `Pacific/Auckland`:

```
parse '2026-11-01' → local 2026-11-01 00:00   (identical in all three zones)
monthly 2026-01-31: 2027-02-28, 2027-03-31, 2028-02-29
yearly  2028-02-29 → 2029-02-28  (and 2032-02-29)
```
Full suite: **109/109 in all three zones.** Remaining gap is only that the suite doesn't pin the
DST-end day explicitly — add the A.5 rows anyway so regressions can't slip in.

### C-04 · Notification reliability — **PARTIALLY CLEARED**
- ✅ Cap ordering: plans sorted `triggerAt` ascending then `.slice(0, 48)` — **soonest kept**;
  `MAX_SCHEDULED_NOTIFICATIONS = 48` < iOS 64, and the weekly digest is appended *after* the cap
  → worst case 49 ≤ 64. The audit's "count the digest" concern is structurally satisfied.
- ✅ Android channel created before requesting permission; foreground re-sync on `AppState`
  'active' (`use-notification-sync.ts`) — README claim verified.
- ❌ **N-01 (new):** `cancelAllScheduled()` (`service.ts:169`) has **zero callers** (its own
  doc comment says "used by account deletion / demo reset" — it isn't). Consequences:
  - **Local mode delete-all:** `deleteAccountData` removes the bookkeeping key *first*, so the
    post-delete sync sees `existing = []` → cancels nothing → **OS-scheduled reminders keep
    firing after deletion**, with the deleted subscriptions' names and amounts.
  - **Demo reset:** bookkeeping wiped, then fresh records scheduled → **duplicates** (old OS ids
    are never cancelled).
  - Cloud-mode delete happens to self-heal (bookkeeping is local-only and survives, so the next
    sync cancels everything) — but only by accident.
  Fix: call `cancelAllScheduled` at the top of delete/reset flows.
- ⚠️ Still not verifiable from source: Android battery-optimization/exact-alarm behavior (needs
  a real device), TZ-change-after-scheduling (partially mitigated by foreground re-sync).

### C-05 · Local ID generation — **CLEARED for purpose** (nit)
`generateId()` (`local-repository.ts:29`) emits UUID-v4-*shaped* strings using `Math.random` —
correct format for any future `uuid` column upload; not CSPRNG. Collision odds remain negligible
at this scale. Note it, don't block on it.

---

## 3. Quality & tooling — resolved

### Q-01 · No CI — **CONFIRMED, and now de-risked**
`.github/` doesn't exist. **Every step of Appendix A.2 was executed in this checkout and
passes:** `npm ci`, typecheck, lint, `jest --ci` (also under two non-UTC TZs), and
`npx expo export --platform web`. Only `npm audit --omit=dev --audit-level=high` would fail CI
today (S-12: 27 highs, mostly toolchain) — either fix first or start it as a non-blocking job.

### Q-02 · Test scope — **CONFIRMED**
109 tests, one Jest project (`jest-expo/node`), `.test.ts` only, all Node-environment:
`repository.test.ts` explicitly says "Integration tests for the **local** repository" and imports
only `local-repository`. No component tests (react-test-renderer installed, never used), no
Supabase-repository tests, no e2e, no coverage config. README's own note that RLS verification
needs a live project is accurate.

### Q-03 · Dependency hygiene — **CONFIRMED, item by item** (`package.json`)
- ❌ `eslint` undeclared (lint passes only because npm auto-installed the peer — fragility
  demonstrated: `eslint .` resolves via `eslint-config-expo`'s peer).
- ❌ `react` pinned `19.2.3` vs `react-dom` `^19.2.3` (aligned in the lock today, divergent by
  declaration).
- ❌ `jest@^29.7.0` + `@types/jest@^30.0.0` major mismatch.
- ❌ `nativewind` in `devDependencies` though it's a runtime transform dependency.
- ❌ `prettier` installed; no config file, no `format` script (confirmed: no `.prettierrc*`).
- ❌ `transformIgnorePatterns` names `@sentry/react-native`, `native-base`, `@expo-google-fonts/*`
  — none installed (template residue).
- ✅ TypeScript `~6.0.3` + eslint-config-expo work together in practice (typecheck & lint both
  pass).

### Q-04 · Release readiness — **CONFIRMED**
No `eas.json`, no `expo-dev-client` (both greps/filesystem-checked). `app.json`:
`orientation: "portrait"` + `ios.supportsTablet: true` + no `requireFullScreen` → iPad rotation
behavior exactly as the audit predicted (ITMS-90474 avoidance). No
`ITSAppUsesNonExemptEncryption`. In-app `app/privacy.tsx` exists; **no hosted privacy URL
anywhere in README** — both stores need one.

### Q-05 · README gaps — **CONFIRMED**
- Line 1 "🟢 Live demo" has no URL (it points at in-app demo mode — either link a real hosted
  demo or reword).
- No screenshots/images/badges (grep: only node_modules hits).
- `npm test # 109 unit/integration tests` — accurate *today*, will rot (CI badge instead).
- Cloud setup lacks the S-10 hardening notes.

---

## 4. Product / UX — resolved

- **U-01 (Medium-High) — CONFIRMED.** Settings has **Export** (Share sheet, JSON, includes
  profile + subscriptions) and **no import/restore anywhere** (grep across repo: zero hits).
  Local-only users lose everything on uninstall/phone change. Highest-value product gap after
  the security items.
- **U-02 — CONFIRMED n/a:** no provider catalog, no CSV/statement import, no receipt parsing.
  Product roadmap, as the audit framed it.
- **U-03 — PARTIAL evidence, still TO VERIFY:** `accessibilityLabel` present in 19 files,
  `accessibilityRole`/`Hint` ×25 — icon-only buttons are largely covered. Contrast of both
  themes, Dynamic Type clipping, calendar non-visual alternative, amount-readout phrasing: not
  audited. Keep the checklist.
- **U-04 — CONFIRMED (N-03):** `signIn` while in local mode silently rewrites `dataMode` to
  `'supabase'` and re-initializes the store to the cloud scope. Local data is **not merged and
  not warned about** — it stays under the `local-user` scope (orphaned until the user switches
  back). `signOut` returns to the mode picker with the same silent separation. Define, document,
  and test the policy.
- **U-05 — CONFIRMED n/a:** fire hour hard-coded `REMINDER_FIRE_HOUR = 9`; no time picker or
  quiet hours; permission is requested during **onboarding** (`onboarding.tsx:191`) and via the
  Settings toggle — not at first-reminder creation.
- **U-06 — n/a:** `joinCurrencyTotals` renders "A + B" per-currency headlines; conversion not
  implemented (consistent with AGENTS.md rule 1).

---

## 5. Performance / reliability / cost — resolved

- **R-01 — CONFIRMED:** no `schemaVersion` in `storageKeys`; `readJSON` swallows parse errors
  and returns the fallback — old-shape data after an update fails *silently* (worst case: user
  sees an empty list, data not lost but orphaned). Add versioning + migration path.
- **R-02 — CONFIRMED:** pure write-through; offline create/edit rejects with
  `RepositoryError('network')` to the caller (no queue, no optimistic state, no half-saved store
  rows). **N-04 (new, minor):** `recordPayment` writes the billing event, then rolls the date in
  a second call — a failure between them leaves an event without the roll-forward (no
  transaction; the code comments this choice as "client-visible and auditable").
- **R-03 — MEASURED:** `npx expo export --platform web` succeeds; single entry chunk
  **4.8 MB raw / 0.8 MB gzip**. 0.8 MB gz is acceptable-to-mediocre, not a emergency; barrel
  imports are plausible contributors but nothing is broken. Track, don't churn.
- **R-04 — PARTIAL:** main list is a `FlatList` (good); `SubscriptionRow` is **not**
  memoized; components subscribe via `useDataStore` slices (whole `subscriptions` array updates
  re-render the list). Low, as rated.
- **R-05 — CLEARED:** indexes exist exactly as recommended — `(user_id, created_at)`,
  `(user_id, next_billing_date)` partial for active/trialing, `(user_id, category)`,
  billing-event and notification-record user indexes. Nothing to add at this scale.
- **R-06 — n/a** (unchanged).

---

## 6. Updated priority roadmap (vs original)

**Immediate (unchanged order, now with validated effort):**
1. Two-user RLS tests + composite-FK fix (S-01) — policies verified correct, so this is pure
   protection, not remediation.
2. CI — **every step proven to pass locally** (Q-01); start `npm audit` non-blocking until S-12
   is cleaned.
3. `.gitignore` fix (S-08) — 2 minutes, empirically confirmed needed.
4. `cancelAllScheduled` call in delete/reset flows (N-01) — small, user-visible privacy bug.
5. Cloud account-deletion Edge Function + include `notification_preferences` (S-04, N-02).
6. PKCE + redirect allow-list + fix recover-screen copy (S-03, S-10).
7. C-02 design decision + A.5 regression rows (C-01/C-03 already proven correct — add the tests
   as guardrails anyway).

**Next:** JSON import (U-01), repository contract tests (Q-02), schema versioning (R-01),
https-only + open-time URL guard (S-05), release config & hosted privacy policy (Q-04),
mode-switch policy (U-04/N-03).

**Later:** unchanged from the original audit (catalog, statement import, reminder time/quiet
hours, generic notification text, a11y pass, headers, ICS/widgets) — plus now: `npm audit fix`
follow-up, bundle tracking (R-03), `startAutoRefresh` lifecycle (S-02 residue).

---

## 7. What still cannot be settled from source

1. **Live two-user RLS test** — needs `supabase start` or a cloud project (A.4 is ready to run).
2. **Dashboard settings** (S-10): email confirmation, password policy, redirect allow-list,
   rate limits — invisible from the repo.
3. **Device behavior** (S-06 backup extraction, C-04 Android battery/exact alarms, S-02 storage
   inspection, on-device Intl sanity check).
4. **Deployed-host headers** (S-11) and **GitHub repo settings** (S-09 secret scanning /
   push protection).
5. **Full accessibility pass** (U-03) and store-policy text re-checks (S-04).
