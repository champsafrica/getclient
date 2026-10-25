// POST { token, action: 'view' | 'accept' | 'decline', reason? }
// The one-click link a business gets by email: see the job, then accept or decline.
// The client's contact details are returned only after accepting.
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
  const { data: lead } = await admin.from('gc_leads').select('id').eq('token_hash', await tokenHash(token)).maybeSingle();
  if (!lead) return json(req, { error: 'invalid', message: 'This link is not valid or has been replaced.' }, 404);

  const action = clean(b.action, 10);
  if (action === 'view') {
    const { data } = await admin.rpc('gc_lead_view', { p_lead: lead.id });
    return json(req, { ok: true, lead: data });
  }
  if (action !== 'accept' && action !== 'decline') return json(req, { error: 'action' }, 400);
  const { data, error } = await admin.rpc('gc_respond_lead', { p_lead: lead.id, p_action: action, p_reason: clean(b.reason, 200) || null });
  if (error) { console.error('respond', error); return json(req, { error: 'server', message: 'That did not save. Please try again.' }, 500); }
  return json(req, data, data && data.ok ? 200 : 409);
});
