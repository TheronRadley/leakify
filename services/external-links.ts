/**
 * The one place that hands a user-supplied URL to the operating system.
 *
 * Every open goes through `checkExternalUrl` (lib/links.ts) first, so the
 * policy is enforced even for rows written by an older app version, a restore,
 * or another client. Failures are returned to the caller as user-safe strings
 * instead of being thrown or silently ignored.
 */
import {
  checkExternalUrl,
  externalUrlFailureMessage,
  type ExternalUrlFailure,
} from '@/lib/links';
import { Linking } from 'react-native';

export type OpenLinkResult =
  | { opened: true; url: string; host: string }
  | { opened: false; reason: ExternalUrlFailure; message: string }
  | { opened: false; reason: 'open_failed'; message: string };

/**
 * Validate, then open. Returns a result rather than throwing so screens can
 * render an inline explanation (a dead button with no feedback is how users
 * end up thinking the app is broken).
 */
export async function openExternalUrl(raw: string | null | undefined): Promise<OpenLinkResult> {
  const check = checkExternalUrl(raw);
  if (!check.ok) {
    return {
      opened: false,
      reason: check.reason,
      message: externalUrlFailureMessage(check.reason),
    };
  }
  try {
    // canOpenURL is unavailable on web; openURL rejects there instead.
    const opened = await Linking.openURL(check.url);
    if (opened === false) {
      return {
        opened: false,
        reason: 'open_failed',
        message: 'Your device could not open that link. Copy it into your browser instead.',
      };
    }
    return { opened: true, url: check.url, host: check.host };
  } catch {
    return {
      opened: false,
      reason: 'open_failed',
      message: 'Your device could not open that link. Copy it into your browser instead.',
    };
  }
}
