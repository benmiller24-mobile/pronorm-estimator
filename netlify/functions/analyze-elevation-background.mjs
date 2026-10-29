import { getStore } from '@netlify/blobs';
import { requireEstimatorUser } from './lib/auth.mjs';

// Server-side Claude Vision call for "Import Elevation".
//
// Replaces the browser-side call that shipped an Anthropic API key in the
// public bundle. The key now lives only in the ANTHROPIC_API_KEY env var
// (functions scope). This is a background function (15-minute budget) because
// a multi-image vision call routinely outlives the synchronous function limit;
// the client polls `analyze-elevation-status` for the result.
//
// Request (POST, Authorization: Bearer <supabase access_token>):
//   { jobId: uuid, prompt: string, images: [{ label, media_type, data(base64) }] }
// Result written to blob store `elevation-jobs` at `<userId>/<jobId>`:
//   { status: 'done', text } | { status: 'error', error }

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;
const MAX_IMAGES = 5;
const MAX_IMAGE_B64 = 5 * 1024 * 1024; // Anthropic per-image limit (5 MB)
const MAX_PROMPT_CHARS = 20000;
const DAILY_LIMIT_PER_USER = 40;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validate(body) {
  if (!body || typeof body !== 'object') return 'Invalid request body';
  const { jobId, prompt, images } = body;
  if (typeof jobId !== 'string' || !UUID_RE.test(jobId)) return 'Invalid jobId';
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) return 'Invalid prompt';
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) return 'Provide 1-5 images';
  for (const img of images) {
    if (!img || typeof img !== 'object') return 'Invalid image';
    if (!ALLOWED_TYPES.has(img.media_type)) return 'Unsupported image type';
    if (typeof img.data !== 'string' || !img.data || img.data.length > MAX_IMAGE_B64) return 'Image missing or too large';
    if (typeof img.label !== 'string' || img.label.length > 80) return 'Invalid image label';
  }
  return null;
}

function describe(label) {
  const l = label.toLowerCase();
  return l.includes('floor') || l.includes('plan')
    ? 'a FLOORPLAN view (top-down view showing cabinet depth, layout, and spatial arrangement).'
    : 'an ELEVATION view (front view showing cabinet doors, heights, and handle positions).';
}

export default async (req) => {
  if (req.method !== 'POST') return;

  const store = getStore('elevation-jobs');
  let body;
  try {
    body = await req.json();
  } catch {
    return;
  }

  const auth = await requireEstimatorUser(req);
  if (auth.error) {
    // Can't report without a verified user id to key the result under.
    console.warn('[analyze-elevation] rejected:', auth.status, auth.error);
    return;
  }
  const userId = auth.user.id;
  const key = typeof body?.jobId === 'string' && UUID_RE.test(body.jobId) ? `${userId}/${body.jobId}` : null;

  const fail = async (error) => {
    if (key) await store.setJSON(key, { status: 'error', error, finishedAt: Date.now() });
  };

  const invalid = validate(body);
  if (invalid) return fail(invalid);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail('Elevation import is not configured (missing ANTHROPIC_API_KEY).');

  // Per-user daily cap so a single session can't run up the API bill.
  const day = new Date().toISOString().slice(0, 10);
  const usageKey = `usage/${userId}/${day}`;
  const used = (await store.get(usageKey, { type: 'json' }))?.count || 0;
  if (used >= DAILY_LIMIT_PER_USER) {
    return fail(`Daily limit of ${DAILY_LIMIT_PER_USER} analyses reached. Try again tomorrow.`);
  }
  await store.setJSON(usageKey, { count: used + 1 });
  await store.setJSON(key, { status: 'running', startedAt: Date.now() });

  const content = [];
  for (const img of body.images) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } });
    content.push({ type: 'text', text: `↑ This is labeled "${img.label}" - ${describe(img.label)}` });
  }
  content.push({ type: 'text', text: body.prompt });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[analyze-elevation] anthropic error', res.status, data?.error?.type);
      return fail(data?.error?.message || `Claude API error (${res.status})`);
    }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!text) return fail('No response from Claude');
    await store.setJSON(key, { status: 'done', text, finishedAt: Date.now() });
  } catch (e) {
    console.error('[analyze-elevation] request failed', e);
    return fail('Could not reach Claude. Please try again.');
  }
};
