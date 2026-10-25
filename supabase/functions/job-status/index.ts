// POST { token, action?: 'view' | 'close' }
// The client's private page for their request: which businesses accepted (with
// their contact details), how many are still deciding, and a way to close it.
import { cors, json, clean } from '../_shared/http.ts';
import { admin } from '../_shared/db.ts';
import { tokenHash } from '../_shared/tokens.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'bad_request' }, 400); }

  const token = clean(b.token, 100);
  if (!/^[a-f0-9]{64}$/.test(token)) return json(req, { error: 'invalid', message: 'This link is not valid.' }, 404);
  const { data: job } = await admin.from('gc_jobs').select('*').eq('client_token_hash', await tokenHash(token)).maybeSingle();
  if (!job) return json(req, { error: 'invalid', message: 'This link is not valid.' }, 404);

  if (clean(b.action, 10) === 'close') {
    await admin.rpc('gc_close_job', { p_job: job.id });
    job.status = 'closed';
  }

  const { data: leads } = await admin.from('gc_leads').select('listing_id, status, nearby, responded_at').eq('job_id', job.id);
  const accepted = (leads || []).filter((l) => l.status === 'accepted');
  let businesses: unknown[] = [];
  if (accepted.length) {
    const { data: biz } = await admin.from('gc_listings_public')
      .select('id, slug, name, tier, phone, email, website, city_name, subcategory, avg_rating, rating_count')
      .in('id', accepted.map((l) => l.listing_id));
    businesses = accepted.map((l) => ({ ...((biz || []).find((x) => x.id === l.listing_id) || {}), nearby: l.nearby, accepted_at: l.responded_at }));
  }
  const [{ data: cat }, { data: loc }] = await Promise.all([
    admin.from('gc_categories').select('name').eq('slug', job.category).maybeSingle(),
    admin.from('gc_locations').select('name').eq('slug', job.city).maybeSingle(),
  ]);
  return json(req, {
    ok: true,
    job: { ref: job.ref, service: job.service, details: job.details, timing: job.timing, budget: job.budget,
           category: cat && cat.name, city: loc && loc.name, status: job.status, created_at: job.created_at },
    deciding: (leads || []).filter((l) => l.status === 'offered').length,
    declined: (leads || []).filter((l) => l.status === 'declined' || l.status === 'expired').length,
    businesses,
  });
});
