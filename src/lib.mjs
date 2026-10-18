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
export function seal(tier, cls = 'seal--sm') {
  const c = { gold: ['#E0A32E', '#B8860B'], blue: ['#5A9BFF', '#1D6FF2'] }[tier];
  if (!c) return '';
  const id = 'sl' + tier + cls.replace(/\W/g, '');
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
export const tierChip = t => t === 'gold' || t === 'blue' ? `<span class="tier tier--${t}">${seal(t)} ${tierLabel(t)}</span>` : `<span class="tier tier--none">Listed</span>`;

/* ---------- listing helpers ---------- */
export const provName = s => (provBy[s] && provBy[s].name) || String(s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const cityName = b => b.city_name || (cityBy[b.city] && cityBy[b.city].name) || '';
export const photoURL = (cfg, p) => cfg.supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/gc-photos/' + p;
export function initials(name) {
  const w = String(name || '').replace(/\(.*?\)|pty|ltd|\b(the|and|of)\b/gi, ' ').trim().split(/[\s&:-]+/).filter(Boolean);
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '').slice(1, 2))).toUpperCase();
}
const SHADES = ['#1652F0', '#0B2A6F', '#2A64F6', '#123A9C', '#3D7BFF', '#0F40C4'];
export const shade = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return SHADES[h % SHADES.length]; };
export const avatar = b => `<span class="avatar" style="background:${shade(b.id)}" aria-hidden="true">${esc(initials(b.name))}</span>`;
export const loc = b => [cityName(b), provName(b.province)].filter(Boolean).join(', ');

export function card(b, cfg) {
  const cov = b.cover_photo
    ? `<img src="${esc(photoURL(cfg, b.cover_photo))}" alt="" loading="lazy" width="480" height="132">`
    : ySvg('y', 'rgba(255,255,255,.14)', 'rgba(255,255,255,.3)');
  return `<article class="listing" data-gc-listing="${esc(b.id)}">` +
    `<div class="listing__cov">${cov}</div>` +
    `<div class="listing__tags">${b.sponsored ? '<span class="tier tier--ad">Ad</span>' : ''}</div>` +
    `<div class="listing__body">${avatar(b)}` +
    `<a class="listing__nm" href="/b/${esc(b.slug)}/">${esc(b.name)}${seal(b.tier)}</a>` +
    `<div class="listing__mt"><i class="fa-solid fa-location-dot"></i>${esc(b.subcategory || b.category_name || '')}${loc(b) ? ' · ' + esc(loc(b)) : ''}</div>` +
    `<p class="listing__ds" style="margin-top:.7rem">${esc(b.tagline || b.description || '')}</p>` +
    `<div class="listing__ft"><span class="rate" data-gc-rating="${esc(b.id)}">${rating(b.avg_rating, b.rating_count)}</span>` +
    `<span class="listing__go">View <i class="fa-solid fa-arrow-right"></i></span></div></div></article>`;
}
export const feat = b => `<a class="feat" href="/b/${esc(b.slug)}/"><span class="feat__ad">Ad</span>` +
  `<span class="feat__nm">${esc(b.name)}</span><span class="feat__mt">${esc(b.subcategory || b.category_name || '')} · ${esc(cityName(b))}</span>` +
  `<span class="feat__ds">${esc(b.tagline || b.description || '')}</span><span class="feat__go">View profile →</span></a>`;

export const listingGrid = (rows, cfg, empty) => `<div data-gc-hydrate>${rows.length
  ? `<div class="grid cards">${rows.map(b => card(b, cfg)).join('')}</div>`
  : `<div class="empty"><h3>${empty[0]}</h3><p>${empty[1]}</p><a class="btn btn-p" href="/list/">List a business free</a></div>`}</div>`;

export const crumbs = items => `<nav class="crumbs" aria-label="Breadcrumb">` + items.map((it, i) =>
  (i ? '<span aria-hidden="true">/</span>' : '') + (it[1] ? `<a href="${it[1]}">${esc(it[0])}</a>` : `<span>${esc(it[0])}</span>`)).join('') + `</nav>`;
export const crumbLD = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => Object.assign({ '@type': 'ListItem', position: i + 1, name: it[0] }, it[1] ? { item: SITE.origin + it[1] } : {}))
});

/* ---------- chrome ---------- */
const NAV = [
  ['Browse', true, [
    ['/categories/', 'fa-layer-group', 'All categories', 'Twelve service categories'],
    ['/locations/', 'fa-map-location-dot', 'All locations', 'Nine provinces, every major centre'],
    ['/search/', 'fa-magnifying-glass', 'Search the directory', 'Filter by service, city and tier'],
    ['/c/contractors-and-trades/', 'fa-helmet-safety', 'Contractors & trades', 'Builders, electricians, plumbers'],
    ['/c/legal-services/', 'fa-scale-balanced', 'Legal services', 'Attorneys and conveyancers'],
    ['/c/digital-and-tech/', 'fa-laptop-code', 'Digital & tech', 'Web, IT, SEO and ads']]],
  ['Verification', false, [
    ['/verification/', 'fa-shield-halved', 'How we verify', 'The five checks, explained'],
    ['/how-it-works/', 'fa-route', 'How it works', 'Search, check, quote, rate'],
    ['/badge/', 'fa-certificate', 'Get your badge', 'Listed on Getclient, on your site']]],
  ['For business', false, [
    ['/list/', 'fa-store', 'List your business', 'Free basic listing'],
    ['/pricing/', 'fa-tags', 'Pricing', `Blue ${SITE.prices.blue}, Gold ${SITE.prices.gold}`],
    ['/badge/', 'fa-certificate', 'Website badge', 'Required for every listing']]],
  ['Company', false, [
    ['/about/', 'fa-circle-info', 'About Getclient', 'Why we built it'],
    ['https://www.digitalxagency.io', 'fa-building', 'Digitalx', 'Our parent company'],
    ['/contact/', 'fa-envelope', 'Contact', 'Cape Town and Pretoria']]]
];
const ext = h => /^https?:/.test(h) ? ' target="_blank" rel="noopener"' : '';

