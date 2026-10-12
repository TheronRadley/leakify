/**
 * delete-account — server-side full account deletion (audit S-04).
 *
 * Why this exists: the client cannot delete its own `auth.users` row, and the
 * service-role key that can must never ship in the app. So the app calls this
 * function; the function verifies the caller's JWT, deletes every row the user
 * owns, then removes the auth user through the Admin API (which also drops
 * sessions, refresh tokens, identities and MFA factors).
 *
 * Deploy:
 *   supabase functions deploy delete-account --no-verify-jwt
 *
 * `--no-verify-jwt` is deliberate: the platform's automatic JWT check only
 * confirms the token is well-formed for THIS project. We need the user id the
 * token belongs to, so we verify it explicitly below with
 * `auth.getUser(token)` — which additionally rejects revoked sessions. Never
 * trust a user id from the request body.
 *
 * Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the
 * Edge Runtime. They live in the Supabase dashboard, not in this repo.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Every table that carries user data, children first (FK cascades aside). */
const USER_OWNED_TABLES: { table: string; column: string }[] = [
  { table: 'notification_records', column: 'user_id' },
  { table: 'billing_events', column: 'user_id' },
  { table: 'notification_preferences', column: 'user_id' },
  { table: 'subscriptions', column: 'user_id' },
  { table: 'profiles', column: 'id' },
];

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function deleteRows(admin: SupabaseClient, userId: string): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  for (const { table, column } of USER_OWNED_TABLES) {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) failed.push(table);
  }
  return { failed };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'This function is not configured on the server.' });
  }

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Sign in again, then retry.' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authenticate from the token itself — never from the request body.
  const { data, error: authError } = await admin.auth.getUser(token);
  if (authError || !data.user?.id) {
    return json(401, { error: 'Your session could not be verified. Sign in again, then retry.' });
  }
  const userId = data.user.id;

  const { failed } = await deleteRows(admin, userId);
  if (failed.length > 0) {
    // Rows survived — do NOT delete the auth user, or the remaining rows would
    // be orphaned and unreachable. The client reports this honestly.
    return json(500, { error: 'Some data could not be deleted. Please retry.', failed });
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    return json(500, {
      error: 'Your data was deleted, but the account itself could not be removed. Please retry.',
    });
  }

  return json(200, { deleted: true, userId });
});
