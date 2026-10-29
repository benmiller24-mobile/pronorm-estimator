import { createClient } from '@supabase/supabase-js';

/**
 * Resolve the caller from `Authorization: Bearer <supabase access_token>`.
 * Returns { user, profile } for a signed-in estimator user with a profile row,
 * or { error, status } otherwise. The access token is verified by Supabase
 * Auth (signature + expiry); nothing from the request body is trusted.
 */
export async function requireEstimatorUser(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { status: 500, error: 'Server misconfigured' };
  }

  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return { status: 401, error: 'Missing authorization token' };
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) return { status: 401, error: 'Missing authorization token' };

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } = {}, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return { status: 401, error: 'Invalid or expired session' };

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileErr) return { status: 500, error: 'Profile lookup failed' };
  if (!profile) return { status: 403, error: 'No estimator profile for this account' };

  return { user, profile };
}

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}
