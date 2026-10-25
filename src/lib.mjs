import { SITE, CATS, CITIES, provBy, cityBy, catBy } from './data/site.mjs';

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export let BUILD = 'dev', BUILT = '';
export const setBuild = (b, iso) => { BUILD = b; BUILT = iso; };

/* ---------- motifs ---------- */
// The "Y" of the national flag, drawn in blue tones only — a nod, not a flag.
export const ySvg = (cls = 'y', tone = 'rgba(255,255,255,.12)', edge = 'rgba(255,255,255,.22)') =>
  `<svg class="${cls}" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
  `<path d="M-80 -60 L470 300 L-80 660 M470 300 H1300" fill="none" stroke="${tone}" stroke-width="170" stroke-linejoin="miter"/>` +
  `<path d="M-80 -60 L470 300 L-80 660 M470 300 H1300" fill="none" stroke="${edge}" stroke-width="3"/></svg>`;

export const flagSvg = (cls = 'flag') =>
  `<svg class="${cls}" viewBox="0 0 36 24" aria-hidden="true" focusable="false"><defs><clipPath id="fc"><rect width="36" height="24"/></clipPath></defs><g clip-path="url(#fc)">` +
  `<rect width="36" height="12" fill="#E03C31"/><rect y="12" width="36" height="12" fill="#001489"/>` +
  `<path d="M0 0 L13 12 L0 24 M13 12 H36" stroke="#fff" stroke-width="8" fill="none"/>` +
  `<path d="M0 0 L0 24 L13 12 Z" fill="#FFB81C"/>` +
  `<path d="M0 0 L13 12 L0 24 M13 12 H36" stroke="#007749" stroke-width="4.8" fill="none"/>` +
  `<path d="M0 4.9 L0 19.1 L7.7 12 Z" fill="#000"/></g></svg>`;

/* ---------- seals, stars ---------- */
const SEAL_PTS = (() => { let p = ''; for (let i = 0; i < 24; i++) { const a = (Math.PI / 12) * i - Math.PI / 2, r = i % 2 === 0 ? 15.2 : 12.6; p += (16 + r * Math.cos(a)).toFixed(2) + ',' + (16 + r * Math.sin(a)).toFixed(2) + ' '; } return p.trim(); })();
// Each seal gets its own gradient id: a shared id breaks when its first copy is hidden.
let SEAL_N = 0;
export function seal(tier, cls = 'seal--sm') {
  const c = { gold: ['#E0A32E', '#B8860B'], blue: ['#5A9BFF', '#1D6FF2'] }[tier];
  if (!c) return '';
  const id = 'sl' + tier + (++SEAL_N);
  const label = tier === 'gold' ? 'Gold Verified' : 'Blue Verified';
  return `<svg class="seal ${cls}" viewBox="0 0 32 32" role="img" aria-label="${label}"><title>${label}</title><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><polygon points="${SEAL_PTS}" fill="url(#${id})"/><path d="M10.6 16.4l3.6 3.6 7.2-7.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
const STAR_D = 'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z';
export function stars(v) {
  const n = Math.round(Number(v) || 0);
  let o = ''; for (let i = 0; i < 5; i++) o += `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="star-${i < n ? 'on' : 'off'}" d="${STAR_D}"/></svg>`;
  return `<span class="stars" role="img" aria-label="${n} out of 5 stars">${o}</span>`;
}
export const rating = (avg, count) => !count ? stars(0) + ' <span>Not rated yet</span>'
  : stars(avg) + ` <b>${Number(avg).toFixed(1)}</b> <span>(${count} rating${count === 1 ? '' : 's'})</span>`;
export const starButtons = () => [1, 2, 3, 4, 5].map(n => `<button type="button" data-gc-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}"><svg viewBox="0 0 24 24"><path class="star-off" d="${STAR_D}"/></svg></button>`).join('');

