// Email through Resend (https://resend.com). Function secrets:
//   RESEND_API_KEY   required
//   MAIL_FROM        e.g. "Getclient <hello@getclient.co.za>" (the domain must be verified in Resend)
//   MAIL_CC          defaults to hello@digitalxagency.io, copied on every email
const ORIGIN = 'https://getclient.co.za';
export const CC = Deno.env.get('MAIL_CC') || 'hello@digitalxagency.io';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function send(o: { to: string; subject: string; html: string; replyTo?: string; cc?: string[] }) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) { console.error('RESEND_API_KEY is not set; email not sent:', o.subject); return false; }
  const cc = (o.cc ?? [CC]).filter((x) => x && x.toLowerCase() !== o.to.toLowerCase());
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM') || 'Getclient <hello@getclient.co.za>',
      to: [o.to], cc, subject: o.subject, html: o.html,
      ...(o.replyTo ? { reply_to: o.replyTo } : {}),
    }),
  });
  if (!r.ok) console.error('email failed', r.status, await r.text());
  return r.ok;
}

const tierBadge = (tier?: string) => `${ORIGIN}/assets/badge/${tier === 'gold' || tier === 'blue' ? tier : 'listed'}-light.png`;

/** The branded shell every Getclient email uses. The badge is always in the footer. */
export function shell(title: string, body: string, tier?: string) {
  return `<!doctype html><html><body style="margin:0;background:#EEF3FF;font-family:Arial,Helvetica,sans-serif;color:#0B1B3F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3FF;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="height:5px;font-size:0;line-height:0;background:linear-gradient(90deg,#007749 0 20%,#FFB81C 0 40%,#E03C31 0 60%,#001489 0 80%,#000 0);background-color:#1652F0">&nbsp;</td></tr>
<tr><td style="padding:24px 28px 8px"><a href="${ORIGIN}"><img src="${ORIGIN}/assets/brand/logo.png" alt="Getclient" width="160" style="display:block;border:0"></a></td></tr>
<tr><td style="padding:8px 28px 4px"><h1 style="margin:0;font-size:22px;line-height:1.3;color:#071A47">${title}</h1></td></tr>
<tr><td style="padding:8px 28px 24px;font-size:15px;line-height:1.6;color:#33415F">${body}</td></tr>
<tr><td style="padding:18px 28px;background:#F6F8FF;border-top:1px solid #DCE4F7;font-size:12px;color:#55658C">
<a href="${ORIGIN}"><img src="${tierBadge(tier)}" alt="Listed on Getclient" height="42" style="display:block;border:0;margin-bottom:10px"></a>
Getclient, South Africa's verified business directory · a Digitalx Group (Pty) Ltd project · Kuils River, Cape Town<br>
<a href="mailto:hello@digitalxagency.io" style="color:#1652F0">hello@digitalxagency.io</a> · 021 879 3035</td></tr>
</table></td></tr></table></body></html>`;
}

export const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#1652F0;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">${esc(label)}</a></p>`;

export const badgeCode = (id: string) =>
  `<pre style="background:#071A47;color:#C9D6F8;padding:14px;border-radius:10px;font-size:12px;white-space:pre-wrap;word-break:break-all">${esc(`<script src="${ORIGIN}/badge.js" data-gc-id="${id}" async></script>`)}</pre>`;

export const PLAN_NAME: Record<string, string> = { basic: 'Basic listing', blue: 'Blue Verified', gold: 'Gold Verified' };
export { ORIGIN };
