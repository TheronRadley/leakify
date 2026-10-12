# Security

## Reporting a vulnerability

Please do **not** open a public issue. Email `security@leakify.app` with what you found, how to
reproduce it, and whether it is already public. We aim to acknowledge within 3 working days.

## Model in one paragraph

Leakify is local-first. In demo/local mode nothing leaves the device (AsyncStorage). In cloud mode
the app talks to Supabase with the **anon key only**; every table has Row Level Security enabled
and per-operation policies keyed on `auth.uid()`, so authorization is enforced by the database
rather than by the client. The service-role key exists only inside `supabase/functions/`, which
runs server-side. Auth uses the **PKCE** flow, so no access token ever appears in a redirect URL.
Sessions live in `expo-secure-store` (Keychain/Keystore) on native and `localStorage` on web.

## What CI enforces on every PR

| Check | Where |
|---|---|
| Typecheck, lint (zero warnings), tests, web export | `.github/workflows/ci.yml` → `verify` |
| Tests re-run in a non-UTC timezone | same job |
| RLS + composite-FK two-user suite against a real Postgres | `supabase/tests/` (runs inside `npm test`, no Docker) |
| Account deletion, notification reset, link policy, storage integrity | `services/__tests__/`, `features/**/__tests__/`, `lib/__tests__/` |
| Secret scanning over full git history | `.github/workflows/ci.yml` → `security` (gitleaks) |
| Dependency audit | same job — **report-only**, see below |

## Secrets

- `.gitignore` ignores `.env*` and re-includes only `.env.example`. Verify with
  `git check-ignore -v .env.production` (must match).
- Only `EXPO_PUBLIC_*` values are ever read by the app. `EXPO_PUBLIC_SUPABASE_ANON_KEY` is public
  by design; RLS is what makes that safe.
- History reviewed at `d70df05`: the repository has a single squashed commit, `.env.example` is the
  only env file ever added, and a history-wide grep for JWT/`sk-`/`service_role` patterns returns
  nothing. No rotation was required.

## Dependency audit triage

`npm audit --omit=dev` at this commit reports **43 advisories (16 moderate, 27 high, 0 critical)**;
`npm audit fix` resolves **none** of them without `--force`, and `--force` would break the Expo SDK
pinning. The count is dominated by build tooling that npm attributes to "production" only because
`expo` and `react-native` are declared as runtime dependencies.

**Not reachable from the shipped bundle** (Metro/bundler, Expo CLI, jest, code signing, iOS project
generation — all build-time): `@expo/cli`, `@expo/metro`, `@expo/metro-config`, `@expo/config*`,
`@expo/prebuild-config`, `@expo/code-signing-certificates`, `@expo/local-build-cache-provider`,
`@expo/inline-modules`, `metro*`, `@react-native/community-cli-plugin`, `@react-native/metro-config`,
`jest-*`, `babel-jest`, `@istanbuljs/load-nyc-config`, `babel-plugin-istanbul`, `braces`, `micromatch`,
`node-forge` (code signing), `xcode` → `uuid@7` (iOS project generation), `js-yaml`, `argparse`,
`sprintf-js`, `@react-native/jest-preset`.

**Bundle-adjacent** (do ship, all DoS-class or gated behind inputs the user controls):
`react-native`, `@react-native/virtualized-lists`, `expo-router` (via `query-string` and
`decode-uri-component`), `@react-native-community/datetimepicker`, `expo-splash-screen`,
`react-native-reanimated`, `react-native-worklets`.

**Clean:** `@supabase/supabase-js`, `zod`, `date-fns`, `react`, `react-dom`, and every auth/crypto
path the app actually uses.

**Decision:** the CI audit job stays report-only (`continue-on-error`) until an Expo SDK bump clears
the toolchain residue. It uploads its report as an artifact on every run, so a *new* advisory is
still visible in review even though it cannot fail the build. Re-triage at each SDK bump and flip
the job to blocking once `npm audit --omit=dev --audit-level=high` is empty.

## Known residual risks

| Risk | Status |
|---|---|
| Web sessions live in `localStorage` | Inherent to a static SPA export; mitigate with CSP on the host (see README) |
| `android:allowBackup` | Disabled by `plugins/with-android-backup-policy.js`; verify on a debug build with `adb backup` |
| Custom `leakify://` scheme can be registered by another Android app | Mitigated by PKCE (a stolen code is useless without the verifier stored in Keychain/Keystore) |
| Device-only behaviour: exact alarms, battery optimisation, on-device `Intl` | Not verifiable from source — check on a real device before release |
| Deployed web security headers | The host's responsibility; not settable from a static export |
