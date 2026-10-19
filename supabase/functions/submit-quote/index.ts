// POST { business_id, name, email, phone, details, token }
// Verifies Turnstile, saves the quote request, and emails it to the business
// owner with info@getclient.co.za copied in.
import { cors, json, clientIp, clean } from '../_shared/http.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { admin } from '../_shared/db.ts';
import { send, shell, esc, ORIGIN, CC } from '../_shared/mail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'bad_request' }, 400); }

  if (!(await verifyTurnstile(b.token, 'quote_request', clientIp(req)))) {
    return json(req, { error: 'turnstile', message: 'Please complete the security check and try again.' }, 403);
  }
  const q = {
    business_id: clean(b.business_id, 20), name: clean(b.name, 120), email: clean(b.email, 200),
    phone: clean(b.phone, 40), details: clean(b.details, 4000),
  };
  if (!q.business_id || !q.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q.email) || q.details.length < 5) {
    return json(req, { error: 'invalid', message: 'Name, a valid email and the job details are required.' }, 422);
  }
  const { data: biz } = await admin.from('gc_listings_public').select('id,slug,name,email,tier').eq('id', q.business_id).maybeSingle();
  if (!biz) return json(req, { error: 'not_found', message: 'That business is not listed.' }, 404);
  if (biz.tier !== 'gold' && biz.tier !== 'blue') {
    return json(req, { error: 'tier', message: 'This business takes enquiries by phone or email only.' }, 403);
  }

  const { error } = await admin.from('gc_quotes').insert(q);
  if (error) { console.error('quote insert', error); return json(req, { error: 'save', message: 'That did not send. Please try again.' }, 500); }

  if (biz.email) {
    await send({
      to: biz.email, replyTo: q.email,
      subject: `New quote request via Getclient from ${q.name}`,
      html: shell(`New quote request for ${esc(biz.name)}`,
        `<p>Someone found you on Getclient and asked for a quote. Reply to this email to answer them directly.</p>
         <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
           <tr><td style="color:#55658C">Name</td><td><b>${esc(q.name)}</b></td></tr>
           <tr><td style="color:#55658C">Email</td><td><a href="mailto:${esc(q.email)}">${esc(q.email)}</a></td></tr>
           ${q.phone ? `<tr><td style="color:#55658C">Phone</td><td><a href="tel:${esc(q.phone)}">${esc(q.phone)}</a></td></tr>` : ''}
         </table>
         <p style="background:#F6F8FF;border-left:4px solid #1652F0;padding:12px 14px;white-space:pre-wrap">${esc(q.details)}</p>
         <p style="font-size:13px;color:#55658C">Getclient logs whether businesses reply and publishes the response rate on your
         <a href="${ORIGIN}/b/${esc(biz.slug)}/">profile</a>. A copy of this request went to ${esc(CC)}.</p>`, biz.tier),
    });
  }
  return json(req, { ok: true });
});
