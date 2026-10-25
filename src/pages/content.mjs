import { esc, layout, crumbs, crumbLD, seal, ySvg, SITE, CATS, CITIES } from '../lib.mjs';
import { PROVINCES, TIERS } from '../data/site.mjs';
import { ledger } from './directory.mjs';

const ph = (it, eyebrow, h1, lede) => `<section class="ph">${ySvg('y', 'rgba(22,82,240,.07)', 'rgba(22,82,240,.12)')}<div class="wrap">${crumbs(it)}
<p class="eyebrow">${eyebrow}</p><h1>${h1}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div></section>`;
const page = (o, it) => layout(Object.assign({ ld: [crumbLD(it)] }, o));
const cards = (items, cols = 'g2') => `<div class="grid ${cols}">${items.map(([h, p]) => `<div class="card"><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>`;
const ALL = { blue: { gold: 1, blue: 1 } };

/* ================================================================ list */
// The Getclient badge is shown at every stage of the application, and the
// badge has to be found on the applicant's website before they can continue.
const stageBadge = (note) => `<div class="stagebadge"><img src="/assets/badge/listed-light.svg" alt="Listed on Getclient" width="148" height="52"><span>${note}</span></div>`;
const UNIVERSAL = '<script src="https://getclient.co.za/badge.js" async></script>';

export function list() {
  const it = [['Home', '/'], ['List your business']];
  const pick = (v, label, price, per, d, docs, checked) => `<label class="pick"><input type="radio" name="requested_plan" value="${v}"${checked ? ' checked' : ''}>
  <span class="pick__b"><span>${v === 'basic' ? '<span class="tier tier--none">Basic</span>' : `<span class="tier tier--${v}">${seal(v)} ${label}</span>`}</span>
  <span class="pick__p">${price}<small>${per}</small></span><span class="pick__d">${d}</span>
  <span class="pick__r"><strong>Documents required:</strong> ${docs}</span></span></label>`;
  const body = `${ph(it, 'For businesses', 'List your business', 'Five steps. Every listing displays the Listed on Getclient badge on its own website, and a person reads every submission before it goes live.')}
