/**
 * Auth link handling — pure, so the security-relevant parsing is unit tested.
 *
 * Leakify receives recovery links on three platforms with three shapes:
 *   web          https://<deployed-host>/auth/callback?code=...
 *   native       leakify://auth/callback?code=...
 *   cold start   the same URL, delivered as the app's initial link
 *
 * Rules this module enforces:
 * - Only the expected callback path is treated as an auth callback; a random
 *   deep link never becomes an authenticated action.
 * - A link that carries tokens in the query string (legacy implicit flow) is
 *   refused rather than consumed: those values must not be parsed, stored or
 *   echoed, and the flow we deploy is PKCE.
 * - Nothing in the result object can leak the code or any token to a caller
 *   that logs it: `describe()` is provided for diagnostics and redacts values.
 */

export const AUTH_CALLBACK_PATH = '/auth/callback';

/** Shape of a single-use PKCE authorization code: opaque, URL-safe, not a JWT. */
const CODE_RE = /^[A-Za-z0-9_-]{16,2048}$/;

export type AuthCallback =
  /** `state` is the PKCE flow id: it pairs this response with the verifier held on the device. */
  | { kind: 'auth-code'; code: string; state?: string }
  | { kind: 'recovery-token'; tokenHash: string; type: 'recovery' | 'email' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: 'expired' | 'invalid' | 'unsupported_format' | 'wrong_route'; message?: string }
  | { kind: 'not-an-auth-link' };

/** Only ever carry across a short machine-readable code, never provider prose. */
function machineToken(value: string | null): string | undefined {
  return value && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : undefined;
}

function paramsOf(raw: string): URLSearchParams | null {
  try {
    // A base is required for scheme-only URLs such as `leakify://auth/callback`.
    return new URL(raw, 'leakify://local').searchParams;
  } catch {
    return null;
  }
}

function pathnameOf(raw: string): string {
  try {
    const url = new URL(raw, 'leakify://local');
    // `leakify://auth/callback` parses as host=auth + path=/callback, so both
    // spellings are normalized before comparing.
    const host = url.host && url.host !== 'local' ? `/${url.host.replace(/^\//, '')}` : '';
    const path = `${host}${url.pathname}`.replace(/\/{2,}/g, '/');
    return path === '' ? '/' : path;
  } catch {
    return '';
  }
}

/** True when the incoming link is addressed to our callback route. */
export function isAuthCallbackUrl(raw: string, expectedPath = AUTH_CALLBACK_PATH): boolean {
  const path = pathnameOf(raw);
  return path === expectedPath || path.endsWith(expectedPath);
}

/**
 * Interpret a link the OS/browser handed us. Never throws, never logs.
 */
export function parseAuthCallback(raw: string | null | undefined): AuthCallback {
  if (typeof raw !== 'string' || raw.trim() === '') return { kind: 'not-an-auth-link' };
  if (!isAuthCallbackUrl(raw)) return { kind: 'not-an-auth-link' };

  const params = paramsOf(raw);
  if (!params) return { kind: 'failed', reason: 'invalid' };

  // Supabase appends `error=`/`error_code=` on a rejected or expired link, and
  // `error=access_denied` when the user closes the email confirmation page. The
  // provider's free-text `error_description` is used only to pick a reason — it is
  // never carried into the result, so nothing from the link can be echoed onward.
  const error = params.get('error') ?? params.get('error_code');
  if (error) {
    const normalized = [error, params.get('error_code'), params.get('error_description')]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();
    if (normalized.includes('access_denied') || normalized.includes('cancelled') || normalized.includes('canceled')) {
      return { kind: 'cancelled' };
    }
    if (normalized.includes('expired') || normalized.includes('once')) {
      return { kind: 'failed', reason: 'expired', message: machineToken(params.get('error_code')) };
    }
    return { kind: 'failed', reason: 'invalid', message: machineToken(params.get('error_code')) };
  }

  // A link that carries a session in the query string is the implicit flow. We
  // do not accept it: the token would live in history, logs and analytics.
  if (params.has('access_token') || params.has('refresh_token')) {
    return { kind: 'failed', reason: 'unsupported_format' };
  }

  if (params.has('code')) {
    const code = params.get('code') ?? '';
    if (!CODE_RE.test(code)) return { kind: 'failed', reason: 'invalid' };
    const state = params.get('state');
    return state ? { kind: 'auth-code', code, state } : { kind: 'auth-code', code };
  }

  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (tokenHash && (type === 'recovery' || type === 'email')) {
    return CODE_RE.test(tokenHash)
      ? { kind: 'recovery-token', tokenHash, type }
      : { kind: 'failed', reason: 'invalid' };
  }

  // Right route, nothing usable: an old bookmark, a stripped link, or a probe.
  return { kind: 'failed', reason: 'wrong_route' };
}

export interface RedirectTargetOptions {
  /** Custom scheme from app.json (`leakify`). */
  scheme?: string;
  /** Deployed origin for web builds, e.g. `https://leakify.app`. */
  webOrigin?: string | null;
  path?: string;
}

/**
 * The `redirectTo` value handed to Supabase for email links.
 *
 * Keep this list in sync with the project's Auth → URL Configurations
 * allow-list; an unexpected redirect is refused by Supabase, which is the
 * correct failure mode (the email still works, the link just opens the site).
 */
export function buildRedirectTarget({
  scheme,
  webOrigin,
  path = AUTH_CALLBACK_PATH,
}: RedirectTargetOptions): string | undefined {
  const origin = webOrigin?.replace(/\/+$/, '');
  if (origin) return `${origin}${path}`;
  if (!scheme) return undefined;
  // Native: `leakify://auth/callback` — expo-router maps that to the same route
  // the web URL does, so both platforms share one handler.
  return `${scheme}://${path.replace(/^\//, '')}`;
}

/** Redacted description of a link, safe for a diagnostic screen. */
export function describeCallbackLink(raw: string | null | undefined): string {
  if (!raw) return 'no link';
  const params = paramsOf(raw);
  const secretName = /token|code|sig|secret|verifier|auth/i;
  const keys = params ? [...params.keys()].filter((k) => !secretName.test(k)) : [];
  const hasSecrets = params ? [...params.keys()].some((k) => secretName.test(k)) : false;
  return `path=${pathnameOf(raw) || '?'} params=[${keys.join(',')}${hasSecrets ? ',<redacted>' : ''}]`;
}
