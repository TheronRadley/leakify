# Leakify — audit remediation status

**Date:** 2026-10-11 · **Branch:** `arena/00550c03-leakify`
**Companion to:** `AUDIT-RESOLVED.md` (the findings) — this file tracks what was actually changed, what
verifies it, and what still needs something a repository checkout cannot provide.

Every row was run locally before being marked done:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | ✅ clean |
| `npm run lint` (`--max-warnings=0`) | ✅ clean |
| `npm test -- --ci` | ✅ **250 tests / 19 suites**, also green under `TZ=America/Los_Angeles` and `TZ=Pacific/Auckland` |
| `npm run test:db -- --embedded` | ✅ 5 migration files apply, 3 SQL assertion files pass (real Postgres, throwaway cluster) |
| `npx expo export --platform web` | ✅ builds — 4 927 KB raw / 866 KB gzip single entry chunk |
| `npm run check:env` | ✅ all `.env*` variants ignored, `.env.example` tracked |
| `npm run scan:secrets` | ✅ clean (98 tracked files, 12 patterns); `--history` clean too |
| GitHub Actions (this branch) | ✅ **all four jobs green** on the first push — run `38166274234`: typecheck/lint/250 tests ×3 timezones, Postgres 15 schema + RLS + payment RPC, web export, dependency & repository security checks |

These are the CI commands run against a **lockfile-exact** `npm ci` install, which is how the one
real gap was found: the optional `embedded-postgres` dynamic import in `scripts/db-tests.mjs` tripped
`import/no-unresolved` in CI only, because a local tree with `--no-save` extras hides it. Lint is now
verified that way.

---

## 1. Resolved in code, verified in this checkout