export const tierLabel = t => t === 'gold' ? 'Gold Verified' : t === 'blue' ? 'Blue Verified' : 'Listed';

// The grey tick, in the grey X uses for official accounts, for the business that runs Getclient.
export const greyTick = (cls = 'seal--sm') =>
  `<svg class="seal ${cls}" viewBox="0 0 32 32" role="img" aria-label="Official"><title>Official: Developed and Managed by Digitalx</title><polygon points="${SEAL_PTS}" fill="#829AAB"/><path d="M10.6 16.4l3.6 3.6 7.2-7.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// The mark after a business name: its own icon then the grey tick if official, otherwise the tier seal.
export const mark = (b, cls = 'seal--sm') => b && b.official
  ? `<span class="omark omark--${cls.replace('seal--', '')}">${b.logo ? `<img src="${esc(b.logo)}" alt="" class="omark__x">` : ''}${greyTick(cls)}</span>`
  : seal(b && b.tier, cls);
export const tierChipFor = b => b && b.official
  ? `<span class="tier tier--official">${greyTick()} Official</span>` : tierChip(b && b.tier);
export const tierChip = t => t === 'gold' || t === 'blue' ? `<span class="tier tier--${t}">${seal(t)} ${tierLabel(t)}</span>` : `<span class="tier tier--none">Listed</span>`;

/* ---------- listing helpers ---------- */
export const provName = s => (provBy[s] && provBy[s].name) || String(s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const cityName = b => b.city_name || (cityBy[b.city] && cityBy[b.city].name) || '';
export const photoURL = (cfg, p) => /^\//.test(p) ? p : cfg.supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/gc-photos/' + p;
export function initials(name) {
  const w = String(name || '').replace(/\(.*?\)|pty|ltd|\b(the|and|of)\b/gi, ' ').trim().split(/[\s&:-]+/).filter(Boolean);
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '').slice(1, 2))).toUpperCase();
}
const SHADES = ['#1652F0', '#0B2A6F', '#2A64F6', '#123A9C', '#3D7BFF', '#0F40C4'];
export const shade = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return SHADES[h % SHADES.length]; };
export const avatar = b => b.logo
  ? `<span class="avatar avatar--logo" aria-hidden="true"><img src="${esc(b.logo)}" alt=""></span>`
  : `<span class="avatar" style="background:${shade(b.id)}" aria-hidden="true">${esc(initials(b.name))}</span>`;
export const loc = b => [cityName(b), provName(b.province)].filter(Boolean).join(', ');

/* ---------- tier rules ----------
 * Gold:  ads on every page, cover image, photos, services, quotes, WhatsApp.
 * Blue:  Blue Verified showcase under Gold, photos, quotes, WhatsApp.
 * Basic: a description and contact details. Nothing else.            */
export const isGold = b => b && b.tier === 'gold';
export const isBlue = b => b && b.tier === 'blue';
export const isPaid = b => isGold(b) || isBlue(b);
export const coverOf = (b, cfg) => isGold(b) && b.cover ? b.cover : isPaid(b) && b.cover_photo ? photoURL(cfg, b.cover_photo) : '';

export function card(b, cfg) {
  const c = coverOf(b, cfg);
  const cov = c ? `<img src="${esc(c)}" alt="" loading="lazy" width="480" height="132"${b.cover_fit === 'contain' ? ' class="fit-contain"' : ''}>`
    : ySvg('y', 'rgba(255,255,255,.14)', 'rgba(255,255,255,.3)');
  const tag = isGold(b) ? '<span class="tier tier--ad">Ad · Gold</span>' : isBlue(b) ? '<span class="tier tier--bluetag">Blue Verified</span>' : '';
  return `<article class="listing${isGold(b) ? ' listing--gold' : isBlue(b) ? ' listing--blue' : ''}" data-gc-listing="${esc(b.id)}">` +
    `<div class="listing__cov">${cov}</div><div class="listing__tags">${tag}</div>` +
    `<div class="listing__body">${avatar(b)}` +
    `<a class="listing__nm" href="/b/${esc(b.slug)}/">${esc(b.name)}${mark(b)}</a>` +
    `<div class="listing__mt"><i class="fa-solid fa-location-dot"></i>${esc(b.subcategory || b.category_name || '')}${loc(b) ? ' · ' + esc(loc(b)) : ''}</div>` +
    `<p class="listing__ds" style="margin-top:.7rem">${esc(b.tagline || b.description || '')}</p>` +
    `<div class="listing__ft"><span class="rate" data-gc-rating="${esc(b.id)}">${rating(b.avg_rating, b.rating_count)}</span>` +
    `<span class="listing__go">View <i class="fa-solid fa-arrow-right"></i></span></div></div></article>`;
}
export const feat = (b, cfg) => {
  const c = coverOf(b, cfg || { supabaseUrl: '' });
  return `<a class="feat" href="/b/${esc(b.slug)}/"><span class="feat__ad">Ad · Gold</span>` +
    (c ? `<span class="feat__img"><img src="${esc(c)}" alt="" loading="lazy"${b.cover_fit === 'contain' ? ' class="fit-contain"' : ''}></span>` : '') +
    `<span class="feat__nm">${esc(b.name)} ${mark(b)}</span><span class="feat__mt">${esc(b.subcategory || b.category_name || '')} · ${esc(cityName(b))}</span>` +
    `<span class="feat__ds">${esc(b.tagline || b.description || '')}</span><span class="feat__go">View profile →</span></a>`;
};
export const blueChip = b => `<a class="bchip" href="/b/${esc(b.slug)}/">${avatar(b)}<span><b>${esc(b.name)} ${seal('blue', 'seal--sm')}</b><small>${esc(b.subcategory || b.category_name || '')} · ${esc(cityName(b))}</small></span></a>`;

export const listingGrid = (rows, cfg, empty) => `<div data-gc-hydrate>${rows.length
  ? `<div class="grid cards">${rows.map(b => card(b, cfg)).join('')}</div>`
  : `<div class="empty"><h3>${empty[0]}</h3><p>${empty[1]}</p><a class="btn btn-p" href="/list/">List a business free</a></div>`}</div>`;

export const crumbs = items => `<nav class="crumbs" aria-label="Breadcrumb">` + items.map((it, i) =>
  (i ? '<span aria-hidden="true">/</span>' : '') + (it[1] ? `<a href="${it[1]}">${esc(it[0])}</a>` : `<span>${esc(it[0])}</span>`)).join('') + `</nav>`;
export const crumbLD = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => Object.assign({ '@type': 'ListItem', position: i + 1, name: it[0] }, it[1] ? { item: SITE.origin + it[1] } : {}))
});

/* ---------- promotion: Gold ads on every page, Blue showcase beneath ---------- */
let PROMO = { gold: [], blue: [], cfg: null };
export const setPromo = p => { PROMO = p; };
export const promoGold = () => PROMO.gold;
export const promoBlue = () => PROMO.blue;

// The slim sponsored bar under the header, on every page.
export function adBar() {
  if (!PROMO.gold.length) return '';
  const items = PROMO.gold.map(b => `<a href="/b/${esc(b.slug)}/">${mark(b)}<b>${esc(b.name)}</b><span>${esc(b.tagline || b.subcategory || '')}</span></a>`).join('');
  return `<aside class="adbar" data-gc-ads="bar" aria-label="Sponsored: Gold Verified businesses"><div class="wrap adbar__in">
  <span class="adbar__k">Ad</span><div class="adbar__vp"><div class="adbar__track">${items}${items}</div></div></div></aside>`;
}

// Gold sponsored cards, then the Blue Verified showcase. Before the footer on every page.
export function promoBlock() {
  if (!PROMO.gold.length && !PROMO.blue.length) return '';
  return `<section class="gpromo" data-gc-ads="block" aria-label="Featured businesses"><div class="wrap">
  ${PROMO.gold.length ? `<div class="head"><div><p class="eyebrow">Sponsored · Gold Verified</p><h2 style="font-size:1.4rem;margin:0">Featured Gold businesses</h2></div>
  <span class="adnote">Gold listings appear on every page. Always labelled Ad.</span></div>
  <div class="feats">${PROMO.gold.map(b => feat(b, PROMO.cfg)).join('')}</div>` : ''}
  ${PROMO.blue.length ? `<div class="bluerow"><p class="eyebrow" style="margin-bottom:.8rem">${seal('blue', 'seal--sm')} Blue Verified businesses</p>
  <div class="bchips">${PROMO.blue.map(blueChip).join('')}</div></div>` : ''}
  </div></section>`;
}

/* ---------- chrome ---------- */
// One flat row of links. No dropdowns.
const NAV = [
  ['/get-quotes/', 'Get quotes'], ['/search/', 'Find a business'], ['/categories/', 'Categories'],
  ['/pricing/', 'Pricing'], ['/badge/', 'Get the badge'], ['/dashboard/', 'My business']
];

function header(path) {
  const cur = h => (path === h || (h !== '/' && path.startsWith(h))) ? ' aria-current="page"' : '';
  return `<a class="skip" href="#main">Skip to content</a>
