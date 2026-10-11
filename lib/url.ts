/**
 * Cancellation-URL policy — one validator, used at three moments:
 * form submission, repository write, and immediately before `Linking.openURL`.
 *
 * Product decision (documented in README → "Cancellation links"): Leakify only
 * stores and opens **HTTPS links to a real host**. Providers all serve HTTPS
 * today, so the cost of refusing `http://` is negligible, while the benefit is
 * that a link a user pastes can never turn into a cleartext request, a
 * localhost/internal-address probe, or an intent/custom-scheme handoff to
 * another app.
 *
 * Deliberate choices:
 * - Parsed with the WHATWG `URL` parser, not a regex, so scheme handling is
 *   case-insensitive (`HTTPS://` is valid) and cannot be tricked by embedded
 *   tabs/newlines (those are rejected outright, since `URL` silently deletes
 *   them — which is exactly how `java\nscript:` style payloads slip past
 *   naive checks).
 * - Internationalized (non-ASCII) hosts are refused rather than punycoded, to
 *   close homoglyph look-alike domains.
 * - IP literals, single-label hosts and non-default ports are refused.
 * - Credentials in the URL (`https://pa@paypa.al/`) are refused.
 *
 * The returned `href` is the normalized form the app stores, so what was
 * validated is what gets opened.
 */

/** Absolute cap; well past any real cancellation link and a cheap DoS guard. */
export const MAX_URL_LENGTH = 2048;

export type CancellationUrlErrorCode =
  | 'empty'
  | 'too_long'
  | 'control_characters'
  | 'relative'
  | 'unparseable'
  | 'protocol'
  | 'credentials'
  | 'host'
  | 'port'
  | 'unsupported_runtime';

export interface CancellationUrlRejection {
  ok: false;
  code: CancellationUrlErrorCode;
  /** User-safe text. Never echoes the rejected value back. */
  message: string;
}

export interface CancellationUrlAcceptance {
  ok: true;
  /** Normalized absolute URL — store and open this, not the raw input. */
  href: string;
  hostname: string;
  origin: string;
}

export type CancellationUrlResult = CancellationUrlAcceptance | CancellationUrlRejection;

export interface CancellationUrlOptions {
  /**
   * Allow `http://`. Off by default; only flip it for a documented internal
   * deployment, and never to make a pasted link "work".
   */
  allowHttp?: boolean;
}

const MESSAGES: Record<CancellationUrlErrorCode, string> = {
  empty: 'Enter a cancellation link.',
  too_long: 'That link is too long to be valid.',
  control_characters: 'Remove spaces or line breaks from the link.',
  relative: 'Enter the full link, starting with https://',
  unparseable: 'That is not a valid link.',
  protocol: 'Use a secure https:// link.',
  credentials: 'Remove the user name and password from the link.',
  host: 'That link does not point at a valid website address.',
  port: 'Only standard web links are allowed (no custom port).',
  unsupported_runtime: 'Link checking is unavailable in this build.',
};

const reject = (code: CancellationUrlErrorCode): CancellationUrlRejection => ({ ok: false, code, message: MESSAGES[code] });

/** `label.tld` with ASCII letters/digits/hyphens only; no IP literals, no IDN. */
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/**
 * A label starting with the IDNA punycode prefix is either an attack or a
 * hand-typed homoglyph encoding. Providers do not use such domains for
 * cancellation pages, so refusing them costs nothing and closes the gap that
 * `URL`'s automatic punycode conversion would otherwise open.
 */
const PUNYCODE_LABEL_RE = /(^|\.)xn--/i;

/**
 * Validate one cancellation link. Returns a result object (not a throw) so the
 * form layer can surface the message and callers that must fail closed can
 * check `.ok`.
 */
export function validateCancellationUrl(
  raw: unknown,
  options: CancellationUrlOptions = {},
): CancellationUrlResult {
  if (typeof raw !== 'string') return reject('unparseable');
  const value = raw.trim();
  if (value.length === 0) return reject('empty');
  if (value.length > MAX_URL_LENGTH) return reject('too_long');

  // Control characters (incl. tab/newline) are the classic URL-parser confusion
  // vector: reject before parsing rather than letting `URL` strip them.
  if (/[\u0000-\u0020\u007f]/.test(value)) return reject('control_characters');

  // Protocol-relative (`//host/x`) and root-relative links are resolved against
  // whatever the platform happens to consider "current", so they are refused.
  if (value.startsWith('//') || value.startsWith('/')) return reject('relative');

  // Non-ASCII anywhere (typical of homoglyph domains) is refused before parsing;
  // `URL` would happily punycode it into something that looks different.
  if (/[^\u0021-\u007e]/.test(value)) return reject('host');

  // React Native only has a WHATWG URL through `react-native-url-polyfill/auto`
  // (imported by app/_layout.tsx and services/supabase.ts). If it is missing we
  // fail closed rather than falling back to a weaker regex check.
  const UrlCtor: typeof URL | undefined = (globalThis as { URL?: typeof URL }).URL;
  if (typeof UrlCtor !== 'function') return reject('unsupported_runtime');

  let parsed: URL;
  try {
    parsed = new UrlCtor(value);
  } catch {
    return reject('unparseable');
  }

  const allowed = parsed.protocol === 'https:' || (options.allowHttp === true && parsed.protocol === 'http:');
  if (!allowed) return reject('protocol'); // covers javascript:, data:, file:, intent:, mailto:, leakify:, ...

  if (parsed.username.length > 0 || parsed.password.length > 0) return reject('credentials');

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!HOSTNAME_RE.test(hostname) || PUNYCODE_LABEL_RE.test(hostname)) return reject('host');

  const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
  if (parsed.port !== '' && parsed.port !== defaultPort) return reject('port');

  return { ok: true, href: parsed.href, hostname, origin: parsed.origin };
}

/** Convenience predicate for open-time gates. */
export function isSafeCancellationUrl(raw: unknown, options?: CancellationUrlOptions): boolean {
  return validateCancellationUrl(raw, options).ok;
}

/**
 * Normalized, validated URL string — or `null` for "no link provided".
 * Repository write paths use this so a value that never passed the policy can
 * not reach storage through a non-form caller (import, migration, tests).
 */
export function normalizeCancellationUrl(
  raw: unknown,
  options: CancellationUrlOptions = {},
): { value: string | null } | CancellationUrlRejection {
  if (typeof raw === 'string' && raw.trim() === '') return { value: null };
  if (raw === null || raw === undefined) return { value: null };
  const result = validateCancellationUrl(raw, options);
  return result.ok ? { value: result.href } : result;
}
