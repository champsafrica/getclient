// Creating a job, shared by the website (submit-job) and WhatsApp.
import { admin } from './db.ts';
import { clean } from './http.ts';
import { newToken, tokenHash, TIMING } from './tokens.ts';
import { send, shell, esc, button, ORIGIN } from './mail.ts';

export type JobInput = {
  category: unknown; city: unknown; service: unknown; details: unknown; timing: unknown; budget?: unknown;
  name: unknown; email?: unknown; phone?: unknown; consent: unknown; source: 'web' | 'whatsapp';
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function createJob(i: JobInput): Promise<
  { ok: true; ref: string; token: string; offered: number; status: string } | { ok: false; error: string; status: number }> {
  const j = {
    category: clean(i.category, 60), city: clean(i.city, 60), service: clean(i.service, 80),
    details: clean(i.details, 2000), timing: clean(i.timing, 10), budget: clean(i.budget, 60) || null,
    client_name: clean(i.name, 120), client_email: clean(i.email, 200).toLowerCase() || null,
    client_phone: clean(i.phone, 30) || null, consent: i.consent === true, source: i.source,
  };
  if (!j.consent) return { ok: false, status: 422, error: 'Please agree that your request may be shared with the matched businesses.' };
  if (j.service.length < 2) return { ok: false, status: 422, error: 'Say what service you need.' };
  if (j.details.length < 20) return { ok: false, status: 422, error: 'Describe the job in a little more detail (20 characters or more).' };
  if (!TIMING[j.timing]) return { ok: false, status: 422, error: 'Choose when you need it done.' };
  if (j.client_name.length < 2) return { ok: false, status: 422, error: 'Enter your name.' };
  if (j.client_email && !EMAIL.test(j.client_email)) return { ok: false, status: 422, error: 'That email address does not look right.' };
  if (!j.client_email && !j.client_phone) return { ok: false, status: 422, error: 'Enter an email address or phone number.' };
  if (j.source === 'web' && !j.client_email) return { ok: false, status: 422, error: 'Enter your email address so we can send you the replies.' };

  const [{ data: cat }, { data: loc }] = await Promise.all([
    admin.from('gc_categories').select('slug').eq('slug', j.category).maybeSingle(),
    admin.from('gc_locations').select('slug').eq('slug', j.city).maybeSingle(),
  ]);
  if (!cat) return { ok: false, status: 422, error: 'Choose a category.' };
  if (!loc) return { ok: false, status: 422, error: 'Choose your town or city.' };

  // fair use: one job every 10 minutes, five a day, per email or phone
  const who = j.client_email ? ['client_email', j.client_email] : ['client_phone', j.client_phone!];
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const { count: recent } = await admin.from('gc_jobs').select('id', { count: 'exact', head: true }).eq(who[0], who[1]).gte('created_at', since(10 * 60e3));
  const { count: today } = await admin.from('gc_jobs').select('id', { count: 'exact', head: true }).eq(who[0], who[1]).gte('created_at', since(24 * 3600e3));
  if ((recent || 0) >= 1) return { ok: false, status: 429, error: 'You sent a request a few minutes ago. Give the businesses a moment to answer.' };
  if ((today || 0) >= 5) return { ok: false, status: 429, error: 'That is the limit of five requests a day. Please try again tomorrow.' };

  const token = newToken();
  const { data: job, error } = await admin.from('gc_jobs')
    .insert({ ...j, client_token_hash: await tokenHash(token) }).select('id, ref').single();
  if (error || !job) { console.error('job insert', error); return { ok: false, status: 500, error: 'Your request could not be saved. Please try again.' }; }

  const { data: offered } = await admin.rpc('gc_match_job', { p_job: job.id });
  const { data: after } = await admin.from('gc_jobs').select('status').eq('id', job.id).single();

  // the client's confirmation (the no-match email is sent by the database event instead)
  if (j.client_email && (offered || 0) > 0) {
    await send({
      to: j.client_email, subject: `Your request ${job.ref} has gone to verified businesses`,
      html: shell('Your request is with verified businesses',
        `<p>Hi ${esc(j.client_name.split(' ')[0])},</p>
         <p>We sent your request for <b>${esc(j.service)}</b> to <b>${offered}</b> verified
         business${offered === 1 ? '' : 'es'} near you. Each one has been checked by a person at Getclient.</p>
         <p>As soon as a business accepts, we email you its name and contact details, and it gets yours.
         If one cannot help, we pass your request to the next best match automatically.</p>
         ${button(`${ORIGIN}/job/#t=${token}`, 'Follow your request')}
         <p style="font-size:13px;color:#55658C">Keep this email: the button above is your private link to the replies. Reference ${esc(job.ref)}.</p>`),
    });
  }
  return { ok: true, ref: job.ref, token, offered: offered || 0, status: after ? after.status : 'matching' };
}
