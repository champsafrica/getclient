// Getclient static build.
//
//   npm run build            pull approved listings from Supabase (read-only) and build dist/
//   npm run build:offline    build from the last pull in .cache/listings.json
//
// Nothing here writes to Supabase. The site reads the same gc_listings_public
// view as before, so the data stays exactly as it is.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { setBuild, setPromo, esc, photoURL, SITE, CATS, CITIES } from './src/lib.mjs';
import { PROVINCES, CHECKS } from './src/data/site.mjs';
import * as D from './src/pages/directory.mjs';
import * as P from './src/pages/content.mjs';
import * as J from './src/pages/jobs.mjs';
import * as E from './src/pages/email.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.cache', 'listings.json');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'config.json'), 'utf8'));
const offline = process.argv.includes('--offline');

// Blue and Gold services from gc_services (created by supabase/schema.sql). Missing table: none yet.
async function pullServices() {
  if (offline) { try { return JSON.parse(fs.readFileSync(CACHE.replace('listings', 'services'), 'utf8')); } catch { return []; } }
  const r = await fetch(`${CFG.supabaseUrl}/rest/v1/${CFG.tablePrefix}services?select=listing_id,name,description,price_from,sort&order=sort.asc`,
    { headers: { apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${CFG.supabaseAnonKey}` } });
  const rows = r.ok ? await r.json() : [];
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE.replace('listings', 'services'), JSON.stringify(rows));
  return rows;
}

async function pull() {
  if (offline) return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const url = `${CFG.supabaseUrl}/rest/v1/${CFG.tablePrefix}listings_public?select=*` +
    '&order=sponsored.desc,tier_rank.desc,avg_rating.desc.nullslast,created_at.asc';
  const r = await fetch(url, { headers: { apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${CFG.supabaseAnonKey}` } });
  if (!r.ok) throw new Error(`Supabase returned ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(rows, null, 1));
  return rows;
}

const out = (rel, data) => {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
};
const page = (urlPath, html) => out(urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath, html);
function copyDir(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); } else fs.copyFileSync(s, d);
  }
}

async function main() {
  const rows = await pull();
  // Profile content kept in the repo (cover, services, phones) merges onto the database row.
  const enrich = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'enrich.json'), 'utf8'));
  const services = await pullServices();
  for (const b of rows) {
    Object.assign(b, enrich[b.id] || {});
    const db = services.filter(s => s.listing_id === b.id);
    if (db.length) b.services = db;
    if (b.tier === 'gold') b.sponsored = true;            // Gold is always advertised
  }
  // Gold first, then Blue, then Basic, everywhere.
  const rank = b => (b.tier === 'gold' ? 2 : b.tier === 'blue' ? 1 : 0);
  rows.sort((a, b) => rank(b) - rank(a) || (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0) || String(a.created_at).localeCompare(String(b.created_at)));
  setPromo({ gold: rows.filter(b => b.tier === 'gold'), blue: rows.filter(b => b.tier === 'blue'), cfg: CFG });
  const now = new Date();
  const hash = crypto.createHash('sha1').update(JSON.stringify(rows) + fs.readFileSync(path.join(ROOT, 'src/static/assets/theme.css')) +
    fs.readFileSync(path.join(ROOT, 'src/static/assets/app.js')) + fs.readFileSync(path.join(ROOT, 'src/static/assets/live.js')) + now.toISOString().slice(0, 10)).digest('hex').slice(0, 10);
  setBuild(hash, now.toISOString());

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  copyDir(path.join(ROOT, 'src', 'static'), DIST);

  // badge image sizes, read from the generated SVGs
  const sizes = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'src/static/assets/badge')).filter(f => f.endsWith('.svg'))) {
    const m = fs.readFileSync(path.join(ROOT, 'src/static/assets/badge', f), 'utf8').match(/viewBox="0 0 (\d+) (\d+)"/);
    sizes[f.replace('.svg', '')] = [Number(m[1]), Number(m[2])];
  }
  const ctx = { rows, cfg: CFG, photo: p => photoURL(CFG, p) };
  const urls = [];
  const add = (u, html) => { page(u, html); urls.push(u); };

  add('/', D.home(ctx));
  add('/categories/', D.categories(ctx));
  add('/locations/', D.locations(ctx));
  page('/search/', D.search(ctx));
  for (const c of CATS) {
    add(`/c/${c.slug}/`, D.category(ctx, c));
    for (const ct of CITIES) add(`/c/${c.slug}/${ct.slug}/`, D.category(ctx, c, ct));
  }
  for (const p of PROVINCES) add(`/p/${p.slug}/`, D.province(ctx, p));
  for (const c of CITIES) add(`/l/${c.slug}/`, D.city(ctx, c));

  add('/list/', P.list());
  add('/pricing/', P.pricing());
  add('/badge/', P.badge(sizes));
  add('/verification/', P.verification());
  add('/how-it-works/', P.howItWorks());
  add('/about/', P.about());
  add('/contact/', P.contact());
  add('/privacy/', P.privacy());
  add('/terms/', P.terms());
  page('/admin/', P.admin());
  add('/get-quotes/', J.getQuotes());
  page('/job/', J.jobPage());
  page('/lead/', J.leadPage());
  page('/dashboard/', J.dashboard());
  page('/404.html', P.notFound());
  page('/offline.html', P.offline());
  page('/b/profile.html', D.dynProfile());

  // profiles, the /b/<id>/ forwarders old badges link to, and the badge status records
  const slugs = new Set(rows.map(b => b.slug));
  for (const b of rows) {
    add(`/b/${b.slug}/`, D.profile(ctx, b, sizes));
    if (!slugs.has(b.id)) page(`/b/${b.id}/`, D.idRedirect(b));
    out(`verify/${b.id}.json`, JSON.stringify({
      id: b.id, slug: b.slug, name: b.name, tier: b.tier || 'none', listed: true, url: `/b/${b.slug}/`, official: !!b.official,
      verified_at: b.verified_at ? String(b.verified_at).slice(0, 10) : null,
      checks: CHECKS.filter(([k]) => b[k]).map(([, , short]) => short),
      generated: now.toISOString().slice(0, 10)
    }));
  }

  // runtime config, service worker build stamp
  out('config.js', `window.GC_CONFIG = ${JSON.stringify(CFG, null, 2)};\n`);
  out('sw.js', fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8').replace('__BUILD__', hash));

  const today = now.toISOString().slice(0, 10);
  out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${SITE.origin}${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n') + `\n</urlset>\n`);

  // Supabase Auth email (pasted into the dashboard, not uploaded with the site)
  fs.mkdirSync(path.join(ROOT, 'supabase', 'templates'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'supabase', 'templates', 'sign-in-code.html'), E.signInEmail(rows.filter(b => b.tier === 'gold')));

  const n = fs.readdirSync(DIST, { recursive: true }).length;
  console.log(`Built ${urls.length} indexed pages, ${rows.length} listings, ${n} files -> dist/  (build ${hash})`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
