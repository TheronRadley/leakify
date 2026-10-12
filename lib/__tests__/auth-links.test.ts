import {
  humanizeAuthError,
  isPkceCode,
  normalizeAuthLinkType,
  parseAuthCallback,
  RECOVERY_SENT_COPY,
} from '@/lib/auth-links';

/** What Supabase appends to the configured redirectTo for a PKCE recovery link. */
const VALID_CODE = 'cde4a1f0-2b6d-4a3e-9f11-8b0a1c2d3e4f';

describe('parseAuthCallback', () => {
  it('reads a PKCE code and its link type from the query string', () => {
    expect(parseAuthCallback(`?code=${VALID_CODE}&type=recovery`, '')).toEqual({
      kind: 'code',
      code: VALID_CODE,
      type: 'recovery',
    });
  });

  it('works with the raw query values expo-router hands a native route', () => {
    expect(parseAuthCallback(`code=${VALID_CODE}`, null)).toMatchObject({ kind: 'code' });
  });

  it('defaults an absent type to unknown', () => {
    expect(parseAuthCallback(`?code=${VALID_CODE}`, '')).toMatchObject({ type: 'unknown' });
  });

  it('reads implicit-flow tokens out of the fragment', () => {
    expect(
      parseAuthCallback('', '#access_token=aaa.bbb.ccc&refresh_token=rrr&type=recovery'),
    ).toEqual({
      kind: 'tokens',
      accessToken: 'aaa.bbb.ccc',
      refreshToken: 'rrr',
      type: 'recovery',
    });
  });

  it('surfaces Supabase errors with a human message', () => {
    const result = parseAuthCallback('?error=otp_expired', '');
    expect(result).toEqual({
      kind: 'error',
      error: 'otp_expired',
      description: 'That link has expired. Request a new one from the sign-in screen.',
    });
  });

  it('keeps the server’s own description when one is provided', () => {
    expect(parseAuthCallback('?error=access_denied&error_description=Denied+by+admin', '')).toEqual({
      kind: 'error',
      error: 'access_denied',
      description: 'Denied by admin',
    });
  });

  it('reports an empty callback rather than pretending to succeed', () => {
    expect(parseAuthCallback('', '')).toEqual({ kind: 'empty' });
    expect(parseAuthCallback(undefined, undefined)).toEqual({ kind: 'empty' });
    expect(parseAuthCallback('?foo=bar', '')).toEqual({ kind: 'empty' });
  });

  it('refuses a malformed code instead of sending it to the server', () => {
    const result = parseAuthCallback('?code=<script>alert(1)</script>', '');
    expect(result).toMatchObject({ kind: 'error', error: 'invalid_code' });
  });

  it('refuses a half-present token pair (implicit flow needs both)', () => {
    expect(parseAuthCallback('', '#access_token=only-one')).toEqual({ kind: 'empty' });
  });
});

describe('isPkceCode', () => {
  it('accepts base64url-ish codes', () => {
    expect(isPkceCode(VALID_CODE)).toBe(true);
    expect(isPkceCode('abcDEF123._~-')).toBe(true);
  });

  it('rejects short, empty or punctuated values', () => {
    expect(isPkceCode('short')).toBe(false);
    expect(isPkceCode('')).toBe(false);
    expect(isPkceCode(null)).toBe(false);
    expect(isPkceCode('has spaces in it!!')).toBe(false);
  });
});

describe('normalizeAuthLinkType', () => {
  it.each(['recovery', 'signup', 'magiclink', 'invite', 'email_change'])('keeps %s', (type) => {
    expect(normalizeAuthLinkType(type)).toBe(type);
  });

  it('maps anything else to unknown', () => {
    expect(normalizeAuthLinkType('bogus')).toBe('unknown');
    expect(normalizeAuthLinkType(null)).toBe('unknown');
    expect(normalizeAuthLinkType('RECOVERY')).toBe('recovery');
  });
});

describe('humanizeAuthError', () => {
  it('never echoes raw server text back at the user', () => {
    expect(humanizeAuthError('some_raw_internal_error')).toBe(
      'That link could not be completed. Request a new one from the sign-in screen.',
    );
  });

  it('explains a code verifier that is not on this device', () => {
    expect(humanizeAuthError('PKCE code verifier not found')).toContain('this device');
  });
});

describe('recovery screen copy', () => {
  it('describes the flow we actually implement', () => {
    // The previous copy promised the link "opens Leakify" with no route to
    // receive it (audit S-03). The claim must stay tied to a real deep link.
    expect(RECOVERY_SENT_COPY).toContain('Open it on this device');
    expect(RECOVERY_SENT_COPY).toContain('new password');
  });
});