<div class="ribbon" aria-hidden="true"></div>
<header class="top"><div class="wrap top-in">
<a class="brand" href="/" aria-label="Getclient home"><img class="logo-l" src="/assets/brand/logo.svg" alt="Getclient" width="190" height="38"><img class="logo-d" src="/assets/brand/logo-white.svg" alt="Getclient" width="190" height="38"></a>
<nav class="nav" aria-label="Main">${NAV.map(([h, t]) => `<a href="${h}"${cur(h)}>${t}</a>`).join('')}</nav>
<button class="theme" id="gc-theme" type="button" aria-label="Switch between light and dark mode" title="Light or dark mode"><i class="fa-solid fa-moon"></i><i class="fa-solid fa-sun"></i></button>
<a class="btn btn-p btn-s btn-top" href="/list/">List your business</a>
<button class="burger" id="gc-burger" aria-expanded="false" aria-label="Open menu" aria-controls="gc-drawer"><i class="fa-solid fa-bars"></i></button>
</div></header>
<div class="drawer" id="gc-drawer"><div class="drawer__top"><img class="logo-l" src="/assets/brand/logo.svg" alt="Getclient"><img class="logo-d" src="/assets/brand/logo-white.svg" alt="Getclient"><button id="gc-close" aria-label="Close menu">&times;</button></div>
${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="/locations/">Locations</a><a href="/how-it-works/">How it works</a><a href="/about/">About</a><a href="/contact/">Contact</a>
<a class="btn btn-p btn-blk" href="/list/">List your business</a></div>`;
}

// A short footer: brand, one row of links, contact, credit.
const FOOT_LINKS = [
  ['/search/', 'Find a business'], ['/categories/', 'Categories'], ['/locations/', 'Locations'], ['/pricing/', 'Pricing'],
  ['/badge/', 'Badge'], ['/list/', 'List your business'], ['/about/', 'About'], ['/contact/', 'Contact']
];
export const credit = () => `Developed and Managed by <a href="https://www.digitalxagency.io" target="_blank" rel="noopener">Digitalx</a>`;

function footer() {
  return `<footer class="ftr"><div class="ribbon" aria-hidden="true"></div><div class="wrap">
<div class="ftr__top">
  <a href="/" class="ftr__brand" aria-label="Getclient home"><img src="/assets/brand/logo-white.svg" alt="Getclient" width="170" height="34"></a>
  <nav class="ftr__nav" aria-label="Footer">${FOOT_LINKS.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
</div>
<div class="ftr__mid">
  <span><a href="tel:+27218793035">021 879 3035</a> · <a href="mailto:${SITE.email}">${SITE.email}</a> · <a href="${SITE.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></span>
  <span class="soc">${SITE.social.map(([h, i, l]) => `<a href="${h}" target="_blank" rel="noopener" aria-label="${l}"><i class="${i}"></i></a>`).join('')}</span>
</div>
<div class="ftr__b"><span>© ${new Date().getFullYear()} Getclient · ${credit()} · ${flagSvg('ftr__flag')} Built in South Africa</span>
<span><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/sitemap.xml">Sitemap</a></span></div>
</div></footer>
<div class="install" id="gc-install" role="dialog" aria-label="Install Getclient"><img src="/assets/brand/icon-192.png" alt="">
<div style="flex:1"><b>Install Getclient</b><span>Add it to your home screen for offline browsing.</span></div>
<button class="btn btn-p btn-s" id="gc-install-go">Install</button><button class="x" id="gc-install-x" aria-label="Dismiss">&times;</button></div>`;
}

export function layout(o) {
  const url = SITE.origin + o.path;
  const title = o.title.includes('Getclient') ? o.title : o.title + ' | Getclient';
  const ld = (o.ld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('');
  const v = BUILD;
  const promo = o.promo !== false;
  return `<!DOCTYPE html>
<html lang="en-ZA">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${esc(o.canonical || url)}">
<meta name="robots" content="${o.noindex ? 'noindex,follow' : 'index,follow, max-image-preview:large'}">
<meta name="author" content="${SITE.company}">
<meta name="geo.region" content="ZA-WC"><meta name="geo.placename" content="Cape Town, South Africa">
<meta property="og:type" content="website"><meta property="og:site_name" content="Getclient"><meta property="og:locale" content="en_ZA">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${o.ogImage ? esc(o.ogImage) : SITE.origin + '/og.png'}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${o.ogImage ? esc(o.ogImage) : SITE.origin + '/og.png'}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="${o.admin ? '/admin/manifest.webmanifest' : '/manifest.webmanifest'}">
<meta name="theme-color" content="#0B2A6F"><meta name="color-scheme" content="light dark">
<script>(function(){var t=null;try{t=localStorage.getItem("gc_theme")}catch(e){}var d=t?t==="dark":!!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")})();</script>
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="${o.admin ? 'Getclient Admin' : 'Getclient'}"><meta name="mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${o.turnstile ? '<link rel="preconnect" href="https://challenges.cloudflare.com">' : ''}
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="stylesheet" href="/assets/theme.css?v=${v}">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script>if(typeof window.supabase==='undefined'){document.write('<scr'+'ipt src="https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></scr'+'ipt>');}</script>
${ld}
</head>
<body data-gc-page="${o.page || ''}" data-gc-cat="${o.cat || ''}" data-gc-city="${o.city || ''}" data-gc-prov="${o.prov || ''}" data-gc-built="${BUILT}">
${header(o.path)}
${promo ? adBar() : ''}
<main id="main">
${o.body}
</main>
${promo ? promoBlock() : ''}
${footer()}
${o.pay ? '<script src="https://js.paystack.co/v1/inline.js" defer></script>' : ''}
${o.turnstile ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>' : ''}
<script src="/config.js?v=${v}"></script>
<script src="/assets/app.js?v=${v}" defer></script>
<script src="/assets/live.js?v=${v}" defer></script>
${(o.scripts || []).map(x => `<script src="/assets/${x}?v=${v}" defer></script>`).join('')}
${o.admin ? `<script src="https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@10.0.0/dist/bundle/index.umd.min.js" defer></script>
<script src="/assets/admin.js?v=${v}" defer></script>` : ''}
</body>
</html>`;
}

export { SITE, CATS, CITIES, catBy, cityBy, provBy };
