// WhatsApp webhook (Meta Cloud API): sign up a business, or post a job, by chat.
//   GET  ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...   Meta's one-time check
//   POST message events, signed with X-Hub-Signature-256 (WHATSAPP_APP_SECRET)
// The sender's number is verified by WhatsApp itself, so it is trusted as the
// business's or client's phone. Every listing still needs the badge on its website.
import { admin } from '../_shared/db.ts';
import { checkBadge } from '../_shared/badge.ts';
import { sendWelcome } from '../_shared/mail.ts';
import { createJob } from '../_shared/jobs.ts';
import { TIMING } from '../_shared/tokens.ts';
import { waText, waSignatureOk } from '../_shared/whatsapp.ts';

const SITE = 'https://getclient.co.za';
const BADGE = '<script src="https://getclient.co.za/badge.js" async></script>';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIMINGS = ['urgent', 'week', 'month', 'flexible'];

type Session = { phone: string; step: string; data: Record<string, unknown> };

const MENU = `Hello from *Getclient*, South Africa's verified business directory.\n\nReply with a number:\n*1* List my business (free)\n*2* Get quotes from verified businesses\n*3* Talk to a person\n\nType *menu* at any time to start again.`;

async function lists() {
  const [{ data: cats }, { data: locs }] = await Promise.all([
    admin.from('gc_categories').select('slug, name').order('sort').order('name'),
    admin.from('gc_locations').select('slug, name, province_slug').order('name'),
  ]);
  return { cats: cats || [], locs: locs || [] };
}
const numbered = (rows: { name: string }[]) => rows.map((r, i) => `*${i + 1}* ${r.name}`).join('\n');
const pick = <T,>(rows: T[], text: string) => { const n = parseInt(text, 10); return n >= 1 && n <= rows.length ? rows[n - 1] : null; };

async function save(s: Session) {
  await admin.from('gc_wa_sessions').upsert({ phone: s.phone, step: s.step, data: s.data, updated_at: new Date().toISOString() });
}

