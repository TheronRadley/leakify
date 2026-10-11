/**
 * Client half of full cloud account deletion.
 *
 * The privileged work happens in `supabase/functions/delete-account` (see that
 * file for deployment + required secrets). All this module does is pass the
 * caller's own session to it and translate the result into a RepositoryError the
 * UI can show. It never sends a user id, and it never falls back to "assume it
 * worked" when the function is not deployed — a missing function is reported as
 * an incomplete deletion, because that is what it is.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RepositoryError } from '@/services/repository';

export interface CloudDeletionOutcome {
  /** True when the server confirmed rows + auth identity are gone. */
  deleted: boolean;
  /** True when the identity was already gone (a retry is not an error). */
  alreadyDeleted: boolean;
}

export const DELETE_ACCOUNT_FUNCTION = 'delete-account';

export async function deleteCloudAccount(db: SupabaseClient): Promise<CloudDeletionOutcome> {
  const { data, error: sessionError } = await db.auth.getSession();
  if (sessionError || !data.session) {
    throw new RepositoryError('unauthorized', 'Your session has expired. Sign in again and try once more.');
  }

  let result: { data?: unknown; error?: { message?: string } | null };
  try {
    result = await db.functions.invoke<{ deleted?: boolean; alreadyDeleted?: boolean; error?: string }>(
      DELETE_ACCOUNT_FUNCTION,
      { method: 'POST', body: {} },
    );
  } catch (err) {
    throw new RepositoryError(
      'network',
      err instanceof Error && err.message.includes('Failed to fetch')
        ? 'Could not reach the server. Check your connection and try again.'
        : 'Account deletion could not be completed. Please try again.',
    );
  }

  // Supabase's invoke() folds non-2xx responses into `error` while still
  // returning the parsed body in `data`, so both must be inspected.
  const body = (result.data ?? {}) as { deleted?: boolean; alreadyDeleted?: boolean; error?: string };
  if (result.error && body.deleted !== true) {
    const message = typeof body.error === 'string' ? body.error : '';
    // A 404 means the function was never deployed: say so instead of pretending
    // the account is gone.
    const notDeployed = /404|not found|invoked function/i.test(message);
    throw new RepositoryError(
      'unknown',
      notDeployed
        ? 'Cloud account deletion is not set up on this project yet, so your account was not deleted. Your data on the server is still there.'
        : message || 'Account deletion did not complete. Please try again.',
    );
  }

  return { deleted: body.deleted === true, alreadyDeleted: body.alreadyDeleted === true };
}
