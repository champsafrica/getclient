// POST { category, city, service, details, timing, budget?, name, email, phone?, consent, token }
// "Get quotes": verifies Turnstile, saves the job and matches it to up to three
// verified businesses (gc_match_job). Returns the client's private status link.
import { cors, json, clientIp } from '../_shared/http.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { createJob } from '../_shared/jobs.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'bad_request' }, 400); }

  if (!(await verifyTurnstile(b.token, 'job_request', clientIp(req)))) {
    return json(req, { error: 'turnstile', message: 'Please complete the security check and try again.' }, 403);
  }
  const r = await createJob({
    category: b.category, city: b.city, service: b.service, details: b.details, timing: b.timing, budget: b.budget,
    name: b.name, email: b.email, phone: b.phone, consent: b.consent, source: 'web',
  });
  if (!r.ok) return json(req, { error: 'invalid', message: r.error }, r.status);
  return json(req, { ref: r.ref, offered: r.offered, status: r.status, status_url: `/job/#t=${r.token}` });
});
