# Security Policy

Leakify is a privacy-first subscription tracker. It can run entirely on-device,
so the security surface that matters most is: what leaves the device, who can
read it in the cloud backend, and what happens to it when a user asks for
deletion.

## Supported versions

| Version         | Supported                               |
| --------------- | --------------------------------------- |
| `main`          | ✅ fixes land here first                  |
| latest tag/PR   | ✅ security fixes are backported on request |
| older releases  | ❌ upgrade to a supported build           |

Runtime baselines we currently target: Expo SDK 57, React Native 0.86,
Node.js 22 (LTS), Postgres 15 (Supabase).

## Reporting a vulnerability

Email **security@leakify.app** with a description and, if you have one, a
minimal reproduction. If that address is not yet live, open a **private**
security advisory at
<https://github.com/TheronRadley/leakify/security/advisories/new>.

Please do **not** file public issues for exploitable findings, and do not
include real credentials, tokens or another person's data in a report. Redact
values — we need the location and the shape, never the secret itself.

What to expect:

1. Acknowledgement within 3 business days.
2. A triage reply (fixed / mitigated / accepted risk with reasoning) within
   14 days for anything that touches authentication, authorization, data
   deletion/export, or the money-and-dates domain logic.
3. A fix, coordinated disclosure text, and — where a released build was
   affected — a patched release.

## What we consider in scope

- Authorization bypass: reading or writing another user's rows despite Row
  Level Security, or via a client-supplied `user_id`.
- Cross-owner data linkage (a child row owned by user A pointing at user B's
  subscription) and any missing ownership boundary in `supabase/migrations/`.
- Credential handling: a service-role key, privileged token or user secret in
  a client bundle, in a repository file, or in logs/telemetry.
- Auth flows: recovery/confirmation link handling, PKCE code exchange, session
  refresh, and account deletion that reports success while identity survives.
- Injection or unvalidated URLs reaching a platform opener
  (`Linking.openURL`, deep links, WebView).
- Notification content that discloses financial detail to a lock screen.
- Silent data loss or corruption during storage upgrades/migrations.

## What we do not treat as vulnerabilities

- Feature requests for hardening we have not claimed (e.g. no E2EE, no app
  lock). Report real weaknesses in what the app *does* promise.
- Findings that require physical root/jailbreak access to the device with the
  user's unlocked keychain — platform sandbox limits are documented risks.
- Severity-only claims from `npm audit` for dev/build tooling with no
  reachable code path; still report them if you can show a build or runtime
  path, and we will triage.
- AI-generated advisories without a working reproduction.

## Response runbook (for maintainers)

When a report confirms a live credential or an authorization defect:

1. **Contain first.** Rotate the credential at the provider (Supabase →
   `anon`/`service_role` JWT rotation). Rotation is not deletion: also revoke
   sessions (Supabase dashboard → Authentication → Sign out all devices, or
   admin API) and, for a leaked `service_role` key, treat every row as
   potentially readable/writable.
2. **Assess exposure.** Identify affected tables/users and the time window
   from Postgres logs and app logs. If user data may have been read, prepare a
   notification that states what was exposed and what was not.
3. **Fix forward.** Patch on `main`, add a regression test that fails without
   the fix (see `supabase/tests/` for RLS/ownership assertions), and re-run
   `npm run test:db`, `npm test`, `npm run typecheck`, `npm run lint`.
4. **Check history.** If a secret was ever committed, scrub it
   (`git filter-repo`), force-push a clean tree, and confirm with
   `node scripts/secret-scan.mjs --history`. Removing a file in a new commit is
   not removal from history — the credential stays revoked regardless.
5. **Ship + record.** Publish the patched build, update
   `AUDIT-RESOLVED.md`/`AUDIT-CHECKLIST-STATUS.md` with the evidence (commands,
   outputs, environment), and set a recheck date for any accepted residual risk.

## Automated checks

- `.github/workflows/ci.yml` → typecheck, lint, unit tests across timezones,
  web bundle export, Postgres schema/RLS assertions, env-file hygiene,
  secret scanning, dependency audit.
- `.github/dependabot.yml` → reviewable update PRs; npm security updates must
  pass the same checks.