| Audit finding | Change | Evidence |
| --- | --- | --- |
| **S-01** RLS unenforced by any test; plain (non-composite) FKs on child rows | Composite FK `(user_id, subscription_id) → subscriptions(user_id, id)` in `0002_owner_bound_child_rows.sql`; cross-user + owner-boundary suites; CI job runs them against Postgres 15 | `supabase/tests/10_rls_isolation.sql`, `20_owner_boundary.sql`; mutation-tested (weakening a policy in `0001` and reverting the `0002` FK each made the suite fail) |
| **N-04** two-step `recordPayment` had a partial-failure window | `record_payment()` RPC: one transaction does row lock (`select … for update`), replay guard, event insert, schedule roll, trial→active flip. Client computes the next date in TS and issues **exactly one** `db.rpc(...)`; an insert-only failure can no longer leave a charged-but-unrolled subscription. Local mode got matching replay protection (duplicate `charged` event for the same expected date is skipped) | `supabase/migrations/0004_record_payment_atomic.sql`, `supabase/tests/30_record_payment_rpc.sql` (5 scenarios incl. idempotent replay and cross-owner `leakify:not_found`), `services/__tests__/payment-recording.test.ts` (7) |
| **S-02 / S-03** session in AsyncStorage, no PKCE, recovery links not handled in-app, `flowType` typo | `flowType: 'pkce'`; native keystore storage now goes through a chunking adapter (SecureStore's ~2 KB cap silently truncated sessions and PKCE verifiers); link parsing moved to a pure module that refuses implicit-flow token URLs; `app/auth/callback` exchanges `?code=` (with `state` as the flow id) and `app/(auth)/reset-password` completes it via `updateUser`; recover-screen copy now matches reality | `services/secure-store-adapter.ts` (11 tests), `lib/auth-links.ts` (20 tests), `services/supabase.ts`, `features/auth/auth-context.tsx` |
| **S-02 residue** refresh timer suspended in background | `AppState` listener calls `startAutoRefresh()` on foreground, `stopAutoRefresh()` otherwise (the pattern the installed `auth-js` documents for React Native) | `features/auth/auth-context.tsx` |
| **S-05** user-supplied URLs opened without a policy | https-only WHATWG policy in `lib/url.ts`, enforced at validation, at write time in both repositories, and again at open time on the detail screen; `mailto:` guard in settings | `lib/__tests__/url.test.ts` (28), `services/__tests__/url-gate.test.ts` (13) |
| **S-07** lock-screen text exposed service + amount | `previewMode: 'generic'` default (service-neutral copy), per-user `preview_mode` column, settings switch, reschedule on change | `0003_notification_preview_mode.sql`, `features/notifications/__tests__/engine.test.ts` (19) |
| **R-01** unversioned, unvalidated persisted state | `{v,data}` envelope + shape validation; unreadable values are quarantined (≤12, never overwritten, never silently replaced), surfaced in Settings → Storage health with restore/discard | `services/storage-schema.ts` (12), `services/__tests__/local-storage.test.ts` (11) |
| **S-04 / N-02** "delete everything" over-claimed in cloud mode; `notification_preferences` skipped | `delete-account` Edge Function deletes account + all rows incl. preferences; the app calls it, consumes the result, and words each outcome honestly (local-only wipe ≠ account deletion; a failed wipe is reported, not swallowed) | `supabase/functions/delete-account/index.ts`, `services/cloud-account.ts`, `app/(tabs)/settings.tsx` |
| **N-01** stale OS notifications after delete/reset | Scoped cancellation before wipe: dedupes scheduled ids, skips already-`canceled`, tolerates per-id failure, then clears bookkeeping; web skips OS calls | `features/notifications/__tests__/cleanup.test.ts` (8) |
| **C-02** annual projection rounding (was "by design, undocumented") | The definition is now written down: `annual = monthlyEquivalent × 12` so headline figures reconcile, with the measured drift example (199 ¢/week → 10 344 ¢ vs 10 348 ¢ exact); UI label reads "≈ 12 × monthly" | `lib/billing.ts`, `app/subscription/[id]/index.tsx`, `lib/__tests__/billing.test.ts` (17, 3 new cases pin the drift) |
| **C-03** date/TZ reasoning correct but unguarded | DST-boundary and fixed-clock regression cases; whole suite verified in three time zones | `lib/__tests__/dates.test.ts` (23) |
| **U-04 / N-03** mode switch silently orphaned records | Explicit, non-destructive policy: the *other* store's contents are counted from the repositories and disclosed; copying on-device records into the account is opt-in, deduped by (name, amount, currency, interval, next date, status), leaves the local list untouched, and reports partial failure. No auto-upload, no deletion, ever | `features/subscriptions/mode-transition.ts` (17), `promoteLocalDataToCloud()` in `features/subscriptions/store.ts`, Settings → Storage & sync |
| **Q-01 / S-09** no CI, no security automation | `.github/workflows/ci.yml`: typecheck, lint, tests ×3 timezones, web export, Postgres schema+RLS job, env hygiene, secret scan, bundle-size report; `.github/dependabot.yml`; `SECURITY.md` | First-ever run of this repo's CI is green (run `38166274234`) |
| **S-08** `.env*` not fully ignored | `.gitignore` covers every variant; `scripts/check-env-hygiene.mjs` fails CI if a new pattern slips | `npm run check:env` |
| **Q-03 / R-03** unpinned toolchain, untracked bundle size | `engines: node >=22 <23`, prettier config + `format`/`format:check`, `scripts/report-bundle-size.mjs` in CI (reporting only, no threshold yet) | `package.json`, CI |

## 2. Needs a live Supabase project (cannot be closed from here)

1. **Redirect allow-list + Site URL** — add `leakify://auth/callback` and `https://<host>/auth/callback`;
   a redirect outside the allow-list is refused by Supabase (the link then opens the site instead of the app).
2. **`flowType` migration effect** — pre-existing implicit-flow refresh tokens are revoked by the switch to
   PKCE; users need to sign in once. Nothing to fix, but it belongs in the release note.
3. **Deploy `delete-account`** and set `SUPABASE_SERVICE_ROLE_KEY` (server-side secret only).
4. **Auth rate limits, password policy, email-confirmation toggle** — dashboard settings, invisible from the repo.
5. **Two-user live check** — the SQL suites already cover this against real Postgres; a cloud-project run
   closes the "does the hosted project have the same policies" question.

## 3. Needs a device / deployment

- **Web host must serve `index.html` for `/auth/callback`** — the static export is one SPA entry
  (`dist/index.html` only), so a path-based deep link 404s unless the host rewrites. This is the one
  deployment step that can make recovery links look broken on web.
- **iOS Universal Links** for `https://` links need an associated domain; custom-scheme links
  (`leakify://`) do not.
- **Android**: `adb backup` extraction behaviour (S-06), exact-alarm/battery-optimisation reliability (C-04).
- **Keychain inspection** (S-02): confirm the chunked `__p0…__pN` entries land in the encrypted store.

## 4. Deliberately not done

- **Repo-wide prettier reformat.** Config + scripts exist; running `format` would touch every file and
  bury the functional diff. `format:check` is available but intentionally not a CI gate yet.
- **JSON import (U-01).** Export exists; an importer is a feature decision (validation, conflict handling,
  whether it reuses the promotion dedupe rules above). Still open.
- **`npm audit` remediation (S-12).** 43 findings (0 critical) are all transitive dev/tooling paths; the CI
  step is non-blocking until a real upgrade round happens.
- **Custom error codes in Postgres.** `raise exception … using errcode='P000N'` collides with PL/pgSQL's own
  condition names (`P0001` = `raise_exception`), so handlers cannot catch them. The RPC therefore raises
  `leakify:*` message prefixes, which `toPaymentError` maps — including "the project is missing a database
  migration" for `PGRST202`, so an un-migrated project is told the truth instead of seeing a generic failure.
