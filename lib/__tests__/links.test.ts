import {
  ALLOW_INSECURE_HTTP,
  checkExternalUrl,
  externalUrlFailureMessage,
  isSafeExternalUrl,
} from '@/lib/links';

describe('checkExternalUrl — the open-time link policy', () => {
  it('accepts https links and normalizes them', () => {
    const result = checkExternalUrl('https://www.netflix.com/cancelplan');
    expect(result).toEqual({
      ok: true,
      url: 'https://www.netflix.com/cancelplan',
      host: 'www.netflix.com',
    });
  });

  it('is case-insensitive about the scheme (the old regex was not)', () => {
    expect(isSafeExternalUrl('HTTPS://EXAMPLE.COM/cancel')).toBe(true);
    expect(checkExternalUrl('HTTPS://EXAMPLE.COM/cancel')).toMatchObject({ ok: true });
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(checkExternalUrl('  https://example.com/x  ')).toMatchObject({ ok: true });
  });

  it.each([
    ['javascript:alert(1)', 'unsupported_scheme'],
    ['intent://x#Intent;scheme=https;end', 'unsupported_scheme'],
    ['file:///etc/passwd', 'unsupported_scheme'],
    ['data:text/html,<script>alert(1)</script>', 'unsupported_scheme'],
    ['leakify://tabs', 'unsupported_scheme'],
    ['ftp://example.com/file', 'unsupported_scheme'],
  ])('rejects %s as %s', (input, reason) => {
    expect(checkExternalUrl(input)).toEqual({ ok: false, reason });
  });

  it('refuses plain http with its own reason so the UI can explain it', () => {
    expect(ALLOW_INSECURE_HTTP).toBe(false);
    expect(checkExternalUrl('http://example.com/cancel')).toEqual({ ok: false, reason: 'insecure' });
  });

  it.each(['', '   ', null, undefined])('rejects empty input (%j)', (input) => {
    expect(checkExternalUrl(input as string | null | undefined)).toEqual({ ok: false, reason: 'empty' });
  });

  it.each(['not a url', 'https://', 'www.example.com/cancel', '://missing-scheme.com'])(
    'rejects malformed input %j',
    (input) => {
      const result = checkExternalUrl(input);
      expect(result.ok).toBe(false);
    },
  );

  it('refuses URLs with embedded credentials (look-alike phishing shape)', () => {
    expect(checkExternalUrl('https://trusted.example@evil.example/cancel')).toEqual({
      ok: false,
      reason: 'embedded_credentials',
    });
  });

  it('validates exactly the string it will hand to the OS', () => {
    // WHATWG collapses the extra slashes, so this is evil.example — and the
    // returned href is the same URL that gets opened, so the check cannot be
    // bypassed by a difference between the two parsers.
    const result = checkExternalUrl('https:///evil.example/x');
    expect(result).toEqual({ ok: true, url: 'https://evil.example/x', host: 'evil.example' });
  });

  it('explains every failure mode in user-safe language', () => {
    for (const reason of [
      'empty',
      'malformed',
      'insecure',
      'unsupported_scheme',
      'missing_host',
      'embedded_credentials',
    ] as const) {
      const message = externalUrlFailureMessage(reason);
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/undefined|null|\[object/);
    }
  });
});

describe('https:// links stored before the policy existed', () => {
  it('are still openable, so the policy change does not strand real data', () => {
    expect(isSafeExternalUrl('https://support.spotify.com/cancel')).toBe(true);
  });
});