async function handle(phone: string, raw: string): Promise<string> {
  const text = raw.trim();
  const low = text.toLowerCase();
  const { data: row } = await admin.from('gc_wa_sessions').select('*').eq('phone', phone).maybeSingle();
  const stale = !row || Date.now() - Date.parse(row.updated_at) > 24 * 3600e3;
  const s: Session = stale ? { phone, step: 'menu', data: {} } : { phone, step: row.step, data: row.data || {} };

  if (['stop', 'cancel', 'quit'].includes(low)) {
    await admin.from('gc_wa_sessions').delete().eq('phone', phone);
    return 'Stopped. Nothing was saved. Message us any time to start again.';
  }
  if (stale || ['menu', 'start', 'restart', 'hi', 'hello', 'hey', 'help'].includes(low)) {
    s.step = 'menu'; s.data = {}; await save(s);
    if (stale || low !== 'help') return MENU;
  }
  const { cats, locs } = await lists();

  switch (s.step) {
    case 'menu':
      if (text === '1') { s.step = 's_name'; await save(s); return 'Great, a free listing. What is the *registered name* of your business?'; }
      if (text === '2') { s.step = 'j_category'; await save(s); return `What kind of help do you need? Reply with a number:\n\n${numbered(cats)}`; }
      if (text === '3') return `Call or WhatsApp us on 021 879 3035, or email info@getclient.co.za. A person replies on weekdays 08:00–17:00.`;
      return MENU;

    /* ---------------- list my business ---------------- */
    case 's_name':
      if (text.length < 2 || text.length > 120) return 'Please send your business name (2 to 120 characters).';
      s.data.name = text; s.step = 's_category'; await save(s);
      return `Which category fits *${text}*? Reply with a number:\n\n${numbered(cats)}`;
    case 's_category': {
      const c = pick(cats, text); if (!c) return `Reply with a number from 1 to ${cats.length}.`;
      s.data.category = c.slug; s.step = 's_city'; await save(s);
      return `Which town or city are you in? Reply with a number:\n\n${numbered(locs)}`;
    }
    case 's_city': {
      const c = pick(locs, text); if (!c) return `Reply with a number from 1 to ${locs.length}.`;
      s.data.city = c.slug; s.data.province = c.province_slug; s.step = 's_desc'; await save(s);
      return 'Describe your business in a few sentences: what you do and for whom. (At least 50 characters.)';
    }
    case 's_desc':
      if (text.length < 50) return `That is ${text.length} characters. Please write at least 50 so clients know what you do.`;
      s.data.description = text.slice(0, 2000); s.step = 's_contact'; await save(s);
      return 'What is the *name of the contact person*?';
    case 's_contact':
      if (text.length < 2) return 'Please send the contact person\'s name.';
      s.data.contact_name = text.slice(0, 120); s.step = 's_email'; await save(s);
      return 'What *email address* should we use? We send your approval and job requests there, and you sign in to your dashboard with it.';
    case 's_email':
      if (!EMAIL.test(low)) return 'That email address does not look right. Please send it again.';
      s.data.email = low; s.step = 's_website'; await save(s);
      return 'What is your *website address*? Every Getclient listing shows our badge on its website, so a website is required.';
    case 's_website': {
      const site = /^https?:\/\//i.test(text) ? text : 'https://' + text;
      if (!/^https?:\/\/[^\s/]+\.[^\s]+/i.test(site)) return 'Please send your website address, for example yourbusiness.co.za';
      s.data.website = site; s.step = 's_badge'; await save(s);
      return `Last step before we check: add the *Listed on Getclient* badge to your website. Paste this code into your website's footer (or ask your web designer to):\n\n${BADGE}\n\nWhen it is live on ${site}, reply *DONE*.`;
    }
    case 's_badge': {
      if (low !== 'done') return `Reply *DONE* once the badge code is on ${s.data.website}. Need the code again? It is:\n\n${BADGE}`;
      const r = await checkBadge(String(s.data.website));
      if (!r.found) return `We could not find the badge on ${s.data.website} yet. ${r.error || ''}\n\nMake sure the page is published, then reply *DONE* again.`;
      s.data.badge = r; s.step = 's_confirm'; await save(s);
      const cat = cats.find((c) => c.slug === s.data.category), loc = locs.find((l) => l.slug === s.data.city);
      return `Badge found. Thank you!\n\nPlease check your details:\n*${s.data.name}*\n${cat && cat.name} · ${loc && loc.name}\nContact: ${s.data.contact_name}\nEmail: ${s.data.email}\nPhone: +${phone}\nWebsite: ${s.data.website}\n\nReply *YES* to confirm that this is accurate, that this is a legally operating South African business, and that you accept our Terms (${SITE}/terms/) and Privacy Policy (${SITE}/privacy/). Reply *MENU* to start again.`;
    }
    case 's_confirm': {
      if (low !== 'yes') return 'Reply *YES* to submit, or *MENU* to start again.';
      const p = {
        name: s.data.name, description: s.data.description, category: s.data.category, city: s.data.city,
        province: s.data.province, phone: '+' + phone, email: s.data.email, website: s.data.website,
        contact_name: s.data.contact_name, requested_plan: 'basic', consent_terms: true, consent_review: true,
      };
      const { data, error } = await admin.rpc('gc_submit_listing', { p });
      const out = Array.isArray(data) ? data[0] : data;
      if (error || !out) { console.error('wa submit', error); return `That did not save: ${error ? error.message : 'unknown error'}. Reply *YES* to try again.`; }
      const b = s.data.badge as { url: string; checked_at: string };
      await admin.from('gc_listings').update({ badge_url: b.url, badge_check: b, badge_verified_at: b.checked_at }).eq('public_id', out.public_id);
      await sendWelcome({ to: String(s.data.email), name: String(s.data.name), contact: String(s.data.contact_name), plan: 'basic', id: out.public_id, badgeFound: true });
      await admin.from('gc_wa_sessions').delete().eq('phone', phone);
      return `Submitted! Your listing ID is *${out.public_id}*.\n\nA person reviews every listing within one to two business days; we will email ${s.data.email} when it is live.\n\nAfter approval, manage your listing and answer job requests at ${SITE}/dashboard/\n\nWant photos, quote requests and promotion? See Blue and Gold: ${SITE}/pricing/`;
    }

    /* ---------------- get quotes ---------------- */
    case 'j_category': {
      const c = pick(cats, text); if (!c) return `Reply with a number from 1 to ${cats.length}.`;
      s.data.category = c.slug; s.step = 'j_city'; await save(s);
      return `Where is the job? Reply with a number:\n\n${numbered(locs)}`;
    }
    case 'j_city': {
      const c = pick(locs, text); if (!c) return `Reply with a number from 1 to ${locs.length}.`;
      s.data.city = c.slug; s.step = 'j_service'; await save(s);
      return 'In a few words, *what service* do you need? For example: plumber, geyser repair, website, accountant.';
    }
    case 'j_service':
      if (text.length < 2 || text.length > 80) return 'Please describe the service in a few words.';
      s.data.service = text; s.step = 'j_details'; await save(s);
      return 'Now describe the job: what needs doing, the area, anything the business should know. (At least 20 characters.)';
    case 'j_details':
      if (text.length < 20) return 'A little more detail please (at least 20 characters), so businesses can say yes quickly.';
      s.data.details = text.slice(0, 2000); s.step = 'j_timing'; await save(s);
      return `When do you need it?\n*1* ${TIMING.urgent}\n*2* ${TIMING.week}\n*3* ${TIMING.month}\n*4* ${TIMING.flexible}`;
    case 'j_timing': {
      const t = pick(TIMINGS, text); if (!t) return 'Reply 1, 2, 3 or 4.';
      s.data.timing = t; s.step = 'j_name'; await save(s);
      return 'What is your *name*?';
    }
    case 'j_name':
      if (text.length < 2) return 'Please send your name.';
      s.data.name = text.slice(0, 120); s.step = 'j_email'; await save(s);
      return 'Your *email address*, so you also get the replies by email? Reply *SKIP* to get them on WhatsApp only.';
    case 'j_email':
      if (low !== 'skip' && !EMAIL.test(low)) return 'That email address does not look right. Send it again, or reply *SKIP*.';
      s.data.email = low === 'skip' ? null : low; s.step = 'j_confirm'; await save(s);
      return `We will send your request to up to *three verified businesses* that match it. When one accepts, it gets your name and number (+${phone})${s.data.email ? ' and email' : ''} so it can contact you.\n\nReply *YES* to agree and send, or *MENU* to start again.`;
    case 'j_confirm': {
      if (low !== 'yes') return 'Reply *YES* to send your request, or *MENU* to start again.';
      const r = await createJob({ category: s.data.category, city: s.data.city, service: s.data.service, details: s.data.details,
        timing: s.data.timing, name: s.data.name, email: s.data.email, phone: '+' + phone, consent: true, source: 'whatsapp' });
      await admin.from('gc_wa_sessions').delete().eq('phone', phone);
      if (!r.ok) return `That did not send: ${r.error}`;
      if (r.offered === 0) return `Thank you. Your request is *${r.ref}*. No verified business near you is available for this right now, so our team will follow up.`;
      return `Sent! Your request *${r.ref}* went to ${r.offered} verified business${r.offered === 1 ? '' : 'es'}. We will message you here as soon as one accepts.\n\nFollow all replies: ${SITE}/job/#t=${r.token}`;
    }
  }
  s.step = 'menu'; s.data = {}; await save(s);
  return MENU;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    return ok ? new Response(url.searchParams.get('hub.challenge') || '') : new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method', { status: 405 });

  const raw = await req.text();
  if (!(await waSignatureOk(raw, req.headers.get('x-hub-signature-256')))) return new Response('bad signature', { status: 401 });
  let body: { entry?: { changes?: { value?: { messages?: Record<string, any>[] } }[] }[] };
  try { body = JSON.parse(raw); } catch { return new Response('ok'); }

  for (const entry of body.entry || []) for (const ch of entry.changes || []) for (const m of (ch.value && ch.value.messages) || []) {
    // Meta retries deliveries: handle each message once
    const { error: dup } = await admin.from('gc_wa_seen').insert({ message_id: m.id });
    if (dup) continue;
    const text = m.type === 'text' ? m.text?.body
      : m.type === 'interactive' ? (m.interactive?.button_reply?.title || m.interactive?.list_reply?.title)
      : m.type === 'button' ? m.button?.text : null;
    try {
      const reply = text ? await handle(m.from, String(text)) : 'Please reply with text. Type *menu* to see the options.';
      await waText(m.from, reply);
    } catch (e) {
      console.error('whatsapp handle', e);
      await waText(m.from, 'Sorry, something went wrong on our side. Type *menu* to start again, or call 021 879 3035.');
    }
  }
  return new Response('ok');
});
