import { AUTH_CALLBACK_PATH, buildRedirectTarget, describeCallbackLink, parseAuthCallback } from '@/lib/auth-links';

const WEB = `https://leakify.example.com${AUTH_CALLBACK_PATH}`;
const UUID = '4d7f9c1a-2b3c-4d5e-8f60-112233445567';

describe('parseAuthCallback - PKCE code links', () => {
  it('accepts a bare code on the callback route', () => {
    expect(parseAuthCallback(`${WEB}?code=4d7f9c1a-2b3c-4d5e-8f60-112233445566`)).toEqual({
      kind: 'auth-code',
      code: '4d7f9c1a-2b3c-4d5e-8f60-112233445566',
    });
  });

  it('reports the state without turning it into a session', () => {
    // `state` is the PKCE flow id; carrying it through is what lets the caller
    // pair the code with the verifier that is already on this device.
    const result = parseAuthCallback(`${WEB}?code=${UUID}&state=xyz123`);
    expect(result).toMatchObject({ kind: 'auth-code', code: UUID, state: 'xyz123' });
  });

  it('accepts a native scheme link', () => {
    expect(parseAuthCallback(`leakify://auth/callback?code=4d7f9c1a-2b3c-4d5e-8f60-112233445567`)).toEqual({ kind: 'auth-code', code: UUID });
  });

  it('ignores a code that arrives on a pathless or foreign route', () => {
    // A deep link from anywhere else must not turn into an authenticated action.
    expect(parseAuthCallback(`leakify://?code=4d7f9c1a-2b3c-4d5e-8f60-112233445567&state=xyz`).kind).toBe('not-an-auth-link');
    expect(parseAuthCallback(`https://leakify.example.com/subscriptions/9?code=4d7f9c1a-2b3c-4d5e-8f60-112233445567`).kind).toBe('not-an-auth-link');
  });

  it('refuses legacy implicit-grant links that carry tokens in the fragment', () => {
    const result = parseAuthCallback(`${WEB}#access_token=jwt&refresh_token=jwt2&token_type=bearer`);
    expect(result.kind).toBe('failed');
  });
});

describe('parseAuthCallback - token hash links', () => {
  it('accepts a recovery token hash', () => {
    expect(parseAuthCallback(`${WEB}?token_hash=Tok_1234567890abcdef&type=recovery`)).toEqual({
      kind: 'recovery-token',
      tokenHash: 'Tok_1234567890abcdef',
      type: 'recovery',
    });
  });

  it('rejects other OTP types instead of guessing', () => {
    expect(parseAuthCallback(`${WEB}?token_hash=Tok_123&type=signup`).kind).toBe('failed');
  });
});

describe('parseAuthCallback - outcomes that are not errors to hide', () => {
  it('treats a cancelled confirmation as a cancellation', () => {
    expect(parseAuthCallback(`${WEB}?error_code=access_denied&error_description=User%20cancelled`)).toEqual({
      kind: 'cancelled',
    });
  });

  it('classifies a provider error without echoing its text', () => {
    const result = parseAuthCallback(`${WEB}?error=server_error&error_description=token%20expired`);
    if (result.kind !== 'failed') throw new Error(`expected a failure, got ${result.kind}`);
    expect(result.reason).toBe('expired');
    expect(JSON.stringify(result)).not.toContain('server_error');
  });

  it('prefers the error over a code when both are present', () => {
    expect(parseAuthCallback(`${WEB}?code=abc&error=invalid_request`).kind).toBe('failed');
  });

  it('passes through a token-less code error message', () => {
    const result = parseAuthCallback(`${WEB}?error=invalid_request&error_code=otp_expired`);
    expect(result).toEqual({ kind: 'failed', reason: 'expired', message: 'otp_expired' });
  });
});

describe('parseAuthCallback - everything else', () => {
  it('ignores unrelated links', () => {
    for (const url of [null, undefined, '', 'not a url', 'leakify://subscriptions/123?tab=next-due']) {
      expect(parseAuthCallback(url).kind).toBe('not-an-auth-link');
    }
  });

  it('reports an empty or malformed code as invalid rather than exchanging it', () => {
    expect(parseAuthCallback(`${WEB}?code=`)).toEqual({ kind: 'failed', reason: 'invalid' });
    expect(parseAuthCallback(`${WEB}?code=short`)).toEqual({ kind: 'failed', reason: 'invalid' });
  });

  it('never returns a link value that looks like a JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdef';
    const result = parseAuthCallback(`${WEB}?code=${jwt}`);
    expect(result.kind).toBe('failed');
  });
});

describe('buildRedirectTarget', () => {
  it('uses the web origin and trims trailing slashes', () => {
    expect(buildRedirectTarget({ scheme: 'leakify', webOrigin: 'https://app.example.test/' })).toBe(
      'https://app.example.test/auth/callback',
    );
  });

  it('falls back to the custom scheme on native', () => {
    expect(buildRedirectTarget({ scheme: 'leakify' })).toBe('leakify://auth/callback');
  });

  it('returns undefined rather than inventing an unsafe redirect', () => {
    expect(buildRedirectTarget({})).toBeUndefined();
  });

  it('keeps the route consistent for both platforms', () => {
    expect(buildRedirectTarget({ scheme: 'leakify', webOrigin: 'https://app.example.test' })).toBe(
      'https://app.example.test/auth/callback',
    );
    expect(buildRedirectTarget({ scheme: 'other-app-scheme' })).toBe('other-app-scheme://auth/callback');
  });
});

describe('describeCallbackLink', () => {
  it('redacts credentials before anything can be logged or displayed', () => {
    const safe = describeCallbackLink(`${WEB}?code=SECRET&token_hash=SECRET2&access_token=JWT&sig=SECRET3&keep=1`);
    expect(safe).not.toContain('SECRET');
    expect(safe).not.toContain('JWT');
    expect(safe).toContain('keep');
  });

  it('handles a malformed link without throwing', () => {
    expect(() => describeCallbackLink('not a url')).not.toThrow();
  });
});
