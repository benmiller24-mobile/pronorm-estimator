import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_API_SECRET;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.pronormusa.com',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }, body: JSON.stringify(body) };
}

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Auth check — require shared secret
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!ADMIN_SECRET || token !== ADMIN_SECRET) {
    return json(401, { error: 'Unauthorized' });
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
      if (error) return json(500, { error: error.message });

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

      return json(200, { users: enriched });
    }

    // ── CREATE USER ──
    if (method === 'POST') {
      const { email, password, role = 'dealer', company_name = '' } = body;
      if (!email || !password) return json(400, { error: 'Email and password are required' });

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) return json(400, { error: authError.message });

      // Create profile
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        email,
        role,
        company_name,
      });

      return json(201, { user: { id: authData.user.id, email, role, company_name } });
    }

    // ── UPDATE USER (role, company, password) ──
    if (method === 'PUT') {
      const { id, role, company_name, password } = body;
      if (!id) return json(400, { error: 'User ID is required' });

      // Update auth password if provided
      if (password) {
        const { error } = await supabase.auth.admin.updateUserById(id, { password });
        if (error) return json(400, { error: error.message });
      }

      // Update profile
      const updates = {};
      if (role !== undefined) updates.role = role;
      if (company_name !== undefined) updates.company_name = company_name;
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) return json(400, { error: error.message });
      }

      return json(200, { success: true });
    }

    // ── DELETE USER ──
    if (method === 'DELETE') {
      const { id } = body;
      if (!id) return json(400, { error: 'User ID is required' });

      // Delete orders, profile, then auth user
      await supabase.from('orders').delete().eq('user_id', id);
      await supabase.from('profiles').delete().eq('id', id);
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) return json(400, { error: error.message });

      return json(200, { success: true });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (err) {
    return json(500, { error: err.message });
  }
}