<section class="sec" style="padding-top:2.6rem"><div class="wrap" style="max-width:900px">
  <div class="note" id="gc-resubmit" hidden style="margin-bottom:1.2rem"></div>
  <ol class="steps-bar steps-bar--5" id="gc-steps"><li data-step="1" class="on"><span>1</span> Tier</li><li data-step="2"><span>2</span> Details</li><li data-step="3"><span>3</span> Badge</li><li data-step="4"><span>4</span> Documents</li><li data-step="5"><span>5</span> Confirm</li></ol>

  <div id="gc-list-done" hidden class="card" style="padding:2.2rem;border-color:var(--ok)">
    <div style="text-align:center"><img src="/assets/badge/listed-light.svg" alt="Listed on Getclient" width="148" height="52"><h2 style="margin:.8rem 0 .5rem">Submission received</h2>
    <p class="lede" style="margin-inline:auto">Your listing ID is <code id="gc-done-id">—</code>. We have emailed you a welcome message with your badge code. A person will review your listing within one to two business days.</p>
    <p id="gc-done-paid" hidden class="note note--ok" style="text-align:left">Payment received. Your badge is issued as soon as a reviewer confirms the documents.</p>
    <p id="gc-done-nobadge" hidden class="note note--w" style="text-align:left">We could not find the badge on your website yet. Your listing will not be approved until it is there.</p></div>
    <div class="done-badge"><h3>Keep this badge on your website</h3>
      <p class="mut" style="font-size:.92rem">You can keep the code you already added. This version is tied to your listing ID and shows your tier once you are approved:</p>
      <div class="codebox" style="margin-top:1rem"><button type="button" class="btn btn-s copy" data-copy="#gc-done-code">Copy</button><pre id="gc-done-code"></pre></div>
      <p style="margin-top:1rem;font-size:.88rem"><a href="#" id="gc-done-more">Other styles, plain HTML and email signature versions →</a></p></div>
    <p style="text-align:center;margin:1.4rem 0 0"><a class="btn btn-g" href="/">Back to the directory</a></p>
  </div>

  <form class="form" id="gc-list-form" novalidate>
    <div class="step-pane" data-pane="1">
      ${stageBadge('Every tier carries the Getclient badge on its website. It is free and required.')}
      <h2 style="font-size:1.3rem;margin-bottom:.3rem">Which tier are you applying for?</h2>
      <p class="lede" style="margin-bottom:1.3rem">Start on Basic and upgrade later if you like. Paid tiers are billed once a year, only after your documents and badge are checked. <a href="/pricing/#compare">Compare tiers</a>.</p>
      <div class="picks">
        ${pick('basic', 'Basic', 'R0', 'free forever', 'A description of your business and your contact details.', 'No documents needed', true)}
        ${pick('blue', 'Blue Verified', SITE.prices.blue, SITE.period, 'Identity and CIPC confirmed. Photos, quote requests and the Blue Verified showcase on every page.', 'CIPC document + ID or passport')}
        ${pick('gold', 'Gold Verified', SITE.prices.gold, SITE.period, 'The full check. Ads on every page, your services, photos and a cover image.', 'CIPC, ID or passport, SARS tax clearance, insurance certificate')}
      </div>
      <div class="pane-nav"><button type="button" class="btn btn-p" data-next="2">Continue <i class="fa-solid fa-arrow-right"></i></button></div>
    </div>

    <div class="step-pane" data-pane="2" hidden>
      ${stageBadge('Your listing will carry the Listed on Getclient badge.')}
      <h2 style="font-size:1.3rem;margin-bottom:1rem">Business details</h2>
      <fieldset class="fs"><legend>Business</legend>
        <div class="f"><label for="bn">Registered business name *</label><input id="bn" name="name" required autocomplete="organization"></div>
        <div class="row2">
          <div class="f"><label for="bc">Category *</label><select id="bc" name="category" required><option value="">Choose one</option>${CATS.map(c => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></div>
          <div class="f"><label for="bs">Speciality</label><input id="bs" name="subcategory" placeholder="e.g. Conveyancing"></div>
        </div>
        <div class="f"><label for="bt">One-line summary</label><input id="bt" name="tagline" maxlength="120" placeholder="What you do, in one sentence."></div>
        <div class="f"><label for="bd">Description of your business *</label><textarea id="bd" name="description" required minlength="50"></textarea><span class="hint">At least 50 characters. This is the text clients read.</span></div>
        <div class="row2">
          <div class="f"><label for="bcity">City *</label><select id="bcity" name="city" required><option value="">Choose one</option>${CITIES.map(c => `<option value="${c.slug}" data-prov="${c.province}">${c.name}</option>`).join('')}</select></div>
          <div class="f"><label for="bprov">Province *</label><select id="bprov" name="province" required><option value="">Choose one</option>${PROVINCES.map(p => `<option value="${p.slug}">${p.name}</option>`).join('')}</select></div>
        </div>
        <div class="row2">
          <div class="f"><label for="bf">Year established *</label><input id="bf" name="founded" type="number" min="1900" max="${new Date().getFullYear()}" required></div>
          <div class="f"><label for="be">Team size</label><select id="be" name="employees"><option>1-5</option><option>6-20</option><option>21-50</option><option>51-200</option><option>200+</option></select></div>
        </div>
      </fieldset>
      <fieldset class="fs"><legend>Contact</legend>
        <div class="row2">
          <div class="f"><label for="bp">Phone *</label><input id="bp" name="phone" required inputmode="tel" autocomplete="tel"></div>
          <div class="f"><label for="bem">Business email *</label><input id="bem" name="email" type="email" required autocomplete="email"></div>
        </div>
        <div class="f"><label for="bw">Website *</label><input id="bw" name="website" type="url" required placeholder="https://yourbusiness.co.za"><span class="hint">Required. The Listed on Getclient badge goes on this website in the next step.</span></div>
        <div class="row2">
          <div class="f"><label for="bcn">Contact person *</label><input id="bcn" name="contact_name" required autocomplete="name"></div>
          <div class="f"><label for="bcr">Role</label><input id="bcr" name="contact_role" placeholder="Owner, Director…"></div>
        </div>
        <div class="f"><label for="bci">CIPC registration number <span data-req-cipc hidden>*</span></label><input id="bci" name="cipc" placeholder="2019/123456/07"><span class="hint">Required for Blue and Gold. Checked against the CIPC register.</span></div>
      </fieldset>
      <fieldset class="fs" data-plan-only="blue gold" hidden><legend>Your services <span class="tier tier--blue" style="margin-left:.3rem">Blue and Gold</span></legend>
        <p class="hint" style="margin:0">Blue: up to 8 services. Gold: up to 12. They appear on your profile with your contact details.</p>
        <div id="gc-services"></div>
        <button type="button" class="btn btn-g btn-s" id="gc-add-service" style="justify-self:start"><i class="fa-solid fa-plus"></i> Add a service</button>
      </fieldset>
      <fieldset class="fs" data-plan-only="blue gold" hidden><legend>Photos <span style="font-weight:400;color:var(--mut)">(optional)</span></legend>
        <div class="f"><label for="bphotos">Photos of your work, premises or team</label><input id="bphotos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><span class="hint" id="gc-photo-hint">Blue: up to 6 images. Gold: up to 20. 5&nbsp;MB each. The first becomes your cover image.</span></div>
        <div id="gc-photo-preview" class="thumbs"></div>
      </fieldset>
      <p class="note" data-plan-only="basic" style="font-size:.86rem">Basic listings show your description and contact details only. Services, photos and quote requests come with <a href="/pricing/#compare">Blue and Gold</a>.</p>
      <div class="pane-nav"><button type="button" class="btn btn-g" data-back="1">Back</button><button type="button" class="btn btn-p" data-next="3">Continue <i class="fa-solid fa-arrow-right"></i></button></div>
    </div>

    <div class="step-pane" data-pane="3" hidden>
      <h2 style="font-size:1.3rem;margin-bottom:.3rem">Add the Getclient badge to your website</h2>
      <p class="lede" style="margin-bottom:1.2rem">This step is required for every listing. Paste the code below into your website, publish it, then press <b>Check my website</b>. You cannot continue until we find it.</p>
      <div class="grid g2" style="align-items:start">
        <div class="stage" style="min-height:0;padding:1.6rem"><img src="/assets/badge/listed-light.svg" alt="Listed on Getclient" width="148" height="52"><span class="hint">What your visitors will see</span></div>
        <ol class="howto">
          <li>Copy the code.</li>
          <li>Paste it into your website's footer, or any page. WordPress: Appearance → Widgets → Custom HTML. Wix: Settings → Custom code. Shopify: Online store → Themes → Edit code.</li>
          <li>Publish your site, then check it below.</li>
        </ol>
      </div>
      <div class="codebox" style="margin-top:1rem"><button type="button" class="btn btn-s copy" data-copy="#gc-badge-universal">Copy</button><pre id="gc-badge-universal">${esc(UNIVERSAL)}</pre></div>
      <div class="badgecheck">
        <div class="f" style="flex:1"><label for="gc-badge-url">Page where you added the badge</label><input id="gc-badge-url" type="url" placeholder="https://yourbusiness.co.za"></div>
        <button type="button" class="btn btn-p" id="gc-badge-check"><i class="fa-solid fa-magnifying-glass"></i> Check my website</button>
      </div>
      <p class="msg" id="gc-badge-msg" role="status"></p>
      <div class="pane-nav"><button type="button" class="btn btn-g" data-back="2">Back</button><button type="button" class="btn btn-p" data-next="4">Continue <i class="fa-solid fa-arrow-right"></i></button></div>
    </div>

    <div class="step-pane" data-pane="4" hidden>
      ${stageBadge('Badge found. Your listing will carry it from day one.')}
      <h2 style="font-size:1.3rem;margin-bottom:.3rem">Verification documents</h2>
      <p class="lede" style="margin-bottom:1rem" id="gc-docs-intro"></p>
      <div class="note" style="margin-bottom:1.2rem"><strong>How your documents are handled.</strong> They go to a private store that is not publicly readable, are opened only by a reviewer through a short-lived link, and are deleted within 90 days of the check being recorded. Your profile shows only that a check passed and when, never the document.</div>
      <div id="gc-doc-fields"></div>
      <label class="chk" style="margin-top:1rem"><input type="checkbox" id="gc-doc-consent"><span>I consent to Digitalx processing these documents to verify this business, as described in the <a href="/privacy/">Privacy Policy and POPIA notice</a>.</span></label>
      <div class="pane-nav"><button type="button" class="btn btn-g" data-back="3">Back</button><button type="button" class="btn btn-p" data-next="5">Continue <i class="fa-solid fa-arrow-right"></i></button></div>
    </div>

    <div class="step-pane" data-pane="5" hidden>
      ${stageBadge('Listed on Getclient: on your website and on your profile.')}
      <h2 style="font-size:1.3rem;margin-bottom:1rem">Confirm and submit</h2>
      <div class="card" id="gc-summary" style="margin-bottom:1.2rem"></div>
      <div class="fs" id="gc-promo-box" hidden style="margin-bottom:1.2rem"><legend>Discount code</legend>
        <div class="promo"><input id="gc-promo" placeholder="Enter code" autocomplete="off" spellcheck="false"><button type="button" class="btn btn-g" id="gc-promo-go">Apply</button></div>
        <p class="promo__msg" id="gc-promo-msg"></p></div>
      <fieldset class="fs"><legend>Declaration</legend>
        <label class="chk"><input type="checkbox" name="consent_terms" required value="true"><span>The information above is accurate and this is a legally operating South African business. I accept the <a href="/terms/">Terms</a> and <a href="/privacy/">Privacy Policy</a>.</span></label>
        <label class="chk"><input type="checkbox" name="consent_review" required value="true"><span>I understand a verified badge is only issued once a reviewer confirms my documents, and that paying for a tier buys the verification work rather than the badge itself.</span></label>
        <label class="chk"><input type="checkbox" id="gc-badge-consent" required><span>I will keep the <b>Listed on Getclient</b> badge on my website for as long as I am listed. Removing it can end the listing.</span></label>
      </fieldset>
      <div class="ts" data-gc-turnstile="listing_submit"></div>
      <div class="pane-nav"><button type="button" class="btn btn-g" data-back="4">Back</button><button class="btn btn-p" type="submit" id="gc-submit">Submit for review</button></div>
      <p id="gc-list-status" class="msg"></p>
    </div>
  </form>
</div></section>`;
  return page({ title: 'List your business', path: '/list/', body, pay: true, turnstile: true, desc: 'List your South African business on Getclient for free, or apply for Blue or Gold verification. Every listing carries the Listed on Getclient badge.' }, it);
}

/* ================================================================ pricing */
const cell = v => v === true ? '<i class="fa-solid fa-circle-check yes" aria-label="Included"></i>'
  : v === false ? '<span class="no" aria-label="Not included">–</span>' : esc(v);

export function compareTable() {
  return `<div class="tablewrap cmp" id="compare"><table class="table">
  <thead><tr><th scope="col">What you get</th><th scope="col">Basic<small>Free</small></th><th scope="col" class="cmp--blue">${seal('blue')} Blue Verified<small>${SITE.prices.blue} ${SITE.period}</small></th><th scope="col" class="cmp--gold">${seal('gold')} Gold Verified<small>${SITE.prices.gold} ${SITE.period}</small></th></tr></thead>
  <tbody>${TIERS.slice(1).map(([k, a, b, c]) => `<tr><th scope="row">${esc(k)}</th><td data-l="Basic">${cell(a)}</td><td data-l="Blue" class="cmp--blue">${cell(b)}</td><td data-l="Gold" class="cmp--gold">${cell(c)}</td></tr>`).join('')}</tbody>
  <tfoot><tr><th></th><td><a class="btn btn-g btn-s" href="/list/?plan=basic">Start free</a></td><td class="cmp--blue"><a class="btn btn-p btn-s" href="/list/?plan=blue">Apply for Blue</a></td><td class="cmp--gold"><a class="btn btn-gold btn-s" href="/list/?plan=gold">Apply for Gold</a></td></tr></tfoot>
  </table></div>`;
}

export function pricing() {
  const it = [['Home', '/'], ['Pricing']];
  const li = (ok, t) => `<li${ok ? '' : ' class="no"'}><span style="color:${ok ? 'var(--blue)' : 'inherit'}">${ok ? '<i class="fa-solid fa-check"></i>' : '–'}</span> ${t}</li>`;
  const plan = (cls, chip, price, per, d, items, href, btn, b) => `<div class="plan${cls}">${chip}<div class="plan__price">${price}</div><div class="plan__period">${per}</div>
    <p style="font-size:.9rem;color:var(--mut)">${d}</p><ul>${items.map(([o, t]) => li(o, t)).join('')}</ul><a class="btn ${b} btn-blk" href="${href}">${btn}</a></div>`;
  const body = `${ph(it, 'Pricing', 'Free to be listed. Paid once a year to be verified.', 'Every tier carries the Listed on Getclient badge on its own website. Blue and Gold are billed once a year and pay for the verification work and the promotion. If a check fails, we refund and you stay on Basic.')}
<section class="sec"><div class="wrap"><div class="plans">
  ${plan('', '<span class="tier tier--none">Basic</span>', 'R0', 'free forever', 'A description of your business and your contact details. That is all.',
    [[1, 'Directory listing and profile page'], [1, 'Business description'], [1, 'Contact details'], [1, '<b>Listed on Getclient</b> badge (required)'], [0, 'Photos'], [0, 'Services list'], [0, 'Quote requests'], [0, 'Promotion']], '/list/?plan=basic', 'Start free', 'btn-g')}
  ${plan(' plan--feature', `<span class="tier tier--blue">${seal('blue')} Blue Verified</span>`, SITE.prices.blue, SITE.period, 'Identity and CIPC confirmed, and recognised across the whole site.',
    [[1, 'Everything in Basic'], [1, 'Blue seal next to your name'], [1, 'Identity + CIPC check'], [1, 'Up to 6 photos'], [1, 'Quote requests emailed to you'], [1, 'WhatsApp button'], [1, 'Blue Verified showcase on every page, under Gold'], [1, 'Ranked above every Basic listing'], [1, 'List up to 8 services'], [0, 'Ads on every page']], '/list/?plan=blue', 'Apply for Blue Verified', 'btn-p')}
  ${plan(' plan--gold', `<span class="tier tier--gold">${seal('gold')} Gold Verified</span>`, SITE.prices.gold, SITE.period, 'The full check, and your business advertised on every page of Getclient.',
    [[1, 'Everything in Blue'], [1, 'Gold seal next to your name'], [1, 'Insurance, tax clearance, 3+ years trading'], [1, '<b>Ads on every page and section</b>'], [1, 'List up to 12 services'], [1, 'Up to 20 photos and a cover image'], [1, 'Top of every list'], [1, 'Dedicated account manager']], '/list/?plan=gold', 'Apply for Gold Verified', 'btn-gold')}
</div></div></section>
<section class="sec sec--surf"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Compare</p><h2 style="margin:0">Every benefit, side by side</h2></div></div>
  ${compareTable()}
  <div class="note" style="margin-top:1.4rem">All prices in ZAR, billed once a year in advance through Paystack, and exclude VAT. Verification is re-run every 12 months on renewal.</div>
</div></section>
<section class="sec"><div class="wrap"><h2 style="margin-bottom:1.6rem">Common questions</h2>${cards([
  ['Why must every listing show the badge?', 'The badge is how Getclient grows and how your visitors check you are real. Every application has to show the Listed on Getclient badge on its website before it can be approved, on every tier.'],
  ['Can I buy a badge without the check?', 'No. The tier is set by our reviewers after the checks pass, and the applicant cannot set it themselves. Paying for Blue or Gold buys the verification work and the promotion, not the badge on its own.'],
  ['What exactly does Gold advertising include?', 'Gold businesses appear in the sponsored bar at the top of every page, in the featured Gold section at the bottom of every page, first in every list, beside other businesses’ profiles and above search results. Every placement is labelled Ad.'],
  ['What does Blue promotion include?', 'Blue Verified businesses appear in the Blue Verified showcase on every page, directly under the Gold section, and rank above every Basic listing.'],
  ['What happens if I do not renew?', 'Your listing drops to Basic and stays in the directory with your description and contact details. The badge on your website switches to Listed on Getclient within 24 hours.'],
  ['Do you take a commission on jobs?', 'No. Getclient charges a flat annual fee. What you agree with a client is between you and them.']])}</div></section>`;
  return page({ title: 'Pricing and tier comparison', path: '/pricing/', body, desc: `Basic is free. Blue Verified ${SITE.prices.blue} per year. Gold Verified ${SITE.prices.gold} per year with ads on every page. Compare every benefit.` }, it);
}

/* ================================================================ badge */
export function badge(sizes) {
  const it = [['Home', '/'], ['Website badge']];
  const img = (n, w) => `<img src="/assets/badge/${n}.svg" alt="" width="${sizes[n][0]}" height="${sizes[n][1]}">`;
  const body = `${ph(it, 'Listed on Getclient', 'Put the badge on your website', 'Every business on Getclient, on every tier, must display the <b>Listed on Getclient</b> badge on its own website. Applications are only approved once we find it. A visitor who clicks it lands on your checked record here.')}
<section class="sec sec--tight"><div class="wrap"><div class="grid g2">
  <div class="stage">${'<div class="stage__row">' + img('listed-light') + img('blue-light') + img('gold-light') + '</div>'}<span class="hint">Light, for white or pale backgrounds</span></div>
  <div class="stage stage--d">${'<div class="stage__row">' + img('listed-dark') + img('blue-dark') + img('gold-dark') + '</div>'}<span class="hint" style="color:#9FB3E6">Dark, for navy or black footers</span></div>
</div></div></section>

<section class="sec" style="padding-top:1rem"><div class="wrap" id="gc-badge-builder">
  <div class="bb">
    <div class="card">
      <h2 style="font-size:1.15rem;margin-bottom:1rem">Build your code</h2>
      <div class="form">
        <div class="f suggest"><label for="bb-find">Find your business</label><input id="bb-find" placeholder="Start typing your business name" autocomplete="off"><div class="suggest__list" id="bb-suggest" role="listbox"></div></div>
        <div class="f"><label for="bb-id">Listing ID</label><input id="bb-id" value="gc-000001" spellcheck="false"><span class="hint">On your profile page under Contact, and in your approval email.</span></div>
        <div class="f"><label for="bb-name">Business name</label><input id="bb-name" value="Digitalx"></div>
        <div class="f"><label for="bb-tier">Tier</label><select id="bb-tier"><option value="none">Listed (standard)</option><option value="blue">Blue Verified</option><option value="gold">Gold Verified</option></select><span class="hint">The script version always shows the tier you actually hold.</span></div>
        <div class="row2">
          <div class="f"><label for="bb-theme">Theme</label><select id="bb-theme"><option value="light">Light</option><option value="dark">Dark</option></select></div>
          <div class="f"><label for="bb-size">Size</label><select id="bb-size"><option value="default">Default</option><option value="compact">Compact</option></select></div>
        </div>
        <div class="f"><label for="bb-layout">Placement</label><select id="bb-layout"><option value="inline">Inline, where the code sits</option><option value="float-br">Floating, bottom right</option><option value="float-bl">Floating, bottom left</option></select></div>
        <input type="hidden" id="bb-slug" value="digitalx">
      </div>
    </div>
    <div class="opt">
      <div class="stage" id="bb-stage" style="min-height:150px"><div id="bb-preview"></div><span class="hint" id="bb-preview-note">Live preview</span></div>

      <h3>1 · Script <span class="tier tier--blue">Recommended</span></h3>
      <p>Paste once, anywhere in your page. It renders in a shadow root so it cannot clash with your site's styles, always shows your current tier, and removes itself if your listing ends.</p>
      <div class="codebox"><button type="button" class="btn btn-s copy" data-copy="#bb-code-script">Copy</button><pre id="bb-code-script"></pre></div>

      <h3>2 · Plain HTML</h3>
      <p>For website builders that block scripts. An image that links to your profile. It does not update itself, so we re-check these by hand and ask you to change it if your tier changes.</p>
      <div class="codebox"><button type="button" class="btn btn-s copy" data-copy="#bb-code-html">Copy</button><pre id="bb-code-html"></pre></div>

      <h3>3 · Email signature</h3>
      <p>A PNG version that Outlook, Gmail and Apple Mail all display.</p>
      <div class="codebox"><button type="button" class="btn btn-s copy" data-copy="#bb-code-email">Copy</button><pre id="bb-code-email"></pre></div>

      <h3>4 · Plain link</h3>
      <p>For social bios, quotes and invoices.</p>
      <div class="codebox"><button type="button" class="btn btn-s copy" data-copy="#bb-code-link">Copy</button><pre id="bb-code-link"></pre></div>

      <div class="note" style="margin-top:1.6rem"><strong>Applying now and have no listing ID yet?</strong> Use <code>&lt;script src=&quot;https://getclient.co.za/badge.js&quot; async&gt;&lt;/script&gt;</code>. It recognises your website by its address and starts showing your listing the moment you are approved.<br><br><strong>Already have a badge on your site?</strong> Nothing to change. Every badge code we have ever issued keeps working and now shows the new design automatically.</div>
    </div>
  </div>
</div></section>

<section class="sec sec--surf"><div class="wrap"><h2 style="margin-bottom:1.6rem">Rules for using the badge</h2>${cards([
  ['Every listing shows it', 'Displaying the Listed on Getclient badge is a condition of being listed, on Basic, Blue and Gold. We check your website for it before approval and from time to time after. Put it in your footer so it appears on every page.'],
  ['It links to your record', 'The badge must link to your Getclient profile so a visitor can check the claim. Badges that link elsewhere breach the terms.'],
  ['It stays honest', 'Display only the tier you currently hold. The script enforces this automatically; if you use the plain HTML version, update it when your tier changes.'],
  ['The link is nofollow', 'Every badge link carries rel="nofollow" on purpose. Site-wide widget links that pass ranking signals count as a link scheme under Google’s guidelines. The value is the trust signal to people, not a backlink.'],
  ['Do not recolour it', 'The seal colour is the tier. Restyling a Blue badge gold, or building a lookalike, is misrepresentation and ends the listing.'],
  ['Assets', 'Badges as <a href="/assets/badge/listed-light.svg">SVG</a> and <a href="/assets/badge/listed-light.png">PNG</a>; seals as <a href="/assets/seal-gold.svg">gold</a> and <a href="/assets/seal-blue.svg">blue</a> SVG. The word Getclient must appear alongside a seal.']], 'g3')}</div></section>`;
  return page({ title: 'Get your Listed on Getclient website badge', path: '/badge/', body, desc: 'Get the Listed on Getclient badge for your website and email signature. Script, plain HTML and email versions. Required for every listed business.' }, it);
}

/* ================================================================ verification */
export function verification(sample) {
  const it = [['Home', '/'], ['Verification']];
  const rows = [['Identity', 'The person signing up is who they say they are.', 'SA ID or passport matched to the contact person on the listing.', 'Blue, Gold'],
    ['CIPC registration', 'The company exists and is in good standing.', 'Registration number checked against the CIPC register, status and directors confirmed.', 'Blue, Gold'],
    ['Insurance', 'There is cover if something goes wrong on your job.', 'Current public liability or professional indemnity certificate, with the insurer and expiry recorded.', 'Gold'],
    ['Trading history', 'The business is not brand new under an old name.', 'Three or more years of continuous trading evidenced by registration date and financial or client records.', 'Gold'],
    ['Client reviews', 'Other people have used them and said so.', 'At least five published reviews, each traced to a quote request logged on Getclient.', 'Gold']];
  const body = `${ph(it, 'Verification', 'What the badge means, precisely', 'A badge that means "we like them" is worthless. A badge that means "these five things were checked on this date" can be argued with, corrected and relied on. This is the second kind.')}
<section class="sec"><div class="wrap">
  <div class="grid g2" style="align-items:start;gap:2rem">
    <div>${ledger({ check_identity: 1, check_cipc: 1, check_insurance: 1, check_trading_history: 1, check_reviews: 1 })}<p class="hint" style="margin-top:.6rem">A Gold Verified record, as it appears on a profile.</p></div>
    <div class="grid" style="gap:1rem">
      <div class="card"><h3 style="display:flex;gap:.5rem;align-items:center">${seal('blue', 'seal--md')} Blue Verified</h3><p>Identity confirmed and CIPC registration verified. It tells you the business is real, registered and answerable to a named person. It says nothing about the quality of their work.</p></div>
      <div class="card"><h3 style="display:flex;gap:.5rem;align-items:center">${seal('gold', 'seal--md')} Gold Verified</h3><p>Everything in Blue, plus current insurance, three or more years trading and a published review history. Gold listings automatically receive sponsored placement on the homepage, their category page and their city page. Every placement is labelled "Ad".</p></div>
      <div class="card"><h3 style="display:flex;gap:.5rem;align-items:center"><img src="/assets/brand/mark.svg" alt="" width="24" height="24"> Listed</h3><p>A person has read the listing and approved it. No documents have been checked. The profile marks every check "not checked" so nobody mistakes it for more.</p></div>
    </div>
  </div>
  <div class="tablewrap" style="margin-top:2.4rem"><table class="table table--stack"><thead><tr><th>Check</th><th>What it answers</th><th>How it is done</th><th>Required for</th></tr></thead>
  <tbody>${rows.map(r => `<tr><td data-l="Check"><strong>${r[0]}</strong></td><td data-l="What it answers">${r[1]}</td><td data-l="How it is done">${r[2]}</td><td data-l="Required for">${r[3]}</td></tr>`).join('')}</tbody></table></div>
  <div class="note" style="margin-top:1.6rem"><strong>Re-verification:</strong> every check expires after 12 months. Lapsed checks revert the listing to Basic and the website badge changes to Listed on Getclient within 24 hours.</div>
  <div class="note note--w" style="margin-top:.8rem"><strong>Report a listing:</strong> if a business is trading on a badge it should not hold, email <a href="mailto:${SITE.email}">${SITE.email}</a> with the profile link. We investigate every report and publish the outcome to the reporter.</div>
</div></section>`;
  return page({ title: 'How we verify businesses', path: '/verification/', body, desc: 'The five checks behind a Getclient badge: identity, CIPC registration, insurance, trading history and client reviews.' }, it);
}

/* ================================================================ how it works */
export function howItWorks() {
  const it = [['Home', '/'], ['How it works']];
  const body = `${ph(it, 'How it works', 'Four steps, and one thing we refuse to do', 'The refusal first: we do not show you a business we have not looked at. That makes Getclient smaller than the directories that scrape listings, and it is the entire point.')}
<section class="sec"><div class="wrap"><div class="steps">
  <div class="step"><h3>Search or browse</h3><p>Start from a category, a city, or the search box. Category and city pages load fast and are indexed by search engines the same way a client would find them.</p></div>
  <div class="step"><h3>Read the verification record</h3><p>Every profile carries a five-item ledger: identity, CIPC registration, insurance, trading history and client ratings. Each item says checked or not checked. Nothing is implied.</p></div>
  <div class="step"><h3>Request a quote</h3><p>Send a structured brief. It goes to the business and it is logged. If they never reply, that shows up in their published response rate.</p></div>
  <div class="step"><h3>Rate the work</h3><p>After the job, give the business a rating out of five. Stars only, one rating per person per business.</p></div>
</div></div></section>
<section class="sec sec--surf"><div class="wrap"><h2 style="margin-bottom:1.6rem">Questions</h2>${cards([
  ['Is Getclient free for people looking to hire?', 'Yes. There is no charge and no account needed to search, browse or request a quote.'],
  ['How do you make money?', 'Businesses pay a monthly subscription for verification and placement. We take no commission on any job.'],
  ['What does "verified" actually mean here?', 'It means specific checks were run and passed on a specific date, and each one is listed on the profile. It is not a quality rating.'],
  ['What is the Listed on Getclient badge?', 'Every listed business shows it on its own website. Click it on any site and you land on that business’s record here, so you can see exactly what was checked.'],
  ['Can a business pay to remove a bad rating?', 'No. Ratings are stars only and cannot be removed by the business.'],
  ['Do you cover the whole of South Africa?', 'All nine provinces. Coverage is deepest in the metros and thinner in smaller towns, and the page counts show you exactly how thin.']])}</div></section>`;
  return page({ title: 'How it works', path: '/how-it-works/', body, desc: 'Search, read the verification record, request a quote, rate the work. How Getclient works for people hiring in South Africa.' }, it);
}

/* ================================================================ about / contact */
export function about() {
  const it = [['Home', '/'], ['About']];
  const body = `${ph(it, 'About', 'Why another directory', 'Because the existing ones will list anyone who fills in a form, and then sell that anyone a badge that means nothing.')}
<section class="sec"><div class="wrap prose">
  <p>Getclient is run by ${SITE.company}, a South African business services company that has spent years registering companies through CIPC and building websites for small businesses. We kept watching good operators lose work to whoever paid for the top slot, and clients get burned by businesses that were never checked at all.</p>
  <p>So the rule here is simple: a badge represents a completed check, on a stated date, listed publicly on the profile. If we have not checked something, the profile says "not checked". That is unusual enough to be worth saying out loud.</p>
  <h2>Built here, for here</h2>
  <p>Getclient is South African through and through: built in Kuils River, Cape Town, listing only businesses that trade in South Africa, and checked against South African records like the CIPC register. Every badge on a business's website points back to that record, so local businesses can prove they are the real thing.</p>
  <h2>How we stay honest</h2>
  <ul>
    <li>Sponsored placements are labelled "Ad" every single time. Paying more never removes the label.</li>
    <li>Search ranking is verification tier, then rating, then response rate. Money moves you into the labelled sponsored slot, not up the organic list.</li>
    <li>Directory counts on this site are read from the database. If a category is empty, it says zero.</li>
    <li>Ratings are stars only, one per person, and the business cannot remove them.</li>
  </ul>
  <h2>Contact</h2>
  <p>${SITE.company}<br>Kuils River, Cape Town, Western Cape<br><a href="mailto:${SITE.email}">${SITE.email}</a> · <a href="tel:+27218793035">021 879 3035</a></p>
</div></section>`;
  return page({ title: 'About Getclient', path: '/about/', body, desc: 'Why Getclient exists: a South African business directory where every badge represents a completed, dated check.' }, it);
}

export function contact() {
  const it = [['Home', '/'], ['Contact']];
  const body = `${ph(it, 'Contact', 'Talk to a person', 'There are three reasons people write in. Pick the closest one so it reaches the right desk.')}
<section class="sec"><div class="wrap">
  <div class="grid g3">
    <div class="card"><span class="ico"><i class="fa-solid fa-store"></i></span><h3>Listing a business</h3><p>Questions about submitting, verification, the badge or upgrading.</p><p style="margin-top:.8rem"><a href="mailto:${SITE.email}" style="font-weight:600">${SITE.email}</a></p></div>
    <div class="card"><span class="ico"><i class="fa-solid fa-flag"></i></span><h3>Reporting a listing</h3><p>A badge that looks wrong, or a business that is no longer trading.</p><p style="margin-top:.8rem"><a href="mailto:${SITE.email}" style="font-weight:600">${SITE.email}</a></p></div>
    <div class="card"><span class="ico"><i class="fa-solid fa-phone"></i></span><h3>Everything else</h3><p>Press, partnerships, advertising, or a problem with the site.</p><p style="margin-top:.8rem"><a href="tel:+27218793035" style="font-weight:600">021 879 3035</a> · <a href="${SITE.whatsapp}" target="_blank" rel="noopener" style="font-weight:600">WhatsApp</a></p></div>
  </div>
  <div class="note" style="margin-top:1.6rem">Weekdays 08:00–17:00 SAST. Listing reviews take one to two business days.</div>
  <p class="mut" style="margin-top:1.4rem">${SITE.company}<br>${SITE.address}</p>
</div></section>`;
  return page({ title: 'Contact Getclient', path: '/contact/', body, desc: 'Contact Getclient about listing a business, reporting a listing, or anything else. Cape Town and Pretoria.' }, it);
}

/* ================================================================ legal */
const legal = (path, title, lede, updated, sections) => {
  const it = [['Home', '/'], [title]];
  const body = `${ph(it, 'Legal', title, lede)}<section class="sec"><div class="wrap prose"><p class="hint">Last updated ${updated}.</p>${sections.map(([h, p]) => `<h2>${h}</h2><p>${p}</p>`).join('')}</div></section>`;
  return page({ title, path, body, desc: lede }, it);
};
export const privacy = () => legal('/privacy/', 'Privacy Policy & POPIA notice', 'How Getclient collects, uses and protects personal information under the Protection of Personal Information Act.', '2026-08-13', [
  ['Responsible party', `${SITE.company} is the responsible party for personal information processed through getclient.co.za. Information officer: ${SITE.email}.`],
  ['What we collect', 'From businesses: company details, contact details, the contact person’s name and role, CIPC registration number, and verification evidence such as identity documents and insurance certificates. From people hiring: the name, email, phone number and job details you enter into a quote request. From everyone: standard server logs and aggregate analytics.'],
  ['Why we process it', 'To operate the directory, to run verification checks, to pass quote requests to the business you selected, to prevent fraudulent listings, and to meet legal obligations. Verification evidence is processed on the basis of your consent, given when you submit.'],
  ['Who we share it with', 'Quote request details go to the business you chose. Payment details go to Paystack and are never stored by us. CIPC numbers are checked against the public CIPC register. We do not sell personal information.'],
  ['Verification documents', 'Blue and Gold applicants upload a CIPC document and an ID or passport, and for Gold a SARS tax clearance and insurance certificate. These are stored in a private, non-public store, opened only by a reviewer through a link that expires in ten minutes, and deleted within 90 days of the check being recorded. Your profile shows only that a check passed and on what date, never the document, the ID number or the certificate.'],
  ['Retention', 'Approved listings are kept while active and for 12 months after removal. Rejected submissions are deleted after 90 days. Quote requests are kept for 24 months to calculate response rates.'],
  ['Your rights', 'Under POPIA you may request access to your personal information, correct it, object to processing, or ask for deletion. Email the information officer and we will respond within 30 days. You may also complain to the Information Regulator of South Africa.'],
  ['Cookies', 'The site uses a session storage key to keep admin users signed in, and no advertising cookies. Analytics, where used, is configured without cross-site tracking.'],
  ['Badge script', 'The embeddable badge requests your listing status from getclient.co.za when it loads on a third-party site. This records the referring domain so we can confirm the badge is being used correctly. It sets no cookies and does not track individual visitors.']]);

export const terms = () => legal('/terms/', 'Terms of Service', `These terms govern use of getclient.co.za, operated by ${SITE.company}.`, new Date().toISOString().slice(0, 10), [
  ['1. Who we are', `Getclient is a directory service operated by ${SITE.company}, registered in South Africa and contactable at ${SITE.email}.`],
  ['2. What Getclient is not', 'Getclient introduces you to businesses. We are not a party to any agreement you reach with them, we do not supply their services, and we do not guarantee the outcome of any job. A verification badge confirms that specific checks passed on a stated date. It is not a warranty of workmanship.'],
  ['3. Listing rules', 'You may only submit a listing for a business you are authorised to represent. Information must be accurate and kept current. Listings that misstate registration, insurance or trading history are removed without refund.'],
  ['4. Badges', 'Every listed business must operate a website and display the Listed on Getclient badge on it, linking to Getclient, for as long as it is listed. Applications are approved only once the badge is found, and removing it may end the listing. Verification badges and the embeddable website badge remain our property and are licensed to you for as long as your listing is active, at the tier it holds. You may display the badge on properties you own, linking to your Getclient profile. You may not alter its colours, text or link, or display a tier you do not hold. The licence ends when your listing ends.'],
  ['5. Fees', 'Blue Verified (R499) and Gold Verified (R1,299) are billed once a year in advance in ZAR through Paystack. A tier that is not renewed reverts to Basic at the end of the paid year. Verification fees cover the work of checking; where a check cannot be completed for reasons on our side, the fee is refunded.'],
  ['6. Reviews and content', 'You keep ownership of what you post and grant us a licence to display it. We may remove content that is abusive, unlawful, off-topic or not traceable to a real transaction. We do not remove reviews because a business asks us to.'],
  ['7. Suspension', 'We may suspend or remove a listing that breaches these terms, misuses the badge, or is the subject of a substantiated complaint. Where practical we give notice and a chance to fix it.'],
  ['8. Liability', 'To the extent permitted by South African law, our liability arising from use of the directory is limited to the fees you paid us in the three months before the claim. Nothing here limits liability that cannot lawfully be limited, including under the Consumer Protection Act.'],
  ['9. Governing law', 'These terms are governed by the laws of the Republic of South Africa, and the Western Cape courts have jurisdiction.']]);

/* ================================================================ admin, 404, offline */
export function admin() {
  const tab = (s, label, icon, on) => `<button class="atab${on ? ' on' : ''}" data-status="${s}"><i class="fa-solid ${icon}"></i> ${label} <b data-count="${s}">–</b></button>`;
  const body = `<section class="sec" style="padding-top:2.4rem"><div class="wrap" id="gc-admin">
  <div id="gc-login"><div class="card" style="max-width:440px;margin-inline:auto;padding:2rem">
    <img src="/assets/brand/mark.svg" alt="" width="44" height="44" style="margin-bottom:1rem">
    <h1 style="font-size:1.5rem;margin-bottom:.3rem">Reviewer sign-in</h1><p class="mut" style="font-size:.9rem">Manage Getclient applications.</p>
    <form class="form" id="gc-login-form" style="margin-top:1.2rem">
      <div class="f"><label for="gc-email">Email</label><input id="gc-email" type="email" required autocomplete="username"></div>
      <div class="f"><label for="gc-password">Password</label><input id="gc-password" type="password" required autocomplete="current-password"></div>
      <button class="btn btn-p btn-blk" type="submit">Sign in</button><p id="gc-login-msg" style="font-size:.85rem;margin:0"></p></form>
    <div id="gc-pk-login-box" hidden><div class="or"><span>or</span></div>
      <button class="btn btn-g btn-blk" type="button" id="gc-pk-login"><i class="fa-solid fa-fingerprint"></i> Sign in with fingerprint or face</button></div>
    <p class="hint" style="margin:1.2rem 0 0;text-align:center" id="gc-install-hint"><i class="fa-solid fa-mobile-screen"></i> Install this as an app: on Android or Chrome use <b>Install</b>; on iPhone tap <b>Share</b> then <b>Add to Home Screen</b>.</p>
  </div></div>

  <div id="gc-admin-main" hidden>
    <div class="head" style="margin-bottom:1.2rem"><div><p class="eyebrow">Reviewer panel</p><h1 style="font-size:1.8rem;margin:0">Applications</h1></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap"><input id="gc-admin-q" class="ainput" type="search" placeholder="Search name, ID, email"><button class="btn btn-g btn-s" id="gc-admin-refresh"><i class="fa-solid fa-rotate"></i> Refresh</button><button class="btn btn-g btn-s" id="gc-pk-setup" hidden><i class="fa-solid fa-fingerprint"></i> Fingerprint / face</button><button class="btn btn-g btn-s" id="gc-admin-out">Sign out</button></div></div>
    <div class="note note--ok" id="gc-pk-offer" hidden style="margin-bottom:1rem;display:flex;gap:.8rem;align-items:center;flex-wrap:wrap">
      <i class="fa-solid fa-fingerprint" style="font-size:1.4rem"></i><span style="flex:1;min-width:200px"><b>Sign in with your fingerprint or face next time.</b> Turn it on for this device; your password still works.</span>
      <button class="btn btn-p btn-s" type="button" id="gc-pk-on">Turn on</button><button class="btn btn-g btn-s" type="button" id="gc-pk-later">Not now</button></div>
    <p class="msg" id="gc-pk-msg" role="status"></p>
    <div class="atabs" role="tablist">
      ${tab('pending', 'Pending', 'fa-hourglass-half', true)}${tab('approved', 'Approved', 'fa-circle-check')}${tab('rejected', 'Rejected', 'fa-circle-xmark')}${tab('suspended', 'Suspended', 'fa-ban')}${tab('quotes', 'Quote requests', 'fa-paper-plane')}${tab('jobs', 'Jobs', 'fa-briefcase')}
    </div>
    <div class="note" id="gc-admin-help" style="margin:1rem 0 1.4rem;font-size:.86rem">
      <b>Pending</b>: check the badge, open the documents, then approve or reject. Approval is blocked until the Listed on Getclient badge is found on the business's website.
      <b>Rejected</b> applications get an email explaining the issue, how to fix it and where to continue. <b>Approved</b> listings get a welcome-to-the-directory email. Each application moves to its section as soon as you act on it.</div>
    <div id="gc-queue"></div>
  </div>
</div></section>`;
  return layout({ title: 'Reviewer panel', path: '/admin/', body, noindex: true, promo: false, admin: true, desc: 'Getclient reviewer panel.' });
}

export function notFound() {
  const body = `<section class="hero" style="min-height:60vh;display:flex;align-items:center"><div class="hero__y">${ySvg('', 'rgba(22,82,240,.28)', 'rgba(143,176,255,.35)')}</div>
  <div class="wrap" style="text-align:center"><p class="eyebrow" style="color:#8FB0FF">404</p><h1>Eish. That page isn't here.</h1>
  <p class="lede" style="margin-inline:auto">The link may be old, or the listing may have been removed. Search the directory instead.</p>
  <p style="margin-top:1.6rem;display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap"><a class="btn btn-w" href="/search/">Search the directory</a><a class="btn btn-o" href="/">Home</a></p></div></section>`;
  return layout({ title: 'Page not found', path: '/404.html', body, noindex: true, desc: 'That page is not on Getclient.' });
}

export const offline = () => `<!DOCTYPE html><html lang="en-ZA"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline | Getclient</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Poppins,system-ui,sans-serif;background:#071A47;color:#C9D6F8;text-align:center;padding:24px}h1{color:#fff;font-size:1.6rem}a{color:#fff}</style></head>
<body><div><img src="/logo.png" alt="Getclient" width="72" height="72"><h1>You're offline</h1><p>Load-shedding or no signal? Pages you've opened before still work. Try again when you're back online.</p><p><a href="/">Retry</a></p></div></body></html>`;
