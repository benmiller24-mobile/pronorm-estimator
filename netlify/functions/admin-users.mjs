import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_API_SECRET;

const ALLOWED_ORIGINS = ['https://www.pronormusa.com', 'https://pronormusa.com'];

function getCorsHeaders(event) {
  const origin = event.headers?.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

function json(statusCode, body, event) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) }, body: JSON.stringify(body) };
}

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: getCorsHeaders(event), body: '' };
  }

  // Auth check — require shared secret
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!ADMIN_SECRET || token !== ADMIN_SECRET) {
    return json(401, { error: 'Unauthorized' }, event);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    // ── LIST USERS ──
    if (method === 'GET') {
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      if (error) return json(500, { error: error.message }, event);

      // Enrich with profile data
      const { data: profiles } = await supabase.from('profiles').select('*');
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const enriched = users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role: profileMap[u.id]?.role || 'dealer',
        company_name: profileMap[u.id]?.company_name || '',
      }));

      return json(200, { users: enriched }, event);
    }

    // ── CREATE USER ──
    if (method === 'POST') {
      const { email, password, role = 'dealer', company_name = '' } = body;
      if (!email || !password) return json(400, { error: 'Email and password are required' }, event);

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) return json(400, { error: authError.message }, event);

      // Create profile
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        email,
        role,
        company_name,
      });

      return json(201, { user: { id: authData.user.id, email, role, company_name } }, event);
    }

    // ── UPDATE USER (role, company, password) ──
    if (method === 'PUT') {
      const { id, role, company_name, password } = body;
      if (!id) return json(400, { error: 'User ID is required' }, event);

      // Update auth password if provided
      if (password) {
        const { error } = await supabase.auth.admin.updateUserById(id, { password });
        if (error) return json(400, { error: error.message }, event);
      }

      // Update profile
      const updates = {};
      if (role !== undefined) updates.role = role;
      if (company_name !== undefined) updates.company_name = company_name;
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) return json(400, { error: error.message }, event);
      }

      return json(200, { success: true }, event);
    }

    // ── DELETE USER ──
    if (method === 'DELETE') {
      const { id } = body;
      if (!id) return json(400, { error: 'User ID is required' }, event);

      // Delete orders, profile, then auth user
      await supabase.from('orders').delete().eq('user_id', id);
      await supabase.from('profiles').delete().eq('id', id);
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) return json(400, { error: error.message }, event);

      return json(200, { success: true }, event);
    }

    return json(405, { error: 'Method not allowed' }, event);
  } catch (err) {
    return json(500, { error: err.message }, event);
  }
}
