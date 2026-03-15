import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_API_SECRET;

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const { email, token } = params;

  // Verify shared secret
  if (!token || token !== ADMIN_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  if (!email) {
    return { statusCode: 400, body: 'Email required' };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find the user by email
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    return { statusCode: 500, body: `Error: ${listErr.message}` };
  }

  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    // No matching estimator account — redirect to estimator login page
    return {
      statusCode: 302,
      headers: { Location: `${supabaseUrl.replace('.supabase.co', '')}.pronormusa.com` || 'https://estimator.pronormusa.com' },
      body: '',
    };
  }

  // Generate a magic link for this user (auto-confirms, no email sent)
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: {
      redirectTo: 'https://estimator.pronormusa.com',
    },
  });

  if (error) {
    return { statusCode: 500, body: `Error generating link: ${error.message}` };
  }

  // The generated link contains a token hash — redirect the user there
  // Supabase returns the full verification URL
  const verifyUrl = data?.properties?.action_link;
  if (!verifyUrl) {
    return { statusCode: 500, body: 'Failed to generate login link' };
  }

  return {
    statusCode: 302,
    headers: { Location: verifyUrl },
    body: '',
  };
}
