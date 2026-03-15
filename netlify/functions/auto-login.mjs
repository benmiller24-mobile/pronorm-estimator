import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
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

  // We can't use magic links because Supabase redirects to localhost.
  // Instead, return an HTML page that signs in via the Supabase JS client
  // using a temporary password, then redirects to the estimator.
  // The service role key signs the user in server-side and passes the session.

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find the user
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    return { statusCode: 500, body: `Error: ${listErr.message}` };
  }

  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    return {
      statusCode: 302,
      headers: { Location: 'https://estimator.pronormusa.com' },
      body: '',
    };
  }

  // Generate a short-lived temporary password, set it, and pass it to the client
  // The client will sign in and then we restore the original password
  // Actually, simpler: use generateLink with type 'magiclink' and extract the token
  // Then have the client verify it directly.

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });

  if (linkErr || !linkData) {
    return { statusCode: 500, body: `Error: ${linkErr?.message || 'No link data'}` };
  }

  // Extract the hashed_token from the link
  const actionLink = linkData.properties?.action_link || '';
  const tokenHash = linkData.properties?.hashed_token || '';

  if (!tokenHash) {
    return { statusCode: 500, body: 'Failed to generate token' };
  }

  // Return an HTML page that verifies the OTP token client-side
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Signing in...</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <style>
    body { font-family: 'DM Sans', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f7f6f3; color: #191919; margin: 0; }
    .card { text-align: center; }
    .title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 400; margin-bottom: 8px; }
    .sub { font-size: 13px; color: #8a8580; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">pronorm</div>
    <div class="sub">Signing you in...</div>
  </div>
  <script>
    (async () => {
      const sb = supabase.createClient('${supabaseUrl}', '${anonKey}');
      // Sign out any existing session first
      await sb.auth.signOut();
      // Verify the magic link token
      const { data, error } = await sb.auth.verifyOtp({
        token_hash: '${tokenHash}',
        type: 'magiclink',
      });
      if (error) {
        document.querySelector('.sub').textContent = 'Sign in failed: ' + error.message;
        setTimeout(() => { window.location.href = 'https://estimator.pronormusa.com'; }, 2000);
      } else {
        window.location.href = 'https://estimator.pronormusa.com';
      }
    })();
  </script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html,
  };
}
