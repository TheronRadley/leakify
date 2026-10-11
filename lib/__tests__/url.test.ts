/**
 * Cancellation-URL policy tests. The property under test is "nothing reaches
 * storage or the platform opener unless the exact normalized string passed the
 * policy" — so both accept and reject cases matter, including the parser
 * confusion vectors that a regex check used to let through.
 */
import { isSafeCancellationUrl, normalizeCancellationUrl, validateCancellationUrl } from '@/lib/url';

function accept(raw: string) {
  const result = validateCancellationUrl(raw);
  if (!result.ok) throw new Error(`expected acceptance, got ${result.code}: ${result.message}`);
  return result;
}

function rejectCode(raw: string) {
  const result = validateCancellationUrl(raw);
  if (result.ok) throw new Error(`expected rejection, accepted as ${result.href}`);
  return result;
}

describe('validateCancellationUrl — accepts', () => {
  it('accepts an ordinary https link', () => {
    expect(accept('https://www.netflix.com/cancelplan').href).toBe('https://www.netflix.com/cancelplan');
  });

  it('accepts an uppercase scheme and normalizes it (case-sensitive regex used to reject this)', () => {
    expect(accept('HTTPS://Example.COM/cancel').href).toBe('https://example.com/cancel');
  });

  it('accepts query strings, fragments and paths', () => {
    expect(accept('https://account.example.com/sub/cancel?confirm=1#top').hostname).toBe(
      'account.example.com',
    );
  });

  it('accepts the explicit default port (the URL parser normalizes it away)', () => {
    const result = accept('https://example.com:443/cancel');
    expect(result.hostname).toBe('example.com');
    expect(result.href).toBe('https://example.com/cancel');
  });

  it('accepts subdomains and hyphens', () => {
    expect(accept('https://my-account.example.co.uk/c').hostname).toBe('my-account.example.co.uk');
  });
});

describe('validateCancellationUrl — rejects', () => {
  it('rejects http by default and accepts it only when explicitly allowed', () => {
    expect(rejectCode('http://example.com/cancel').code).toBe('protocol');
    expect(validateCancellationUrl('http://example.com/cancel', { allowHttp: true }).ok).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'file:///etc/passwd',
    'intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;end',
    'data:text/html;base64,PHNjcmlwdD4=',
    'blob:https://example.com/uuid',
    'mailto:support@example.com',
    'leakify://settings',
    'about:blank',
    'view-source:https://example.com',
  ])('rejects the non-web scheme in %s', (raw) => {
    expect(rejectCode(raw).code).toBe('protocol');
  });

  it('rejects scheme-relative and root-relative links', () => {
    expect(rejectCode('//evil.example.com/cancel').code).toBe('relative');
    expect(rejectCode('/cancel').code).toBe('relative');
  });

  it('rejects a missing or malformed host', () => {
    expect(rejectCode('https://').code).toBe('unparseable');
    expect(rejectCode('https://localhost:3000/cancel').code).toBe('host');
    expect(rejectCode('https://127.0.0.1/cancel').code).toBe('host');
    expect(rejectCode('https://[::1]/cancel').code).toBe('host');
    expect(rejectCode('https://notaurl').code).toBe('host');
    expect(rejectCode('not a url').code).toBe('control_characters');
  });

  it('rejects embedded credentials', () => {
    expect(rejectCode('https://user:pw@example.com/cancel').code).toBe('credentials');
    // WHATWG treats `\` as `/` for special schemes, so this stays on evil.com —
    // assert there is no silent hop to the host after the `@`.
    const backslash = validateCancellationUrl('https://evil.com\\@pay.example.com/cancel');
    expect(backslash.ok ? backslash.hostname : backslash.code).toBe('evil.com');
    // A bare `@` in a path is fine and must not be mistaken for credentials.
    expect(accept('https://example.com/cancel/me%40example.com').ok).toBe(true);
  });

  it('rejects internal/odd ports', () => {
    expect(rejectCode('https://example.com:8443/cancel').code).toBe('port');
    expect(rejectCode('http://example.com:8080/x').code).toBe('protocol');
  });

  it('rejects control characters and embedded whitespace that URL would silently delete', () => {
    expect(rejectCode('https://exa mple.com/cancel').code).toBe('control_characters');
    expect(rejectCode('java\nscript:alert(1)').code).toBe('control_characters');
    expect(rejectCode(' https://exam ple.com/c ').code).toBe('control_characters');
    // Surrounding whitespace only is trimmed first, which is what a paste does.
    expect(accept('  https://example.com/cancel\n  ').href).toBe('https://example.com/cancel');
  });

  it('rejects non-ASCII and punycode-looking hosts (homoglyph defence)', () => {
    expect(rejectCode('https://paypaе.com/cancel').code).toBe('host'); // Cyrillic 'е'
    expect(rejectCode('https://exämple.com').code).toBe('host');
    expect(rejectCode('https://xn--exmple-cua.com').code).toBe('host');
  });

  it('rejects empty, blank and over-long values', () => {
    expect(rejectCode('').code).toBe('empty');
    expect(rejectCode('   ').code).toBe('empty');
    expect(rejectCode(`https://example.com/${'a'.repeat(3000)}`).code).toBe('too_long');
  });

  it('rejects non-string input', () => {
    expect(rejectCode(undefined as unknown as string).code).toBe('unparseable');
    expect(rejectCode({ href: 'https://example.com' } as unknown as string).code).toBe('unparseable');
  });
});

describe('normalizeCancellationUrl', () => {
  it('treats blank and absent as "no link" rather than an error', () => {
    expect(normalizeCancellationUrl('')).toEqual({ value: null });
    expect(normalizeCancellationUrl('   ')).toEqual({ value: null });
    expect(normalizeCancellationUrl(null)).toEqual({ value: null });
    expect(normalizeCancellationUrl(undefined)).toEqual({ value: null });
  });

  it('returns the normalized href for storage', () => {
    expect(normalizeCancellationUrl('  HTTPS://Example.com/x  ')).toEqual({ value: 'https://example.com/x' });
  });

  it('passes rejections through untouched so callers can fail closed', () => {
    const result = normalizeCancellationUrl('javascript:alert(1)');
    expect('code' in result && result.code).toBe('protocol');
  });
});

describe('isSafeCancellationUrl (open-time gate)', () => {
  it('mirrors the validator', () => {
    expect(isSafeCancellationUrl('https://example.com/cancel')).toBe(true);
    expect(isSafeCancellationUrl('http://example.com/cancel')).toBe(false);
    expect(isSafeCancellationUrl('')).toBe(false);
    expect(isSafeCancellationUrl(null)).toBe(false);
  });
});
