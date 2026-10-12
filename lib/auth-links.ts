/**
 * Auth deep-link handling — the pure half.
 *
 * Leakify uses the Supabase **PKCE** flow (`flowType: 'pkce'` in
 * services/supabase.ts). With PKCE the recovery email contains a one-time
 * `code`; the app exchanges it for a session with
 * `exchangeCodeForSession({ code })`. Access tokens never appear in a URL,
 * which is the whole reason to prefer it over the implicit flow.
 *
 * This module only parses and validates — no React, no expo-linking — so the
 * parsing rules are unit-tested in plain Node (lib/__tests__/auth-links.test.ts).
 * services/auth-redirect.ts supplies the runtime-specific redirect target.
 */

/** Route (and therefore deep-link path) that receives the redirect. */
export const AUTH_CALLBACK_PATH = 'auth-callback';

/** Where the user lands after a successful password reset. */
export const RESET_PASSWORD_PATH = 'reset-password';

/**
 * What `type` Supabase puts on the redirect. `recovery` is the password-reset
 * link; the others land the user in the app instead of the reset form.
 */
export type AuthLinkType = 'recovery' | 'signup' | 'magiclink' | 'invite' | 'email_change' | 'unknown';

export type AuthCallbackResult =
  /** PKCE: exchange this code for a session. */
  | { kind: 'code'; code: string; type: AuthLinkType }
  /** Legacy implicit flow: tokens in the URL fragment. Still honoured, but reported. */
  | { kind: 'tokens'; accessToken: string; refreshToken: string; type: AuthLinkType }
  /** Supabase redirected back with an error (expired link, revoked, …). */
  | { kind: 'error'; error: string; description: string }
  /** Nothing recognisable in the URL. */
  | { kind: 'empty' };

/**
 * Credentials a callback route extracted from the redirect, ready to be turned
 * into a session. Kept separate from `AuthCallbackResult` so the auth context
 * only ever accepts something that can actually authenticate.
 */
export type AuthCredentials =
  | { kind: 'code'; code: string }
  | { kind: 'tokens'; accessToken: string; refreshToken: string };

const KNOWN_TYPES: readonly AuthLinkType[] = [
  'recovery',
  'signup',
  'magiclink',
  'invite',
  'email_change',
];

/** PKCE codes are base64url-ish; anything else is not worth sending anywhere. */
const CODE_PATTERN = /^[A-Za-z0-9._~-]{10,512}$/;

export function normalizeAuthLinkType(raw: string | null | undefined): AuthLinkType {
  const value = (raw ?? '').trim().toLowerCase();
  return (KNOWN_TYPES as readonly string[]).includes(value) ? (value as AuthLinkType) : 'unknown';
}

export function isPkceCode(value: string | null | undefined): value is string {
  return typeof value === 'string' && CODE_PATTERN.test(value);
}

function paramsFrom(part: string | null | undefined): URLSearchParams {
  if (!part) return new URLSearchParams();
  const cleaned = part.replace(/^[?#]/, '');
  return new URLSearchParams(cleaned);
}

/**
 * Read an auth redirect out of a location. Both the query string and the
 * fragment are inspected: PKCE lands its `code` in the query, the deprecated
 * implicit flow lands its tokens in the fragment, and some mail clients
 * mangle one into the other.
 */
export function parseAuthCallback(
  search?: string | null,
  hash?: string | null,
): AuthCallbackResult {
  const query = paramsFrom(search);
  const fragment = paramsFrom(hash);
  // Fragment wins for the implicit shape; query wins for everything else.
  const read = (key: string): string | null => query.get(key) ?? fragment.get(key);

  const error = read('error');
  if (error) {
    return {
      kind: 'error',
      error,
      description: read('error_description') ?? humanizeAuthError(error),
    };
  }

  const type = normalizeAuthLinkType(read('type'));
  const code = read('code');
  if (code) {
    if (!isPkceCode(code)) {
      return {
        kind: 'error',
        error: 'invalid_code',
        description: 'The recovery link is malformed. Request a new one from the sign-in screen.',
      };
    }
    return { kind: 'code', code, type };
  }

  const accessToken = read('access_token');
  const refreshToken = read('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'tokens', accessToken, refreshToken, type };
  }

  return { kind: 'empty' };
}

/** Supabase error codes → user-safe sentences. Never echoes raw server text. */
export function humanizeAuthError(error: string): string {
  switch (error.replace(/_/g, ' ').toLowerCase()) {
    case 'access denied':
      return 'That link was rejected. Request a new one from the sign-in screen.';
    case 'otp expired':
      return 'That link has expired. Request a new one from the sign-in screen.';
    case 'otp rate limit exceeded':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'invalid code':
    case 'pkce code verifier not found':
      return 'That link could not be completed on this device. Request a new one and open it here.';
    default:
      return 'That link could not be completed. Request a new one from the sign-in screen.';
  }
}

/**
 * Copy for the recovery screen. Kept here so the promise we make to the user is
 * derived from the flow we actually implement (the previous wording described a
 * deep link that no code handled — audit S-03).
 */
export const RECOVERY_SENT_COPY =
  'Check your inbox — if an account exists for that address, a recovery link is on its way. ' +
  'Open it on this device: Leakify will open and ask you to choose a new password.';

export const RECOVERY_SENT_COPY_NO_DEEPLINK =
  'Check your inbox — if an account exists for that address, a recovery link is on its way. ' +
  'Open the link, then return here to sign in with your new password.';
