// Called by the gc_notify_status database trigger when a listing is approved,
// rejected or suspended. Authenticated by the shared MAILER_HOOK_SECRET.
import { admin } from '../_shared/db.ts';
import { send, shell, esc, button, badgeCode, ORIGIN, PLAN_NAME } from '../_shared/mail.ts';

const h3 = (t: string) => `<h3 style="font-size:16px;color:#071A47;margin:20px 0 6px">${t}</h3>`;

Deno.serve(async (req) => {
  const secret = Deno.env.get('MAILER_HOOK_SECRET') || '';
  if (!secret || req.headers.get('x-gc-hook') !== secret) return new Response('forbidden', { status: 403 });
  const ev = await req.json().catch(() => ({}));
  if (ev.event !== 'listing_status' || !ev.public_id) return new Response('ignored');

  const { data: l } = await admin.from('gc_listings')
    .select('public_id,slug,name,email,contact_name,tier,requested_plan,status,reject_reason,reject_fix')
    .eq('public_id', ev.public_id).maybeSingle();
  if (!l || !l.email) return new Response('no listing');
  const hi = `<p>Hi ${esc(l.contact_name || l.name)},</p>`;

  if (ev.status === 'approved') {
    const tier = l.tier === 'gold' || l.tier === 'blue' ? ` as <b>${PLAN_NAME[l.tier]}</b>` : '';
    await send({
      to: l.email, subject: `${l.name} is now live on Getclient`,
      html: shell('Your listing is live',
        `${hi}<p><b>${esc(l.name)}</b> has been approved and is now listed on Getclient${tier}.</p>
         ${button(`${ORIGIN}/b/${l.slug}/`, 'View your profile')}
         <p>Keep the Listed on Getclient badge on your website. It now shows your listing and sends visitors to your profile:</p>
         ${badgeCode(l.public_id)}`, l.tier),
    });
  } else if (ev.status === 'rejected') {
    const again = `${ORIGIN}/list/?ref=${encodeURIComponent(l.public_id)}` +
      (l.requested_plan ? '&plan=' + encodeURIComponent(l.requested_plan) : '');
    await send({
      to: l.email, subject: 'Your Getclient application needs changes',
      html: shell('Your application needs a few changes',
        `${hi}<p>Thank you for applying to list <b>${esc(l.name)}</b>. We could not approve the application as it stands.</p>
         ${h3('What the issue is')}
         <p style="background:#FFF8E8;border-left:4px solid #FFB81C;padding:12px 14px;white-space:pre-wrap">${esc(l.reject_reason || 'The application did not meet the listing rules.')}</p>
         ${h3('How to fix it')}
         <p style="background:#E7F7F0;border-left:4px solid #0E9F6E;padding:12px 14px;white-space:pre-wrap">${esc(l.reject_fix || 'Correct the details above and submit the application again.')}</p>
         ${h3('Where to continue')}
         <p>Once it is fixed, submit your application again here. Your reference is <b>${esc(l.public_id)}</b>.</p>
         ${button(again, 'Continue my application')}
         <p style="font-size:13px;color:#55658C">Questions? Reply to this email or call 021 879 3035.</p>`),
    });
  } else if (ev.status === 'suspended') {
    await send({
      to: l.email, subject: `${l.name}: your Getclient listing is suspended`,
      html: shell('Your listing is suspended',
        `${hi}<p>The Getclient listing for <b>${esc(l.name)}</b> has been suspended and no longer appears in the directory.</p>
         ${l.reject_reason ? `<p><b>Reason:</b> ${esc(l.reject_reason)}</p>` : ''}
         ${l.reject_fix ? `<p><b>To restore it:</b> ${esc(l.reject_fix)}</p>` : ''}
         <p>Reply to this email or call 021 879 3035 and we will help you put it right.</p>`),
    });
  }
  return new Response('sent');
});
