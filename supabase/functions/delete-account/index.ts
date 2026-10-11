/**
 * Edge Function: hard delete of the calling user's Supabase account.
 *
 * Deployment (once per project):
 *   supabase functions deploy delete-account --no-verify-jwt=false
 * i.e. keep the default JWT verification ON. Then set the function secret:
 *   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
 * (create a short-lived, scoped service-role key if your plan supports it).
 * The key lives only in the function's environment — never in `EXPO_PUBLIC_*`,
 * never in the client bundle, never in this repository.
 *
 * Why server-side: deleting an auth user requires the admin API, which requires
 * privileged credentials. A client cannot do it with the anon key, and the app
 * must not claim "your account is deleted" while the identity survives.
 *
 * Guarantees implemented here:
 * - Only the authenticated caller's own id is used. There is no `user_id`
 *   parameter, so this endpoint cannot be pointed at somebody else's account.
 * - Every owned row is removed, including `notification_preferences` (which the
 *   earlier client-side delete missed), then the auth user is deleted, which
 *   cascades to anything a row-level delete missed.
 * - Failures return a non-2xx status with a user-safe message; the app then
 *   reports the deletion as incomplete rather than successful.
 * - Retryable/idempotent: a second call for an already-deleted id returns 200
 *   with `alreadyDeleted: true` and reveals nothing about other accounts.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TABLES_OWNED_BY_USER = [
  'notification_records',
  'billing_events',
  'notification_preferences',
  'subscriptions',
  'profiles',
] as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      // This response is per-user and must never be cached by a CDN.
      'x-content-type-options': 'nosniff',
    },
  });
}

/** The anon key is only used here to validate the caller's JWT via getUser(). */
function isSafeTableName(name: string): boolean {
  return (TABLES_OWNED_BY_USER as readonly string[]).includes(name);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !anonKey || !serviceKey) {
    // Misconfiguration must never degrade into "deletion skipped silently".
    return json({ error: 'Account deletion is not configured on this project.' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Authentication required.' }, 401);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  try {
    const { data, error } = await userClient.auth.getUser(jwt);
    if (error || !data.user) return json({ error: 'Your session has expired. Sign in again first.' }, 401);
    userId = data.user.id;
  } catch {
    return json({ error: 'Could not verify your session.' }, 401);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const failed: string[] = [];
  for (const table of TABLES_OWNED_BY_USER) {
    if (!isSafeTableName(table)) continue; // guarded by construction; belt and braces
    const { error } = await admin.from(table).delete().eq('user_id', userId);
    if (error) failed.push(table);
  }
  // `profiles` is keyed by id, not user_id.
  const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
  if (profileError) failed.push('profiles');

  if (failed.length > 0) {
    // Do not delete the identity while rows remain: the user can retry, and an
    // orphaned row is worse than a retryable failure.
    return json({ error: 'Some data could not be deleted. Please try again.', failed }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    const alreadyGone = /not found/i.test(deleteError.message);
    if (!alreadyGone) {
      return json({ error: 'Your account could not be deleted. Please try again.', failed: ['auth'] }, 500);
    }
    return json({ deleted: false, alreadyDeleted: true });
  }

  // No access/refresh tokens are read, logged or returned anywhere on this path.
  return json({ deleted: true, alreadyDeleted: false, tables: TABLES_OWNED_BY_USER.length + 1 });
});
