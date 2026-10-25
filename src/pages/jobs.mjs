// Smart quote matching pages and the business owner dashboard.
import { esc, layout, crumbs, crumbLD, ySvg, seal, SITE, CATS, CITIES } from '../lib.mjs';

const ph = (it, eyebrow, h1, lede) => `<section class="ph">${ySvg('y', 'rgba(22,82,240,.07)', 'rgba(22,82,240,.12)')}<div class="wrap">${crumbs(it)}
<p class="eyebrow">${eyebrow}</p><h1>${h1}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div></section>`;
const WA = SITE.whatsapp;

/* ================================================================ get quotes */
export function getQuotes() {
  const it = [['Home', '/'], ['Get quotes']];
  const body = `${ph(it, 'Free · no account needed', 'Get quotes from verified businesses', 'Tell us about the job once. We send it to up to three businesses near you that a person at Getclient has checked. The ones that can help contact you.')}
<section class="sec" style="padding-top:2.4rem"><div class="wrap quote-g">
  <div>
    <form class="form card" id="gc-job-form" novalidate style="padding:1.8rem">
      <div class="row2">
        <div class="f"><label for="jc">What kind of help? *</label><select id="jc" name="category" required><option value="">Choose a category</option>${CATS.map(c => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="f"><label for="jl">Where is the job? *</label><select id="jl" name="city" required><option value="">Choose a town or city</option>${CITIES.map(c => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></div>
      </div>
      <div class="f"><label for="js">What service do you need? *</label><input id="js" name="service" required maxlength="80" placeholder="e.g. Plumber, geyser repair, website, accountant"><span class="hint">A few words. This is how we find the right specialists.</span></div>
      <div class="f"><label for="jd">Describe the job *</label><textarea id="jd" name="details" required minlength="20" maxlength="2000" placeholder="What needs doing, the area, size, anything the business should know."></textarea></div>
      <div class="f"><span class="flabel">When do you need it? *</span>
        <div class="seg">${[['urgent', 'Urgent'], ['week', 'This week'], ['month', 'This month'], ['flexible', 'Flexible']].map(([v, t], i) =>
          `<label><input type="radio" name="timing" value="${v}"${i === 1 ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
      <div class="f"><label for="jb">Budget <span class="mut">(optional)</span></label><input id="jb" name="budget" maxlength="60" placeholder="e.g. R2,000 to R5,000"></div>
      <fieldset class="fs" style="margin:0"><legend>Your details</legend>
        <div class="f"><label for="jn">Your name *</label><input id="jn" name="name" required autocomplete="name"></div>
        <div class="row2">
          <div class="f"><label for="je">Email *</label><input id="je" name="email" type="email" required autocomplete="email"><span class="hint">Replies arrive here.</span></div>
          <div class="f"><label for="jp">Phone <span class="mut">(recommended)</span></label><input id="jp" name="phone" inputmode="tel" autocomplete="tel"></div>
        </div>
      </fieldset>
      <label class="chk"><input type="checkbox" name="consent" id="jconsent"><span>I agree that Getclient may share this request with up to three matched businesses, and give my contact details to the ones that accept. <a href="/privacy/">Privacy</a></span></label>
      <div class="ts" data-gc-turnstile="job_request"></div>
      <button class="btn btn-p btn-blk" type="submit" id="gc-job-submit"><i class="fa-solid fa-paper-plane"></i> Get my quotes</button>
      <p class="msg" id="gc-job-msg" role="status"></p>
    </form>
    <div class="card" id="gc-job-done" hidden style="padding:2rem;text-align:center;border-color:var(--ok)">
      <i class="fa-solid fa-circle-check" style="font-size:2.6rem;color:var(--ok)"></i>
      <h2 style="margin:.8rem 0 .4rem">Request sent</h2>
      <p class="lede" style="margin-inline:auto" id="gc-job-done-text"></p>
      <p><a class="btn btn-p" id="gc-job-status-link" href="#">Follow your request</a></p>
      <p class="hint">We also emailed you this private link. Reference <b id="gc-job-ref"></b>.</p>
    </div>
  </div>
  <aside class="quote-how">
    <div class="card"><h3>How it works</h3>
      <ol class="howto" style="margin-top:.6rem">
        <li><b>One request.</b> Describe the job once.</li>
        <li><b>Matched to specialists.</b> Up to three verified Blue or Gold businesses in your area whose services match your job.</li>
        <li><b>They say yes or no.</b> A business that can't help passes, and we offer your job to the next best match.</li>
        <li><b>You hear back.</b> Businesses that accept get your contact details and contact you. We email you who they are.</li>
      </ol></div>
    <div class="card"><h3>Why it's safe</h3><ul class="ticks" style="margin:.6rem 0 0">
      <li><span>Every business was checked by a person: identity and CIPC at least.</span></li>
      <li><span>Your number is only shared with businesses that accept.</span></li>
      <li><span>Free for you, always. No account.</span></li></ul></div>
    <a class="card wa-cta" href="${WA}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i><span><b>Prefer WhatsApp?</b><small>Message us and choose "Get quotes".</small></span></a>
  </aside>
</div></section>`;
  return layout({ title: 'Get quotes from verified businesses', path: '/get-quotes/', page: 'quotes', body, turnstile: true, scripts: ['jobs.js'],
    desc: 'Describe your job once and get quotes from up to three verified South African businesses near you. Free, no account needed.', ld: [crumbLD(it)] });
}

/* ================================================================ client status */
export function jobPage() {
  const body = `${ph([['Home', '/'], ['Your request']], 'Your request', 'Replies to your request', '')}
<section class="sec" style="padding-top:2rem"><div class="wrap" style="max-width:860px" id="gc-job-status"><p class="lede">Loading…</p></div></section>`;
  return layout({ title: 'Your request', path: '/job/', body, noindex: true, scripts: ['jobs.js'], desc: 'The replies to your Getclient request.' });
}

/* ================================================================ business answers an offer */
export function leadPage() {
  const body = `${ph([['Home', '/'], ['Job offer']], 'Job offer', 'A client needs your help', '')}
<section class="sec" style="padding-top:2rem"><div class="wrap" style="max-width:820px" id="gc-lead"><p class="lede">Loading…</p></div></section>`;
  return layout({ title: 'Job offer', path: '/lead/', body, noindex: true, scripts: ['jobs.js'], desc: 'A job offer from Getclient.' });
}

/* ================================================================ owner dashboard */
export function dashboard() {
  const tab = (id, icon, label, on) => `<button class="atab${on ? ' on' : ''}" data-tab="${id}"><i class="fa-solid ${icon}"></i> ${label}<b data-badge="${id}" hidden></b></button>`;
  const body = `<section class="sec" style="padding-top:2.2rem"><div class="wrap" id="gc-dash">
  <div id="gc-dash-login"><div class="card" style="max-width:460px;margin-inline:auto;padding:2rem">
    <img src="/assets/brand/mark.svg" alt="" width="44" height="44" style="margin-bottom:1rem">
    <h1 style="font-size:1.6rem;margin-bottom:.3rem">Your business on Getclient</h1>
    <p class="mut" style="font-size:.92rem">Sign in with the email address on your listing. We email you a 6-digit code; no password needed.</p>
    <form class="form" id="gc-dash-email" style="margin-top:1.2rem">
      <div class="f"><label for="de">Email on your listing</label><input id="de" type="email" required autocomplete="email"></div>
      <button class="btn btn-p btn-blk" type="submit">Email me a code</button></form>
    <form class="form" id="gc-dash-code" hidden style="margin-top:1.2rem">
      <div class="f"><label for="dc">6-digit code</label><input id="dc" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></div>
      <button class="btn btn-p btn-blk" type="submit">Sign in</button>
      <button class="btn btn-g btn-blk" type="button" id="gc-dash-back">Use a different email</button></form>
    <p class="msg" id="gc-dash-msg" role="status"></p>
    <p class="hint" style="margin-top:1rem">Not listed yet? <a href="/list/">List your business free</a>.</p>
  </div></div>

  <div id="gc-dash-app" hidden>
    <div class="head" style="margin-bottom:1rem"><div><p class="eyebrow">My business</p><h1 style="font-size:1.8rem;margin:0" id="gc-dash-name">…</h1>
      <div class="chips" style="margin-top:.5rem" id="gc-dash-chips"></div></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center"><select id="gc-dash-pick" hidden class="ainput"></select>
        <a class="btn btn-g btn-s" id="gc-dash-view" href="#" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> View profile</a>
        <button class="btn btn-g btn-s" id="gc-dash-out">Sign out</button></div></div>
    <div class="atabs" role="tablist">
      ${tab('overview', 'fa-chart-line', 'Overview', true)}${tab('jobs', 'fa-briefcase', 'Job offers')}${tab('quotes', 'fa-paper-plane', 'Quote requests')}
      ${tab('listing', 'fa-pen', 'My listing')}${tab('services', 'fa-list-check', 'Services')}${tab('photos', 'fa-image', 'Photos')}${tab('badge', 'fa-certificate', 'Badge')}
    </div>
    <div id="gc-dash-body" style="margin-top:1.4rem"></div>
  </div>
  <div id="gc-dash-none" hidden class="empty" style="max-width:640px;margin-inline:auto">
    <h3>No listing uses this email</h3><p>Sign in with the email address on your Getclient listing, or <a href="/list/">list your business</a>. Need help? <a href="mailto:${SITE.email}">${SITE.email}</a></p>
    <button class="btn btn-g" id="gc-dash-out2">Sign out</button></div>
</div></section>`;
  return layout({ title: 'My business dashboard', path: '/dashboard/', body, noindex: true, promo: false, scripts: ['dashboard.js'],
    desc: 'Manage your Getclient listing, answer job offers and see your stats.' });
}
