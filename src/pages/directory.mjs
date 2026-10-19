import {
  esc, layout, starButtons, initials, mark, tierChipFor, card, feat, listingGrid, crumbs, crumbLD, seal, rating, tierChip, ySvg, flagSvg, avatar,
  loc, cityName, provName, SITE, CATS, CITIES, catBy, cityBy, provBy, isGold, isBlue, isPaid, coverOf, blueChip, promoGold
} from '../lib.mjs';
import { PROVINCES, GREETINGS, CHECKS } from '../data/site.mjs';

const catOptions = (sel = '') => `<option value="">Any category</option>` + CATS.map(c => `<option value="${c.slug}"${c.slug === sel ? ' selected' : ''}>${esc(c.short)}</option>`).join('');
const cityOptions = (sel = '', any = 'Anywhere in SA') => `<option value="">${any}</option>` + CITIES.map(c => `<option value="${c.slug}"${c.slug === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

export function searchForm({ cls = '', id = '', tier = false, q = '' } = {}) {
  return `<form class="search ${cls}" action="/search/" method="get" role="search"${id ? ` id="${id}"` : ''}>
  <div class="fld"><i class="fa-solid fa-magnifying-glass"></i><label class="sr-only" for="${id || 'h'}q">What do you need</label><input id="${id || 'h'}q" name="q" type="search" placeholder="Plumber, attorney, web designer…" value="${esc(q)}"></div>
  <div class="fld"><i class="fa-solid fa-layer-group"></i><label class="sr-only" for="${id || 'h'}c">Category</label><select id="${id || 'h'}c" name="cat">${catOptions()}</select></div>
  <div class="fld"><i class="fa-solid fa-location-dot"></i><label class="sr-only" for="${id || 'h'}l">Location</label><select id="${id || 'h'}l" name="loc">${cityOptions()}</select></div>
  ${tier ? `<div class="fld"><i class="fa-solid fa-certificate"></i><label class="sr-only" for="${id}t">Verification</label><select id="${id}t" name="tier"><option value="">Any tier</option><option value="gold">Gold Verified</option><option value="blue">Blue Verified</option></select></div>` : ''}
  <button class="btn btn-p" type="submit"><i class="fa-solid fa-magnifying-glass"></i> Search</button></form>`;
}

export function ledger(b) {
  return `<div class="ledger">` + CHECKS.map(([k, l]) => {
    const on = !!b[k];
    return `<div class="ledger__i"><span class="ledger__l">${l}</span><span class="ledger__s ledger__s--${on ? 'on' : 'off'}"><span class="ledger__d"></span>${on ? 'Checked' : 'Not checked'}</span></div>`;
  }).join('') + `</div>`;
}

const counts = rows => {
  const cat = {}, city = {}, prov = {}, pair = {};
  rows.forEach(b => { cat[b.category] = (cat[b.category] || 0) + 1; city[b.city] = (city[b.city] || 0) + 1; prov[b.province] = (prov[b.province] || 0) + 1; pair[b.category + '|' + b.city] = (pair[b.category + '|' + b.city] || 0) + 1; });
  return { cat, city, prov, pair };
};
// Gold first (sponsored, labelled Ad), then the Blue Verified showcase, in every list section.
const featBlock = (rows, label, cfg) => {
  const gold = rows.filter(isGold), blue = rows.filter(isBlue);
  if (!gold.length && !blue.length) return '';
  return `<section class="sec sec--tight sec--surf"><div class="wrap">
  ${gold.length ? `<div class="head"><div><p class="eyebrow">Sponsored · ${label}</p></div><span class="adnote">Gold Verified businesses · always labelled Ad</span></div>
  <div class="feats">${gold.map(x => feat(x, cfg)).join('')}</div>` : ''}
  ${blue.length ? `<div class="bluerow"${gold.length ? '' : ' style="margin-top:0;border-top:0;padding-top:0"'}><p class="eyebrow" style="margin-bottom:.8rem">${seal('blue', 'seal--sm')} Blue Verified</p>
  <div class="bchips">${blue.map(blueChip).join('')}</div></div>` : ''}</div></section>`;
};

/* ================================================================ home */
export function home(ctx) {
  const { rows, cfg } = ctx;
  const n = counts(rows);
  const gold = rows.filter(b => b.tier === 'gold').length, blue = rows.filter(b => b.tier === 'blue').length;
  const nprov = Object.keys(n.prov).filter(Boolean).length;
  const show = rows.find(b => b.id === 'gc-000001') || rows.find(b => b.tier === 'gold') || rows[0];
  const hello = GREETINGS.map(([w, l]) => `<span>${w} <small>${l}</small></span>`).join('');
  const top = rows.slice(0, 9);

  const body = `
<section class="hero">
  <div class="hero__y">${ySvg('', 'rgba(22,82,240,.28)', 'rgba(143,176,255,.35)')}</div>
  <div class="wrap hero__g">
    <div>
      <span class="pill">${flagSvg()} Proudly local · Mzansi's verified business directory</span>
      <h1>Hire local.<br>Hire <em>checked</em>.</h1>
      <p class="lede">Getclient lists South African businesses that have passed identity and CIPC checks. Every profile shows exactly which checks it passed and when, so a badge here means something you can point at.</p>
      ${searchForm()}
      <div class="quick"><span>Popular:</span>${['contractors-and-trades', 'digital-and-tech', 'healthcare-and-medical', 'business-services'].map(s => `<a href="/c/${s}/">${esc(catBy[s].short)}</a>`).join('')}<a href="/l/cape-town/">Cape Town</a><a href="/l/johannesburg/">Johannesburg</a></div>
    </div>
    ${show ? `<div class="hero__card">
      <div class="hero__float"><i class="fa-solid fa-shield-halved"></i><span><b>5 checks</b>on every Gold profile</span></div>
      <div class="rec">
        <div class="rec__h">${avatar(show).replace('class="avatar', 'class="avatar rec__av')}
          <div><b>${esc(show.name)} ${mark(show, 'seal--md')}</b><span>${esc(show.subcategory || '')} · ${esc(cityName(show))}</span></div></div>
        <p class="rec__k">What a listing tells you</p>
        ${ledger(show)}
        <p class="rec__f">Checks expire after 12 months and are re-run. A lapsed check drops the badge automatically, here and on their own website.</p>
      </div>
      <div class="hero__badge"><img src="/assets/badge/${show.official ? 'official' : show.tier === 'none' ? 'listed' : show.tier}-light.svg" alt="Listed on Getclient badge" width="220"></div>
    </div>` : ''}
  </div>
</section>
<div class="hello" aria-label="Hello in South Africa's languages"><div class="hello__track">${hello}${hello}</div></div>

<section class="sec sec--tight"><div class="wrap">
  <div class="stats rv">
    <div class="stat"><b data-gc-total>${rows.length}</b><span>businesses listed and checked by a person</span></div>
    <div class="stat"><b data-gc-provinces>${nprov}</b><span>provinces represented so far</span></div>
    <div class="stat stat--g"><b data-gc-gold>${gold}</b><span>Gold Verified, the full five checks</span></div>
    <div class="stat stat--b"><b data-gc-blue>${blue}</b><span>Blue Verified, identity and CIPC</span></div>
  </div>
  <p class="mut" style="font-size:.8rem;margin:.8rem 0 0" data-gc-stats>Figures are read live from the directory database, so they are always the real count.</p>
</div></section>

${featBlock(rows, 'Featured Gold businesses', cfg)}

<section class="sec"><div class="wrap">
  <div class="head"><div><p class="eyebrow">The directory today</p><h2 data-gc-headline>${rows.length} businesses, every one checked</h2></div>
  <a class="btn btn-g" href="/search/">See all businesses <i class="fa-solid fa-arrow-right"></i></a></div>
  ${listingGrid(top, cfg, ['The first listings are being reviewed', 'Businesses are checked before they appear, so the directory fills slowly and honestly.'])}
</div></section>

<section class="sec sec--surf"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Browse</p><h2>Find it by category</h2><p class="lede">Twelve categories, from the plumber down the road to the attorney handling your transfer.</p></div>
  <a class="btn btn-g" href="/categories/">All categories</a></div>
  <div class="grid g4">${CATS.map(c => `<a class="card cat" href="/c/${c.slug}/"><span class="ico"><i class="fa-solid ${c.icon}"></i></span><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><span class="cat__n"><span><b data-gc-n-cat="${c.slug}">${n.cat[c.slug] || 0}</b> listed</span><i class="fa-solid fa-arrow-right"></i></span></a>`).join('')}</div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="head"><div><p class="eyebrow">From Musina to Cape Agulhas</p><h2>Nine provinces, one directory</h2><p class="lede">Organised by town first, because that is how people actually hire.</p></div>
  <a class="btn btn-g" href="/locations/">All locations</a></div>
  <div class="provs">${PROVINCES.map(p => `<a class="prov" href="/p/${p.slug}/"><h3>${p.name} <b data-gc-n-prov="${p.slug}">${n.prov[p.slug] || 0}</b></h3><p>${p.line}</p><div class="towns">${CITIES.filter(c => c.province === p.slug).map(c => `<span>${c.name}</span>`).join('')}</div></a>`).join('')}</div>
</div></section>

<section class="sec" style="padding-top:0"><div class="wrap">
  <div class="local">${ySvg('y', 'rgba(255,255,255,.5)', 'rgba(255,255,255,.7)')}
    <div class="local__g">
      <div><p class="eyebrow" style="color:#fff">Local is lekker</p><h2>Every rand you spend locally builds Mzansi</h2>
      <p class="lede">Getclient only lists businesses trading in South Africa. Hiring through the directory keeps work, wages and skills in our own communities, and every badge proves the business is real.</p>
      <a class="btn btn-w" href="/list/" style="margin-top:.6rem">List your business, it's free</a></div>
      <div class="local__pts">
        <div class="local__pt"><i class="fa-solid fa-building-columns"></i><div><b>Registered here</b><span>Blue and Gold businesses are checked against the CIPC register.</span></div></div>
        <div class="local__pt"><i class="fa-solid fa-people-group"></i><div><b>Owner-run, small and growing</b><span>Most listings are SMMEs, the businesses that employ most South Africans.</span></div></div>
        <div class="local__pt"><i class="fa-solid fa-map-location-dot"></i><div><b>All nine provinces</b><span>Metros first, with towns added as businesses list.</span></div></div>
      </div>
    </div>
  </div>
</div></section>

<section class="sec sec--surf"><div class="wrap show">
  <div>
    <p class="eyebrow">Listed on Getclient</p>
    <h2>Every listing carries the badge</h2>
    <p class="lede">Each business on Getclient puts the <b>Listed on Getclient</b> badge on its own website. A visitor clicks it and lands on that business's checked record here, so the trust travels with them.</p>
    <ul class="ticks">
      <li><span><b>Required on every tier.</b> No listing is approved until the badge is on the business's website. Basic shows "Listed on Getclient"; Blue and Gold show their tier.</span></li>
      <li><span><b>It checks itself.</b> The badge reads its status live and disappears if a listing lapses.</span></li>
      <li><span><b>One line of code.</b> Paste it once; it works on WordPress, Wix, Shopify and hand-built sites.</span></li>
    </ul>
    <a class="btn btn-p" href="/badge/">Get your badge code</a>
  </div>
  <div class="browser rv" aria-hidden="true">
    <div class="browser__bar"><i></i><i></i><i></i><span>yourbusiness.co.za</span></div>
    <div class="browser__body"><div class="ln" style="width:55%;height:16px;background:var(--line)"></div><div class="ln" style="width:90%"></div><div class="ln" style="width:80%"></div><div class="ln" style="width:65%"></div>
      <div class="stage__row" style="justify-content:flex-start;margin-top:1.2rem"><img src="/assets/badge/listed-light.svg" alt="" width="148"><img src="/assets/badge/blue-light.svg" alt=""></div></div>
    <div class="browser__foot"><span class="ln"></span><img src="/assets/badge/gold-dark.svg" alt=""></div>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="head center" style="justify-content:center"><div><p class="eyebrow">How it works</p><h2>Four steps. No mystery.</h2></div></div>
  <div class="steps">
    <div class="step"><h3>Search</h3><p>Filter by service, city and how thoroughly the business has been checked.</p></div>
    <div class="step"><h3>Read the record</h3><p>Each profile shows the five verification checks and the date they were run.</p></div>
    <div class="step"><h3>Request a quote</h3><p>Send one brief. We log whether they reply and publish the response rate.</p></div>
    <div class="step"><h3>Rate out of five</h3><p>One tap after the job. Stars only, no comments, one rating per person.</p></div>
  </div>
</div></section>

<section class="sec sec--surf"><div class="wrap">
  <div class="head"><div><p class="eyebrow">Our promises</p><h2>Six things we put in writing</h2></div></div>
  <div class="grid g3">
    ${[['fa-user-check', 'A person reads every listing', 'No scraped records, no auto-imports. Someone at Digitalx opens each submission and checks it before it appears.'],
       ['fa-certificate', 'The badge follows a completed check', 'Blue and Gold are set by a reviewer after the checks pass. An applicant cannot set their own tier, even through the API.'],
       ['fa-calendar-check', 'Every check is dated on the profile', 'You see identity, CIPC, insurance, trading history and ratings, each marked checked or not checked, with the date.'],
       ['fa-rectangle-ad', 'Ads are labelled as ads', 'Sponsored placements carry an Ad tag every single time. Paying more never removes the label or moves you up the organic list.'],
       ['fa-star', 'Ratings are stars only', 'Five stars, one per person per business, no comment box. Nobody can be defamed and nobody can buy a paragraph of praise.'],
       ['fa-database', 'Counts come from the database', 'The numbers on this page are read live. When a category is empty, it says zero.']]
      .map(([i, t, d], k) => `<div class="card"><span class="num">0${k + 1}</span><span class="ico"><i class="fa-solid ${i}"></i></span><h3>${t}</h3><p>${d}</p></div>`).join('')}
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="cta">${ySvg('y', 'rgba(22,82,240,.5)', 'rgba(143,176,255,.4)')}
    <div><h2>Your business, checked and found</h2><p>A basic listing is free. Pass verification and your badge links visitors from your website straight to your public record.</p></div>
    <div class="acts"><a class="btn btn-w" href="/list/">List your business</a><a class="btn btn-o" href="/pricing/">See pricing</a></div>
  </div>
</div></section>`;

  return layout({
    title: "Getclient | South Africa's verified business directory", path: '/', page: 'home', body,
    desc: 'Find South African businesses that passed identity and CIPC checks. Every profile shows which checks it passed and when. Free to list.',
    ld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Getclient', url: SITE.origin + '/', potentialAction: { '@type': 'SearchAction', target: SITE.origin + '/search/?q={q}', 'query-input': 'required name=q' } },
      { '@context': 'https://schema.org', '@type': 'Organization', name: 'Getclient', url: SITE.origin + '/', logo: SITE.origin + '/logo.png', parentOrganization: { '@type': 'Organization', name: SITE.company, url: 'https://www.digitalxagency.io' } }]
  });
}

/* ================================================================ categories */
export function categories(ctx) {
  const n = counts(ctx.rows);
  const it = [['Home', '/'], ['Categories']];
  const body = `<section class="ph">${ySvg('y', 'rgba(22,82,240,.07)', 'rgba(22,82,240,.12)')}<div class="wrap">${crumbs(it)}
  <p class="eyebrow">All categories</p><h1>What are you trying to get done?</h1>
  <p class="lede">Twelve categories, each with its own city pages. Pick the one closest to your job.</p></div></section>
  <section class="sec"><div class="wrap"><div class="grid g3">${CATS.map(c => `<a class="card cat" href="/c/${c.slug}/"><span class="ico"><i class="fa-solid ${c.icon}"></i></span><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><p style="margin-top:.7rem;font-size:.8rem;color:var(--mut2)">${esc(c.examples.join(' · '))}</p><span class="cat__n"><span><b data-gc-n-cat="${c.slug}">${n.cat[c.slug] || 0}</b> listed</span><i class="fa-solid fa-arrow-right"></i></span></a>`).join('')}</div></div></section>`;
  return layout({ title: 'All categories', path: '/categories/', body, desc: 'Browse checked South African businesses in twelve service categories, from contractors to legal, digital and finance.', ld: [crumbLD(it)] });
}

export function category(ctx, c, city) {
  const { rows, cfg } = ctx;
  const n = counts(rows);
  const list = rows.filter(b => b.category === c.slug && (!city || b.city === city.slug));
  const prov = city && provBy[city.province];
  const it = city ? [['Home', '/'], ['Categories', '/categories/'], [c.name, `/c/${c.slug}/`], [city.name]] : [['Home', '/'], ['Categories', '/categories/'], [c.name]];
  const path = city ? `/c/${c.slug}/${city.slug}/` : `/c/${c.slug}/`;
  const h1 = city ? `${c.name} in ${city.name}` : `${c.name} in South Africa`;
  const body = `<section class="ph">${ySvg('y', 'rgba(22,82,240,.07)', 'rgba(22,82,240,.12)')}<div class="wrap">${crumbs(it)}
  <div class="ph__row"><span class="ph__ico"><i class="fa-solid ${c.icon}"></i></span><div><p class="eyebrow" style="margin-bottom:.4rem">${esc(city ? prov.name : c.short)}</p><h1 style="margin:0">${esc(h1)}</h1></div></div>
  <p class="lede" style="margin-top:1rem">${esc(c.lede)}</p>
  <div class="chips" style="margin-top:1rem">${c.covers.map(s => `<a class="chip" href="/search/?q=${encodeURIComponent(s)}&amp;cat=${c.slug}">${esc(s)}</a>`).join('')}</div></div></section>
  <section class="sec"><div class="wrap">
    <div class="head"><h2 style="margin:0;font-size:1.3rem"><span data-gc-count>${list.length}</span> listed</h2>
    <a class="btn btn-g btn-s" href="/search/?cat=${c.slug}${city ? '&amp;loc=' + city.slug : ''}"><i class="fa-solid fa-sliders"></i> Filter and search</a></div>
    ${listingGrid(list, cfg, [`No ${c.short.toLowerCase()} listings${city ? ' in ' + city.name : ''} yet`, `Nothing here has cleared review yet. Local businesses can list free and appear here once approved.`])}
  </div></section>
  ${featBlock(list, 'Featured ' + c.short, cfg)}
  <section class="sec${list.some(isPaid) ? '' : ' sec--surf'}"><div class="wrap">
    <h2 style="font-size:1.4rem">${esc(c.short)} by city</h2><p class="lede" style="margin-bottom:1.4rem">Local pages, because a plumber in Polokwane is no use in Paarl.</p>
    <div class="linkgrid">${CITIES.map(ct => `<a href="/c/${c.slug}/${ct.slug}/"${city && ct.slug === city.slug ? ' aria-current="page" style="border-color:var(--blue)"' : ''}><span>${ct.name}</span><span class="c" data-gc-n-pair="${c.slug}|${ct.slug}">${n.pair[c.slug + '|' + ct.slug] || 0}</span></a>`).join('')}</div>
  </div></section>`;
  return layout({ title: city ? `${c.name} in ${city.name}` : `${c.name} in South Africa`, path, page: 'cat', cat: c.slug, city: city ? city.slug : '', body,
    desc: `${city ? c.name + ' in ' + city.name : c.name + ' across South Africa'}: businesses checked by a person, with their verification record on every profile. ${c.desc}`,
    ld: [crumbLD(it)] });
}

/* ================================================================ locations */
export function locations(ctx) {
  const n = counts(ctx.rows);
  const it = [['Home', '/'], ['Locations']];
  const body = `<section class="ph">${ySvg('y', 'rgba(22,82,240,.07)', 'rgba(22,82,240,.12)')}<div class="wrap">${crumbs(it)}
  <p class="eyebrow">All locations</p><h1>Nine provinces, every major centre</h1>
  <p class="lede">Getclient organises listings by city first, because that is how people actually hire. Each city has a page per category.</p></div></section>
  <section class="sec"><div class="wrap"><div class="provs">${PROVINCES.map(p => `<div class="prov"><h3><a href="/p/${p.slug}/">${p.name}</a> <b data-gc-n-prov="${p.slug}">${n.prov[p.slug] || 0}</b></h3><p>${p.line}</p>
    <div class="linkgrid" style="grid-template-columns:1fr">${CITIES.filter(c => c.province === p.slug).map(c => `<a href="/l/${c.slug}/"><span>${c.name}</span><span class="c" data-gc-n-city="${c.slug}">${n.city[c.slug] || 0}</span></a>`).join('')}</div></div>`).join('')}</div></div></section>`;
  return layout({ title: 'All locations', path: '/locations/', body, desc: 'Checked South African businesses in all nine provinces: Cape Town, Johannesburg, Pretoria, Durban, Gqeberha and more.', ld: [crumbLD(it)] });
}

export function province(ctx, p) {
  const { rows, cfg } = ctx;
  const n = counts(rows);
  const list = rows.filter(b => b.province === p.slug);
  const it = [['Home', '/'], ['Locations', '/locations/'], [p.name]];
  const body = `<section class="ph">${ySvg('y', 'rgba(22,82,240,.07)', 'rgba(22,82,240,.12)')}<div class="wrap">${crumbs(it)}
  <p class="eyebrow">Province</p><h1>Checked businesses in ${p.name}</h1><p class="lede">${p.line}. Everything Getclient has listed across ${p.name}, grouped by the towns we cover.</p>
  <div class="chips" style="margin-top:1rem">${CITIES.filter(c => c.province === p.slug).map(c => `<a class="chip" href="/l/${c.slug}/"><i class="fa-solid fa-location-dot"></i> ${c.name} <b data-gc-n-city="${c.slug}">${n.city[c.slug] || 0}</b></a>`).join('')}</div></div></section>
  <section class="sec"><div class="wrap">${listingGrid(list, cfg, [`No ${p.name} listings yet`, `Nothing in ${p.name} has cleared review yet. Local businesses can list free and appear here once approved.`])}</div></section>
  <section class="sec sec--surf"><div class="wrap"><h2 style="font-size:1.4rem;margin-bottom:1.2rem">Categories</h2>
  <div class="linkgrid">${CATS.map(c => `<a href="/c/${c.slug}/"><span>${esc(c.short)}</span><span class="c" data-gc-n-cat="${c.slug}">${n.cat[c.slug] || 0}</span></a>`).join('')}</div></div></section>`;
  return layout({ title: `Checked businesses in ${p.name}`, path: `/p/${p.slug}/`, page: 'prov', prov: p.slug, body, desc: `Businesses in ${p.name} checked by a person, each with its verification record on the profile.`, ld: [crumbLD(it)] });
}

export function city(ctx, c) {
  const { rows, cfg } = ctx;
  const n = counts(rows);
  const p = provBy[c.province];
  const list = rows.filter(b => b.city === c.slug);
  const it = [['Home', '/'], ['Locations', '/locations/'], [p.name, `/p/${p.slug}/`], [c.name]];
  const near = CITIES.filter(x => x.province === c.province && x.slug !== c.slug);
  const body = `<section class="ph">${ySvg('y', 'rgba(22,82,240,.07)', 'rgba(22,82,240,.12)')}<div class="wrap">${crumbs(it)}
  <p class="eyebrow">${p.name}</p><h1>Checked businesses in ${c.name}</h1><p class="lede">Businesses trading in and around ${c.name}, each with its verification record on the profile.</p>
  ${near.length ? `<div class="chips" style="margin-top:1rem"><span class="mut" style="font-size:.84rem;align-self:center">Nearby:</span>${near.map(x => `<a class="chip" href="/l/${x.slug}/">${x.name}</a>`).join('')}</div>` : ''}</div></section>
  <section class="sec"><div class="wrap">${listingGrid(list, cfg, [`No ${c.name} listings yet`, `Nothing in ${c.name} has cleared review yet. Local businesses can list free and appear here once approved.`])}</div></section>
  ${featBlock(list, 'Featured in ' + c.name, cfg)}
  <section class="sec sec--surf"><div class="wrap"><h2 style="font-size:1.4rem;margin-bottom:1.2rem">Categories in ${c.name}</h2>
  <div class="linkgrid">${CATS.map(k => `<a href="/c/${k.slug}/${c.slug}/"><span>${esc(k.short)}</span><span class="c" data-gc-n-pair="${k.slug}|${c.slug}">${n.pair[k.slug + '|' + c.slug] || 0}</span></a>`).join('')}</div></div></section>`;
  return layout({ title: `Checked businesses in ${c.name}`, path: `/l/${c.slug}/`, page: 'city', city: c.slug, body, desc: `Find businesses in ${c.name}, ${p.name} that were checked by a person. Verification record on every profile.`, ld: [crumbLD(it)] });
}

/* ================================================================ search */
export function search(ctx) {
  const it = [['Home', '/'], ['Search']];
  const gold = promoGold();
  const body = `<section class="ph">${ySvg('y', 'rgba(22,82,240,.07)', 'rgba(22,82,240,.12)')}<div class="wrap">${crumbs(it)}
  <h1>Search the directory</h1><p class="lede">Filter by service, city and verification tier. Results load live from the directory database.</p>
  ${searchForm({ cls: 'search--page', id: 'gc-search-form', tier: true })}</div></section>
  <section class="sec" style="padding-top:2rem"><div class="wrap">
  ${gold.length ? `<div class="srch-ads"><p class="eyebrow">Sponsored · Gold Verified</p><div class="feats">${gold.slice(0, 4).map(b => feat(b, ctx.cfg)).join('')}</div></div>` : ''}
  <p id="gc-count" class="mut" style="margin:0 0 1rem;font-size:.9rem"></p>
  <div id="gc-results" aria-live="polite"></div></div></section>`;
  return layout({ title: 'Search the directory', path: '/search/', body, noindex: true, desc: 'Search checked South African businesses by service, city and verification tier.' });
}

/* ================================================================ profile
 * What a profile shows depends on the tier:
 *   Gold   cover image, services, photos, quote form, WhatsApp, every phone line
 *   Blue   up to 8 services, photos, quote form, WhatsApp
 *   Basic  a description and contact details, and that is all                  */
export function quoteForm(b) {
  return `<div class="card" id="quote"><h3>Request a quote</h3><p style="font-size:.86rem">Sent straight to ${esc(b.name)} by email. We log whether they reply and publish the response rate.</p>
  <form class="form" id="gc-quote-form" data-email="${esc(b.email || SITE.email)}" style="margin-top:1rem">
    <input type="hidden" name="business_id" value="${esc(b.id)}">
    <div class="f"><label for="qn">Your name</label><input id="qn" name="name" required autocomplete="name"></div>
    <div class="f"><label for="qe">Email</label><input id="qe" name="email" type="email" required autocomplete="email"></div>
    <div class="f"><label for="qp">Phone</label><input id="qp" name="phone" inputmode="tel" autocomplete="tel"></div>
    <div class="f"><label for="qd">What do you need done?</label><textarea id="qd" name="details" required placeholder="Describe the job, the area and any deadline."></textarea></div>
    <div class="ts" data-gc-turnstile="quote_request"></div>
    <button class="btn btn-p btn-blk" type="submit">Send request</button><p id="gc-quote-status" class="msg"></p></form></div>`;
}

export const servicesHTML = services => !services || !services.length ? '' :
  `<div class="svcs">${services.map((s, i) => `<div class="svc"><span class="svc__n">${String(i + 1).padStart(2, '0')}</span><div><b>${esc(s.name)}</b>${s.description ? `<p>${esc(s.description)}</p>` : ''}${s.price_from ? `<span class="svc__p">${esc(s.price_from)}</span>` : ''}</div></div>`).join('')}</div>`;

const sponsoredAside = b => {
  const g = promoGold().filter(x => x.id !== b.id).slice(0, 2);
  return !g.length ? '' : `<div class="card adcard"><p class="eyebrow" style="margin-bottom:.6rem">Sponsored · Gold Verified</p>${g.map(x =>
    `<a class="adcard__i" href="/b/${esc(x.slug)}/">${avatar(x)}<span><b>${esc(x.name)} ${mark(x)}</b><small>${esc(x.tagline || x.subcategory || '')}</small></span></a>`).join('')}</div>`;
};

export function profile(ctx, b, badgeSizes) {
  const { cfg } = ctx;
  const gold = isGold(b), paid = isPaid(b);
  const c = catBy[b.category], ct = cityBy[b.city];
  const it = [['Home', '/'], ['Categories', '/categories/']];
  if (c) it.push([c.name, `/c/${c.slug}/`]);
  if (c && ct) it.push([ct.name, `/c/${c.slug}/${ct.slug}/`]);
  it.push([b.name]);
  const label = gold ? 'Gold Verified' : isBlue(b) ? 'Blue Verified' : 'listed';
  const url = `${SITE.origin}/b/${b.slug}/`;
  const shareText = `${b.name} is ${label} on Getclient`;
  const u = encodeURIComponent(url), t = encodeURIComponent(shareText);
  const year = new Date().getFullYear();
  const since = b.founded ? `${b.founded}${year - b.founded > 0 ? ` (${year - b.founded} year${year - b.founded === 1 ? '' : 's'})` : ''}` : '';
  const verified = b.verified_at ? String(b.verified_at).slice(0, 10) : '';
  const bimg = b.official ? 'official' : paid ? b.tier : 'listed';
  const bs = badgeSizes[`${bimg}-light`] || [148, 52];
  const tel = String(b.phone || '').replace(/[^+\d]/g, '');
  const wa = paid ? (b.whatsapp || (tel ? tel.replace(/^\+/, '').replace(/^0/, '27') : '')) : '';
  const phones = gold && b.phones ? b.phones : (b.phone ? [[tel, b.phone, '']] : []);
  const snippet = `<script src="https://getclient.co.za/badge.js" data-gc-id="${b.id}" async></script>`;
  const cover = coverOf(b, cfg);
  const photos = gold && b.photos ? b.photos : [];

  const hero = gold && cover
    ? `<section class="prof-h prof-h--gold">${ySvg('prof-h__cov', 'rgba(22,82,240,.5)', 'rgba(143,176,255,.4)')}<div class="wrap">${crumbs(it)}
  <div class="prof-gold">
    <div class="prof-gold__txt">
      <div class="chips" style="margin-bottom:.8rem">${tierChipFor(b)}<span class="tier tier--ad">Ad · Sponsored</span></div>
      <h1>${esc(b.name)}${mark(b, 'seal--lg')}</h1>
      ${b.tagline ? `<p class="lede" style="color:#DCE6FF;margin:.2rem 0 1rem">${esc(b.tagline)}</p>` : ''}
      <div class="prof-h__mt"><span><i class="fa-solid fa-briefcase"></i>${esc(b.subcategory || b.category_name || '')}</span><span><i class="fa-solid fa-location-dot"></i>${esc(loc(b))}</span>
      <span class="rate" data-gc-rating="${esc(b.id)}">${rating(b.avg_rating, b.rating_count)}</span></div>
      <div class="prof-h__acts" style="margin:1.4rem 0 0"><a class="btn btn-p" href="#quote"><i class="fa-solid fa-paper-plane"></i> Request a quote</a>${tel ? `<a class="btn btn-o" href="tel:${esc(tel)}"><i class="fa-solid fa-phone"></i> Call</a>` : ''}${wa ? `<a class="btn btn-o" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener nofollow"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}</div>
    </div>
    <div class="prof-gold__cov"><img src="${esc(cover)}" alt="${esc(b.name)}"${b.cover_fit === 'contain' ? ' class="fit-contain"' : ''}></div>
  </div></div></section>`
    : `<section class="prof-h">${cover ? `<div class="prof-h__cov"><img src="${esc(cover)}" alt=""></div>` : ySvg('prof-h__cov', 'rgba(22,82,240,.5)', 'rgba(143,176,255,.4)')}
<div class="wrap">${crumbs(it)}
  <div class="prof-h__g">${avatar(b)}
    <div><div class="chips" style="margin-bottom:.6rem">${tierChipFor(b)}${gold ? '<span class="tier tier--ad">Ad · Sponsored</span>' : ''}</div>
      <h1>${esc(b.name)}${mark(b, 'seal--lg')}</h1>
      <div class="prof-h__mt"><span><i class="fa-solid fa-briefcase"></i>${esc(b.subcategory || b.category_name || '')}</span><span><i class="fa-solid fa-location-dot"></i>${esc(loc(b))}</span>
      <span class="rate" data-gc-rating="${esc(b.id)}">${rating(b.avg_rating, b.rating_count)}</span></div></div>
    <div class="prof-h__acts">${paid ? `<a class="btn btn-p" href="#quote"><i class="fa-solid fa-paper-plane"></i> Request a quote</a>` : ''}${tel ? `<a class="btn ${paid ? 'btn-o' : 'btn-w'}" href="tel:${esc(tel)}"><i class="fa-solid fa-phone"></i> Call</a>` : ''}${!paid && b.email ? `<a class="btn btn-o" href="mailto:${esc(b.email)}"><i class="fa-solid fa-envelope"></i> Email</a>` : ''}${wa ? `<a class="btn btn-o" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener nofollow"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}</div>
  </div></div></section>`;

  const body = `${hero}
<section class="sec" style="padding-top:2.6rem"><div class="wrap"><div class="profile">
  <div>
    ${b.tagline && !(gold && cover) ? `<p class="lede" style="color:var(--head);font-weight:500;margin-bottom:1.4rem">${esc(b.tagline)}</p>` : ''}
    <h2>About</h2><p class="about">${esc(b.description || b.tagline || '')}</p>
    ${paid && (gold || (b.services && b.services.length)) ? `<h2>Services</h2><div data-gc-services="${esc(b.id)}">${servicesHTML(b.services) || '<p class="mut">Services are being added.</p>'}</div>` : ''}
    ${paid ? `<div id="gc-gallery" data-gc-gallery="${esc(b.id)}"${photos.length ? ' class="gallery"' : ''}>${photos.map(p => `<a class="gallery__i" href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="${esc(b.name)}" loading="lazy"${b.cover_fit === 'contain' ? ' class="fit-contain"' : ''}></a>`).join('')}</div>` : ''}
    <h2>Verification record</h2>${ledger(b)}
    <p class="mut" style="font-size:.84rem;margin-top:.8rem">${verified ? `Last verified ${verified}. ` : ''}Checks are re-run every 12 months. <a href="/verification/">What each check means</a>.</p>
    <h2>Rating</h2>
    <div class="rater" data-gc-rater="${esc(b.id)}">
      <div style="margin-bottom:.6rem"><span class="rate" data-gc-rating="${esc(b.id)}">${rating(b.avg_rating, b.rating_count)}</span></div>
      <p class="mut" style="font-size:.88rem;margin-bottom:.3rem">Worked with ${esc(b.name)}? Give them a rating out of five. Stars only, there is no comment box.</p>
      <div class="rater__btns" role="group" aria-label="Rate this business out of five">${starButtons()}</div>
      <p class="rater__msg" data-gc-rater-msg></p>
      <p style="font-size:.78rem;color:var(--mut2);margin:.4rem 0 0">One rating per person per business. Ratings are anonymous and cannot be removed by the business.</p>
    </div>
  </div>
  <aside>
    <div class="card"><h3>Contact</h3><table class="kv"><tbody>
      ${phones.map(([n, show, l]) => `<tr><td>Phone${l ? ` <small class="mut">${esc(l)}</small>` : ''}</td><td><a href="tel:${esc(n)}">${esc(show)}</a></td></tr>`).join('')}
      ${wa ? `<tr><td>WhatsApp</td><td><a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener nofollow">Message on WhatsApp</a></td></tr>` : ''}
      ${b.email ? `<tr><td>Email</td><td><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></td></tr>` : ''}
      ${b.website ? `<tr><td>Website</td><td><a href="${esc(b.website)}" rel="nofollow noopener" target="_blank">${esc(b.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></td></tr>` : ''}
      <tr><td>Based in</td><td>${esc(b.address || loc(b))}</td></tr>
      ${since ? `<tr><td>Trading since</td><td>${since}</td></tr>` : ''}
      ${b.employees ? `<tr><td>Team size</td><td>${esc(b.employees)}</td></tr>` : ''}
      <tr><td>Listing ID</td><td><code>${esc(b.id)}</code></td></tr></tbody></table></div>

    ${paid ? quoteForm(b) : `<div class="note" style="font-size:.86rem">${esc(b.name)} has a Basic listing. Contact them directly using the details above.</div>`}
    ${gold ? '' : sponsoredAside(b)}

    <div class="card"><div class="share" data-share-url="${esc(url)}" data-share-text="${esc(shareText)}"><span class="share__l">Share this business</span><div class="share__row">
      <button type="button" class="share__b share__b--native" data-share-native hidden aria-label="Share"><i class="fa-solid fa-share-nodes"></i></button>
      <a class="share__b share__b--whatsapp" href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener nofollow" aria-label="Share on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
      <a class="share__b" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener nofollow" aria-label="Share on Facebook"><i class="fa-brands fa-facebook-f"></i></a>
      <a class="share__b" href="https://x.com/intent/tweet?text=${t}&amp;url=${u}" target="_blank" rel="noopener nofollow" aria-label="Share on X"><i class="fa-brands fa-x-twitter"></i></a>
      <a class="share__b" href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener nofollow" aria-label="Share on LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
      <a class="share__b" href="mailto:?subject=${t}&amp;body=${u}" aria-label="Share by email"><i class="fa-solid fa-envelope"></i></a>
      <button type="button" class="share__b" data-share-copy aria-label="Copy link"><i class="fa-solid fa-link"></i></button></div>
      <input class="share__u" value="${esc(url)}" readonly aria-label="Direct link to this business" onfocus="this.select()"><span class="share__msg" role="status"></span></div></div>

    <div class="card own"><h3>Is this your business?</h3><p style="font-size:.86rem">Every Getclient listing must display the badge on its own website. Paste this once, anywhere in your site's code.</p>
      <img src="/assets/badge/${bimg}-light.svg" alt="Listed on Getclient" width="${bs[0]}" height="${bs[1]}">
      <div class="codebox"><button class="btn btn-s copy" data-copy="#own-code">Copy</button><pre id="own-code">${esc(snippet)}</pre></div>
      <p style="margin-top:.8rem;font-size:.84rem"><a href="/badge/?id=${esc(b.id)}">More badge styles, HTML and email versions →</a></p>
      ${paid ? '' : `<p style="margin-top:.6rem;font-size:.84rem"><a href="/pricing/">Upgrade to Blue or Gold</a> to add photos, quote requests and promotion.</p>`}</div>
  </aside>
</div></div></section>`;

  const ld = { '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': url + '#business', name: b.name, url, description: b.description || b.tagline || '',
    address: { '@type': 'PostalAddress', addressLocality: cityName(b), addressRegion: provName(b.province), addressCountry: 'ZA' } };
  if (b.phone) ld.telephone = b.phone;
  if (b.email) ld.email = b.email;
  if (b.founded) ld.foundingDate = String(b.founded);
  if (b.website) ld.sameAs = [b.website];
  if (b.rating_count) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(b.avg_rating).toFixed(1), ratingCount: b.rating_count, bestRating: 5, worstRating: 1 };
  if (cover) ld.image = cover.startsWith('/') ? SITE.origin + cover : cover;
  if (paid && b.services && b.services.length) ld.makesOffer = b.services.map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.description || '' } }));
  return layout({ title: `${b.name} — ${b.subcategory || b.category_name || 'Business'} in ${cityName(b)}`, path: `/b/${b.slug}/`, page: 'profile', body,
    turnstile: paid, ogImage: cover ? (cover.startsWith('/') ? SITE.origin + cover : cover) : '',
    desc: (b.tagline || b.description || `${b.name} on Getclient`).slice(0, 158), ld: [crumbLD(it), ld] });
}

// Old plain-HTML and email badges link to /b/<listing id>/. Those pages forward to the profile.
export function idRedirect(b) {
  const to = `/b/${b.slug}/`;
  return `<!DOCTYPE html><html lang="en-ZA"><head><meta charset="UTF-8"><title>${esc(b.name)} | Getclient</title>
<meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE.origin}${to}">
<meta http-equiv="refresh" content="0; url=${to}"><script>location.replace(${JSON.stringify(to)}+location.search+location.hash)</script></head>
<body style="font-family:system-ui;padding:2rem"><p>Taking you to <a href="${to}">${esc(b.name)} on Getclient</a>…</p></body></html>`;
}

export function dynProfile() {
  return layout({ title: 'Business profile', path: '/b/profile.html', canonical: SITE.origin + '/', noindex: true, page: 'profile', turnstile: true,
    desc: 'A business profile on Getclient, South Africa’s verified business directory.',
    body: `<div id="gc-dyn-profile" data-gc-dynamic><div class="wrap" style="padding:5rem 20px"><p class="lede">Loading this listing…</p></div></div>` });
}
