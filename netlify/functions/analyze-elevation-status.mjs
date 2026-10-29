import { getStore } from '@netlify/blobs';
import { requireEstimatorUser, json } from './lib/auth.mjs';

// Poll endpoint for analyze-elevation-background.
// GET ?job=<uuid>, Authorization: Bearer <supabase access_token>
// → { status: 'pending' | 'running' | 'done' | 'error', text?, error? }
// Results are keyed by the verified user id, so a caller can only read
// their own jobs. Finished jobs are deleted once read.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });

  const auth = await requireEstimatorUser(req);
  if (auth.error) return json(auth.status, { error: auth.error });

  const jobId = new URL(req.url).searchParams.get('job') || '';
  if (!UUID_RE.test(jobId)) return json(400, { error: 'Invalid job id' });

  const store = getStore('elevation-jobs');
  const key = `${auth.user.id}/${jobId}`;
  const result = await store.get(key, { type: 'json' });
  if (!result) return json(200, { status: 'pending' });

  if (result.status === 'done' || result.status === 'error') {
    await store.delete(key);
  }
  return json(200, result);
};
