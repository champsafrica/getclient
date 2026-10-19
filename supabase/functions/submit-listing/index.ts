// POST { p: <listing fields>, token, services?: [{name, description}], payment_reference? }
// Verifies Turnstile and the Listed on Getclient badge on the applicant's website,
// creates the listing through gc_submit_listing, stores Blue and Gold services, and sends
// the welcome email.
import { cors, json, clientIp, clean } from '../_shared/http.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { admin } from '../_shared/db.ts';
import { checkBadge } from '../_shared/badge.ts';
import { send, shell, esc, button, badgeCode, ORIGIN, PLAN_NAME } from '../_shared/mail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(req, { error: 'bad_request' }, 400); }

  if (!(await verifyTurnstile(b.token, 'listing_submit', clientIp(req)))) {
    return json(req, { error: 'turnstile', message: 'Please complete the security check and try again.' }, 403);
  }
  const p = (b.p && typeof b.p === 'object') ? b.p as Record<string, unknown> : {};
  const paid = clean(b.payment_reference, 80);
  const website = clean(p.website, 300);
  if (!website) {
    return json(req, { error: 'website', message: 'A website is required, because every listing displays the Getclient badge.' }, 422);
  }

  // Every listing, on every tier, must show the badge before it is accepted.
  // A paid application is saved either way (the payment has gone through) but
  // cannot be approved until the badge is found.
  const badge = await checkBadge(website);
  if (!badge.found && !paid) {
    return json(req, { error: 'badge_missing', message: badge.error || 'The Listed on Getclient badge was not found on your website.', badge }, 422);
  }

  const { data, error } = await admin.rpc('gc_submit_listing', { p });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || !row.public_id) {
    console.error('gc_submit_listing', error);
    return json(req, { error: 'save', message: error?.message || 'The listing could not be saved.' }, 500);
  }
  const id: string = row.public_id;
  await admin.from('gc_listings').update({
    badge_url: badge.url, badge_check: badge, ...(badge.found ? { badge_verified_at: badge.checked_at } : {}),
  }).eq('public_id', id);

  const plan = clean(p.requested_plan, 10) || 'basic';
  if ((plan === 'gold' || plan === 'blue') && Array.isArray(b.services)) {
    const rows = (b.services as Record<string, unknown>[]).slice(0, plan === 'gold' ? 12 : 8)
      .map((s, i) => ({ listing_id: id, name: clean(s.name, 80), description: clean(s.description, 280), sort: i }))
      .filter((s) => s.name.length >= 2);
    if (rows.length) await admin.from('gc_services').insert(rows);
  }

  const to = clean(p.email, 200);
  if (to) {
    const name = clean(p.name, 120);
    await send({
      to, subject: `Welcome to Getclient, ${name}`,
      html: shell('Welcome to Getclient',
        `<p>Hi ${esc(clean(p.contact_name, 120) || name)},</p>
         <p>Thank you for listing <b>${esc(name)}</b> on Getclient. Your application for a
         <b>${PLAN_NAME[plan] || 'listing'}</b> is in. Your listing ID is <b>${esc(id)}</b>.</p>
         <p>A person reviews every submission, usually within one to two business days. We will email you as soon as it is approved.</p>
         <p><b>Your badge.</b> ${badge.found ? 'We found the Listed on Getclient badge on your website. Thank you.'
           : 'We could not find the badge on your website yet. Your listing cannot be approved until it is there.'}
         Keep this code on your site. Once you are approved it shows your tier and links visitors to your profile:</p>
         ${badgeCode(id)}
         ${button(`${ORIGIN}/badge/?id=${encodeURIComponent(id)}`, 'See all badge styles')}`, plan),
    });
  }
  return json(req, { public_id: id, badge_found: badge.found });
});
