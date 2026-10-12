/**
 * External-URL policy — the single place that decides which links Leakify will
 * open. Pure module: no React Native imports, so the policy is unit-tested in
 * plain Node (see lib/__tests__/links.test.ts). The thin RN wrapper that
 * actually calls `Linking.openURL` lives in services/external-links.ts.
 *
 * Why re-validate at open time when the form already validates?
 * - Rows can predate a policy change (data imported, restored, or written by an
 *   older app version / by another client using the anon key).
 * - Form validation and the open call are far apart in the code; keeping the
 *   guard next to the open makes the invariant local and reviewable.
 *
 * POLICY (explicit, per audit S-05):
 *   HTTPS only. `http://` cancellation links are refused at open time and
 *   rejected by the form. Plain HTTP would send a user to a provider page over
 *   a connection that can be rewritten in transit, and a rewritten
 *   "cancel your subscription" page is a credential-phishing vector. Every
 *   mainstream provider publishes an HTTPS cancellation page, so nothing real
 *   is lost. `javascript:`, `intent:`, `file:`, `data:` and friends are
 *   rejected because they are not web URLs at all.
 *
 * To allow HTTP deliberately, flip ALLOW_INSECURE_HTTP — but then fix the form
 * message in lib/validation.ts in the same change, or the two will disagree.
 */

/** Schemes Leakify will hand to the OS to open. HTTPS only — see above. */
export const ALLOWED_EXTERNAL_SCHEMES: readonly string[] = ['https:'];

/** Deliberate escape hatch. Changing this weakens the policy above. */
export const ALLOW_INSECURE_HTTP = false;

export type ExternalUrlFailure =
  | 'empty'
  | 'malformed'
  | 'unsupported_scheme'
  | 'insecure'
  | 'missing_host'
  /** `https://looks-trusted.com@evil.example/` — refused: it is a phishing shape. */
  | 'embedded_credentials';

export type ExternalUrlCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: ExternalUrlFailure };

function allowedSchemes(): string[] {
  return ALLOW_INSECURE_HTTP ? [...ALLOWED_EXTERNAL_SCHEMES, 'http:'] : [...ALLOWED_EXTERNAL_SCHEMES];
}

/**
 * Parse-and-check a user-supplied URL. Never throws. Returns the normalized
 * `href` (what should actually be opened) so callers cannot pass a different
 * string to the OS than the one that was validated.
 */
export function checkExternalUrl(raw: string | null | undefined): ExternalUrlCheck {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value.length === 0) return { ok: false, reason: 'empty' };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const scheme = parsed.protocol.toLowerCase();
  const allowed = allowedSchemes();
  if (!allowed.includes(scheme)) {
    // `http:` gets its own reason so the UI can explain it specifically.
    if (scheme === 'http:' && !ALLOW_INSECURE_HTTP) return { ok: false, reason: 'insecure' };
    return { ok: false, reason: 'unsupported_scheme' };
  }
  if (!parsed.hostname || parsed.hostname.length === 0) return { ok: false, reason: 'missing_host' };
  // Credentials in a URL (`https://good.example@evil.example/`) are a classic
  // look-alike trick: the browser shows the host AFTER the @. Refuse them.
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return { ok: false, reason: 'embedded_credentials' };
  }

  return { ok: true, url: parsed.href, host: parsed.hostname };
}

/** Human-readable explanation for a refused link. Safe to show to the user. */
export function externalUrlFailureMessage(reason: ExternalUrlFailure): string {
  switch (reason) {
    case 'empty':
      return 'No link is saved for this subscription.';
    case 'malformed':
      return 'That link is not a valid URL, so Leakify will not open it.';
    case 'insecure':
      return 'That link uses http:// instead of https://. Leakify only opens secure links — edit the subscription to use the https:// address.';
    case 'unsupported_scheme':
      return 'Leakify only opens https:// links. This address uses a different scheme.';
    case 'missing_host':
      return 'That link has no website address, so Leakify will not open it.';
    case 'embedded_credentials':
      return 'That link embeds a username, which is how look-alike phishing links are built. Leakify will not open it.';
  }
}

/** True when a stored/form value is a link Leakify is willing to open. */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  return checkExternalUrl(raw).ok;
}

/**
 * Form-time variant: matches the open-time policy exactly (case-insensitive
 * scheme, real hostname) so a value that passes the form is guaranteed to pass
 * the open guard. Used by lib/validation.ts.
 */
export function isFormValidUrl(raw: string): boolean {
  return isSafeExternalUrl(raw);
}
