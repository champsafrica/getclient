// POST { reference }
// Confirms a Paystack payment with Paystack itself (secret key, server side),
// checks the amount against gc_price() for the plan and discount code, and only
// then marks the payment paid and the listing as paid for that plan.
// A browser callback alone never counts as proof of payment.
// Secret: PAYSTACK_SECRET_KEY (sk_live_... from Paystack → Settings → API Keys).
import { cors, json, clean } from '../_shared/http.ts';
import { admin } from '../_shared/db.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'bad_request' }, 400); }
  const reference = clean(b.reference, 120);
  if (!reference) return json(req, { error: 'reference' }, 422);

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) { console.error('PAYSTACK_SECRET_KEY is not set'); return json(req, { error: 'not_configured' }, 500); }

  const { data: pay } = await admin.from('gc_payments').select('*').eq('reference', reference).maybeSingle();
  if (!pay) return json(req, { error: 'unknown_reference' }, 404);
  if (pay.status === 'paid') return json(req, { ok: true, status: 'paid' });          // already confirmed

  // ask Paystack what really happened
  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15_000),
  });
  const ps = await r.json().catch(() => ({}));
  const tx = ps && ps.data;
  if (!r.ok || !tx || tx.status !== 'success') {
    await admin.from('gc_payments').update({ status: tx && tx.status ? `paystack_${tx.status}` : 'not_found' }).eq('id', pay.id);
    return json(req, { ok: false, status: tx ? tx.status : 'not_found' }, 402);
  }

  // the amount must match what the server says this plan and code cost
  const { data: price } = await admin.rpc('gc_price', { p_plan: pay.plan, p_code: pay.discount_code || null });
  const expected = Array.isArray(price) && price[0] ? price[0] : null;
  if (!expected || tx.currency !== 'ZAR' || Number(tx.amount) < Number(expected.amount)) {
    await admin.from('gc_payments').update({ status: 'amount_mismatch', channel: tx.channel || null }).eq('id', pay.id);
    console.error('amount mismatch', reference, tx.amount, expected && expected.amount);
    return json(req, { ok: false, status: 'amount_mismatch' }, 402);
  }

  const now = new Date().toISOString();
  await admin.from('gc_payments').update({
    status: 'paid', verified_at: now, channel: tx.channel || null, amount: Number(tx.amount),
    discount_pct: expected.discount_pct || null,
  }).eq('id', pay.id);
  if (expected.code) await admin.rpc('gc_redeem', { p_code: expected.code });
  if (pay.listing_id) {
    await admin.from('gc_listings').update({ paid_plan: pay.plan, paid_at: now }).eq('public_id', pay.listing_id);
  }
  return json(req, { ok: true, status: 'paid' });
});
