// Called by the database (gc_notify / gc_notify_status) for:
//   listing_status  a listing was approved, rejected or suspended
//   lead_offered    a job was offered to a business (one-time accept/decline link)
//   lead_accepted   a business accepted: contact details go to both sides
//   job_no_match    no verified business could take a job
// Authenticated by the shared MAILER_HOOK_SECRET.
import { admin } from '../_shared/db.ts';
import { send, shell, esc, button, badgeCode, ORIGIN, PLAN_NAME, CC } from '../_shared/mail.ts';
import { TIMING } from '../_shared/tokens.ts';
import { waNotify, waNumber } from '../_shared/whatsapp.ts';

const h3 = (t: string) => `<h3 style="font-size:16px;color:#071A47;margin:20px 0 6px">${t}</h3>`;
const row = (k: string, v: unknown) => v ? `<tr><td style="color:#55658C;padding:4px 12px 4px 0;vertical-align:top">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>` : '';

async function jobEvents(ev: Record<string, string>) {
  if (ev.event === 'lead_offered' || ev.event === 'lead_accepted') {
    const { data: v } = await admin.rpc('gc_lead_view', { p_lead: ev.lead_id });
    if (!v) return 'no lead';
    const { data: l } = await admin.from('gc_listings').select('email, phone, contact_name, name, slug, tier, website').eq('public_id', v.listing_id).single();
    const { data: j } = await admin.from('gc_jobs').select('client_email, client_phone, client_name, source, ref').eq('ref', v.job.ref).single();
    const jobTable = `<table cellpadding="0" style="border-collapse:collapse;font-size:14px;margin:8px 0">
      ${row('Service', v.job.service)}${row('Where', v.job.city + (v.nearby ? ' (near you)' : ''))}${row('When', TIMING[v.job.timing])}
      ${row('Budget', v.job.budget)}${row('Category', v.job.category)}</table>
      <p style="background:#F6F8FF;border-left:4px solid #1652F0;padding:12px 14px;white-space:pre-wrap">${esc(v.job.details)}</p>`;

    if (ev.event === 'lead_offered') {
      const link = `${ORIGIN}/lead/#t=${ev.token}`;
      const due = new Date(v.expires_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' });
      await send({
        to: l!.email, subject: `New job for ${v.listing_name}: ${v.job.service} in ${v.job.city}`,
        html: shell(`A client needs ${esc(v.job.service)} in ${esc(v.job.city)}`,
          `<p>Hi ${esc(l!.contact_name || l!.name)},</p>
           <p>${esc(v.job.client_first_name)} asked Getclient for verified businesses, and you are one of the best matches.
           ${v.match === 'possible' ? '<b>This is a possible match:</b> please decline if it is not your kind of work.' : ''}</p>
           ${jobTable}
           ${button(link, 'Accept or decline this job')}
           <p><b>Please answer by ${esc(due)}.</b> If you do not, the job passes to another business and it counts
           against your response rate. Accept and you get the client's contact details straight away.</p>
           <p style="font-size:13px;color:#55658C">You can also answer from your <a href="${ORIGIN}/dashboard/">business dashboard</a>. Job ${esc(v.job.ref)}.</p>`, l!.tier),
      });
      const wa = waNumber(l!.phone);
      if (wa) await waNotify(wa, `Getclient: new job for ${v.listing_name}. ${v.job.service} in ${v.job.city} (${TIMING[v.job.timing]}). Accept or decline by ${due}: ${link}`);
      return 'sent';
    }

    // lead_accepted: the client gets the business, the business gets the client
    const prof = `${ORIGIN}/b/${l!.slug}/`;
    if (j!.client_email) {
      await send({
        to: j!.client_email, replyTo: l!.email,
        subject: `${v.listing_name} can help with your ${v.job.service} request`,
        html: shell(`${esc(v.listing_name)} accepted your request`,
          `<p>Hi ${esc(v.job.client_first_name)},</p>
           <p>Good news: <b>${esc(v.listing_name)}</b>, a business verified by Getclient, accepted your request for
           <b>${esc(v.job.service)}</b> and will contact you. You can also contact them directly:</p>
           <table cellpadding="0" style="border-collapse:collapse;font-size:14px;margin:8px 0">
             ${row('Phone', l!.phone)}${row('Email', l!.email)}${row('Website', l!.website)}</table>
           ${button(prof, 'See their verified profile')}
           <p style="font-size:13px;color:#55658C">Up to three businesses can accept. Follow all replies with the link in your first email. Reference ${esc(j!.ref)}.</p>`, l!.tier),
      });
    }
    const cwa = waNumber(j!.client_phone);
    if (cwa && j!.source === 'whatsapp') {
      await waNotify(cwa, `Getclient: ${v.listing_name} accepted your ${v.job.service} request and will contact you. Phone: ${l!.phone}. Profile: ${prof}`);
    }
    await send({
      to: l!.email, replyTo: j!.client_email || undefined,
      subject: `You accepted job ${j!.ref}: contact ${v.job.client_first_name}`,
      html: shell(`Contact ${esc(v.client.name)} now`,
        `<p>Thank you for accepting. Here are the client's details. Contact them soon: fast replies win work and lift your response rate.</p>
         <table cellpadding="0" style="border-collapse:collapse;font-size:14px;margin:8px 0">
           ${row('Name', v.client.name)}${row('Phone', v.client.phone)}${row('Email', v.client.email)}</table>
         ${jobTable}`, l!.tier),
    });
    return 'sent';
  }

  if (ev.event === 'job_no_match') {
    const { data: j } = await admin.from('gc_jobs').select('*').eq('id', ev.job_id).single();
    if (!j) return 'no job';
    const { data: loc } = await admin.from('gc_locations').select('name').eq('slug', j.city).single();
    const browse = `${ORIGIN}/c/${j.category}/${j.city}/`;
    if (j.client_email) {
      await send({
        to: j.client_email, subject: `Your request ${j.ref}: no verified match yet`,
        html: shell('We could not match your request yet',
          `<p>Hi ${esc(String(j.client_name).split(' ')[0])},</p>
           <p>No verified business near ${esc(loc && loc.name)} is available for <b>${esc(j.service)}</b> right now.
           Getclient only sends requests to businesses a person has checked, so we would rather tell you than guess.</p>
           <p>Our team has your request and will try to help. You can also see every listed business in your area:</p>
           ${button(browse, 'Browse businesses near you')}`),
      });
    }
    const cwa = waNumber(j.client_phone);
    if (cwa && j.source === 'whatsapp') {
      await waNotify(cwa, `Getclient: no verified business near ${loc && loc.name} is available for "${j.service}" right now. Our team has your request. Browse listed businesses: ${browse}`);
    }
    // tell Getclient, so a person can follow up
    await send({
      to: CC, cc: [], subject: `No match for job ${j.ref}: ${j.service} in ${loc && loc.name}`,
      html: shell(`No match for ${esc(j.ref)}`,
        `<table cellpadding="0" style="border-collapse:collapse;font-size:14px">${row('Service', j.service)}${row('Category', j.category)}
         ${row('Where', loc && loc.name)}${row('When', TIMING[j.timing])}${row('Client', j.client_name)}${row('Email', j.client_email)}${row('Phone', j.client_phone)}</table>
         <p style="white-space:pre-wrap">${esc(j.details)}</p>
         <p>No approved Blue or Gold business in this category and province could take it. A good moment to recruit one.</p>`),
    });
    return 'sent';
  }
  return 'ignored';
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('MAILER_HOOK_SECRET') || '';
  if (!secret || req.headers.get('x-gc-hook') !== secret) return new Response('forbidden', { status: 403 });
  const ev = await req.json().catch(() => ({}));
  if (ev.event && ev.event !== 'listing_status') return new Response(await jobEvents(ev));
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
