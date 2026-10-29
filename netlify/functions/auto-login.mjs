import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getStore } from '@netlify/blobs';

// Single-use, short-lived auto-login from the Pronorm dealer portal.
//
// The portal (pronorm-usa: netlify/functions/estimator-auto-login.mjs) signs
//   payload = base64url(JSON { e: email, x: expiresAtEpochSeconds, n: nonce })
//   token   = payload + "." + base64url(HMAC-SHA256(AUTO_LOGIN_SIGNING_SECRET, payload))
// and sends the browser to  /.netlify/functions/auto-login?t=<token>.
//
// This replaces the old ?email=&token=<shared static secret> scheme, where the
// one secret (visible in URLs and browser history) could sign in as ANY user,
// including admins. Now a token is bound to one email, expires in 60 seconds,
// and can be redeemed once.

const ESTIMATOR_HOME = 'https://estimator.pronormusa.com';
const MAX_CLOCK_SKEW_S = 30;
const MAX_LIFETIME_S = 120;

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyToken(token, secret) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  const expected = createHmac('sha256', secret).update(payloadPart).digest();
  let given;
  try {
    given = b64urlDecode(sigPart);
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadPart).toString('utf8'));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload?.e !== 'string' || typeof payload?.n !== 'string' || typeof payload?.x !== 'number') return null;
  if (payload.x < now - MAX_CLOCK_SKEW_S) return null; // expired
  if (payload.x > now + MAX_LIFETIME_S) return null; // implausibly long-lived
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(payload.n)) return null;
  return payload;
}

function redirectHome() {
  return new Response(null, { status: 302, headers: { Location: ESTIMATOR_HOME, 'Cache-Control': 'no-store' } });
}

function page(status, html) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export default async (req) => {
  const secret = process.env.AUTO_LOGIN_SIGNING_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32 || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return page(500, 'Auto-login is not configured.');
  }

  const token = new URL(req.url).searchParams.get('t');
  const payload = verifyToken(token, secret);
  if (!payload) return page(401, 'This sign-in link is invalid or has expired. Please open the estimator from the dealer portal again.');

  // Single use: remember the nonce until well past its expiry.
  const nonces = getStore('auto-login-nonces');
  if (await nonces.get(payload.n)) {
    return page(401, 'This sign-in link has already been used. Please open the estimator from the dealer portal again.');
  }
  await nonces.set(payload.n, String(payload.x));

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look the account up directly (listUsers() only returns the first page of
  // 50 users, which silently broke auto-login past 50 accounts).
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, email')
    .ilike('email', payload.e.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (profileErr) return page(500, 'Sign-in failed. Please try again.');
  if (!profile) return redirectHome();

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkErr || !tokenHash) return page(500, 'Sign-in failed. Please try again.');

  const cfg = JSON.stringify({ url: supabaseUrl, key: anonKey, tokenHash, home: ESTIMATOR_HOME }).replace(/</g, '\\u003c');

  return page(200, `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
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
      const cfg = ${cfg};
      history.replaceState(null, '', '/');
      const sb = supabase.createClient(cfg.url, cfg.key);
      await sb.auth.signOut();
      const { error } = await sb.auth.verifyOtp({ token_hash: cfg.tokenHash, type: 'magiclink' });
      if (error) {
        document.querySelector('.sub').textContent = 'Sign in failed: ' + error.message;
        setTimeout(() => { window.location.href = cfg.home; }, 2000);
      } else {
        window.location.href = cfg.home;
      }
    })();
  </script>
</body>
</html>`);
};
