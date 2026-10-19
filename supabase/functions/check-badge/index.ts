// POST { url }          -> is the Listed on Getclient badge on this website?
// POST { listing_id }   -> check the listing's website and record the result
//                          (badge_verified_at is what allows approval).
import { cors, json, clean } from '../_shared/http.ts';
import { admin } from '../_shared/db.ts';
import { checkBadge } from '../_shared/badge.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'bad_request' }, 400); }

  const id = clean(b.listing_id, 20);
  if (id) {
    const { data: l } = await admin.from('gc_listings').select('public_id,website,badge_url').eq('public_id', id).maybeSingle();
    if (!l) return json(req, { error: 'not_found' }, 404);
    const target = clean(b.url, 500) || l.badge_url || l.website || '';
    if (!target) return json(req, { found: false, error: 'This listing has no website on record.' });
    const r = await checkBadge(target);
    await admin.from('gc_listings').update({
      badge_url: r.url, badge_check: r, ...(r.found ? { badge_verified_at: r.checked_at } : {}),
    }).eq('public_id', id);
    return json(req, r);
  }
  const url = clean(b.url, 500);
  if (!url) return json(req, { found: false, error: 'Enter your website address.' }, 422);
  return json(req, await checkBadge(url));
});
