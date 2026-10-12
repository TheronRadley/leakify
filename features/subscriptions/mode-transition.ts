/**
 * Data-mode transitions (audit U-04 / N-03).
 *
 * Leakify keeps three scopes: `demo`, `local-user` and the signed-in user's id.
 * Switching mode never DELETES anything — but it does stop showing you the data
 * from the scope you left, which reads exactly like data loss if nobody says so.
 *
 * This module is the single place that decides whether a switch needs a warning
 * and what that warning says, so the policy is testable and the screens cannot
 * drift from it. Pure: no React Native, no storage access.
 */
import type { DataMode } from '@/types';

export interface ModeTransitionContext {
  from: DataMode | null;
  to: DataMode;
  /** Subscriptions currently in the scope you are leaving. */
  itemCount: number;
}

export interface ModeTransitionAdvice {
  /** Show a confirmation before switching. */
  requiresConfirmation: boolean;
  /** True when rows stay on the device but out of sight after the switch. */
  dataLeftBehind: boolean;
  headline: string;
  detail: string;
  /** Actions the UI should offer. `none` means just proceed. */
  actions: ('export_first' | 'continue')[];
}

const NO_WARNING: ModeTransitionAdvice = {
  requiresConfirmation: false,
  dataLeftBehind: false,
  headline: '',
  detail: '',
  actions: ['continue'],
};

function plural(n: number): string {
  return `${n} subscription${n === 1 ? '' : 's'}`;
}

/**
 * Where the data you are leaving actually lives, in words a user can act on.
 * Nothing is deleted by a mode switch — say so, and say how to get it back.
 */
export function assessModeTransition(ctx: ModeTransitionContext): ModeTransitionAdvice {
  const { from, to, itemCount } = ctx;
  if (from === to || from === null) return NO_WARNING;

  const movingToCloud = to === 'supabase';
  const leavingCloud = from === 'supabase';

  if (leavingCloud) {
    // Cloud rows stay in the cloud and come back on the next sign-in.
    return {
      requiresConfirmation: false,
      dataLeftBehind: false,
      headline: '',
      detail: '',
      actions: ['continue'],
    };
  }

  if (itemCount === 0) return NO_WARNING;

  if (movingToCloud) {
    return {
      requiresConfirmation: true,
      dataLeftBehind: true,
      headline: `Your ${plural(itemCount)} stay on this device`,
      detail:
        'On-device data is not uploaded or merged into your account — it stays in local mode, ' +
        'where you can still reach it by switching back. Export it first if you want a copy ' +
        '(Settings → Data & privacy → Export my data).',
      actions: ['export_first', 'continue'],
    };
  }

  // local <-> demo: both scopes live on this device, and only one is visible at a time.
  return {
    requiresConfirmation: true,
    dataLeftBehind: true,
    headline: `Switching hides your ${plural(itemCount)}`,
    detail:
      from === 'demo'
        ? 'Demo data is kept separately and nothing is deleted, but you will not see it while you are in your own data. Switch back to the demo to find it again.'
        : 'Your own data is kept separately and nothing is deleted, but you will not see it while you are in the demo. Switch back to your own data to find it again.',
    actions: ['export_first', 'continue'],
  };
}