function header() {
  const mnav = NAV.map(([t, wide, items]) => `<div class="mi"><button type="button" aria-expanded="false" aria-haspopup="true">${t}<span class="caret"></span></button>` +
    `<div class="mega${wide ? ' mega--wide' : ''}">` + items.map(([h, i, a, d]) => `<a href="${h}"${ext(h)}><span class="n"><i class="fa-solid ${i}"></i></span><span><span class="t">${esc(a)}</span><span class="d">${esc(d)}</span></span></a>`).join('') + `</div></div>`).join('');
  const drawer = NAV.map(([t, , items]) => `<h4>${t}</h4>` + items.map(([h, i, a]) => `<a href="${h}"${ext(h)}><span class="n"><i class="fa-solid ${i}"></i></span>${esc(a)}</a>`).join('')).join('');
  return `<a class="skip" href="#main">Skip to content</a>
<div class="ribbon" aria-hidden="true"></div>
<header class="top"><div class="wrap top-in">
<a class="brand" href="/" aria-label="Getclient home"><img src="/assets/brand/logo.svg" alt="Getclient" width="190" height="38"></a>
<nav class="mnav" aria-label="Main">${mnav}</nav>
<a class="btn btn-p btn-s btn-top" href="/list/"><i class="fa-solid fa-plus"></i> List your business</a>
<button class="burger" id="gc-burger" aria-expanded="false" aria-label="Open menu" aria-controls="gc-drawer"><i class="fa-solid fa-bars"></i></button>
</div></header>
<div class="drawer" id="gc-drawer"><div class="drawer__top"><img src="/assets/brand/logo.svg" alt="Getclient"><button id="gc-close" aria-label="Close menu">&times;</button></div>${drawer}
<a class="btn btn-p btn-blk" href="/list/">List your business</a></div>`;
}

function footer() {
  const top = CATS.slice(0, 6).map(c => `<li><a href="/c/${c.slug}/">${esc(c.short)}</a></li>`).join('');
  const cities = CITIES.slice(0, 6).map(c => `<li><a href="/l/${c.slug}/">${esc(c.name)}</a></li>`).join('');
  return `<footer class="ftr"><div class="ribbon" aria-hidden="true"></div><div class="wrap">
<div class="ftr__g">
  <div>
    <img class="lg" src="/assets/brand/logo-white.svg" alt="Getclient" width="200" height="40">
    <p class="ftr__tag">${SITE.tagline}</p>
    <p style="max-width:38ch">Getclient is the verified business directory built by ${SITE.company}, the team behind <a href="https://www.digitalxagency.io" target="_blank" rel="noopener">Digitalx</a>. Every listing is checked by a person before it goes live.</p>
    <div class="soc">${SITE.social.map(([h, i, l]) => `<a href="${h}" target="_blank" rel="noopener" aria-label="${l}"><i class="${i}"></i></a>`).join('')}</div>
    <div class="ftr__local">${flagSvg('')}<span>Proudly built in South Africa, for South African business. Local is lekker.</span></div>
  </div>
  <div><h4>Browse</h4><ul>${top}<li><a href="/categories/">All categories</a></li></ul></div>
  <div><h4>Cities</h4><ul>${cities}<li><a href="/locations/">All locations</a></li></ul></div>
  <div><h4>Contact</h4><ul>
    ${SITE.phones.map(([t, n, l]) => `<li><a href="tel:${t}">${n} <span style="opacity:.6">${l}</span></a></li>`).join('')}
    <li><a href="mailto:${SITE.email}">${SITE.email}</a></li>
    <li><a href="${SITE.whatsapp}" target="_blank" rel="noopener">WhatsApp us</a></li>
    <li style="opacity:.75">${SITE.address}</li></ul>
    <h4 style="margin-top:1.6rem">Business</h4><ul><li><a href="/list/">List your business</a></li><li><a href="/pricing/">Pricing</a></li><li><a href="/badge/">Website badge</a></li></ul></div>
</div>
<div class="ftr__b"><span>© ${new Date().getFullYear()} Getclient · a ${SITE.company} project · Cape Town, South Africa</span>
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
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${SITE.origin}/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${SITE.origin}/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0B2A6F">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Getclient"><meta name="mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="stylesheet" href="/assets/theme.css?v=${v}">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script>if(typeof window.supabase==='undefined'){document.write('<scr'+'ipt src="https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></scr'+'ipt>');}</script>
${ld}
</head>
<body data-gc-page="${o.page || ''}" data-gc-cat="${o.cat || ''}" data-gc-city="${o.city || ''}" data-gc-prov="${o.prov || ''}" data-gc-built="${BUILT}">
${header()}
<main id="main">
${o.body}
</main>
${footer()}
${o.pay ? '<script src="https://js.paystack.co/v1/inline.js" defer></script>' : ''}
<script src="/config.js?v=${v}"></script>
<script src="/assets/app.js?v=${v}" defer></script>
<script src="/assets/live.js?v=${v}" defer></script>
</body>
</html>`;
}

export { SITE, CATS, CITIES, catBy, cityBy, provBy };
