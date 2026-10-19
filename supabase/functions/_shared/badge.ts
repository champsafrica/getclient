import { admin } from './db.ts';

// Looks for the Listed on Getclient badge on a business website.
// Accepted: the badge script, a badge image, or a link to the business's profile.
const MARKERS = [
  /getclient\.co\.za\/badge\.js/i,
  /getclient\.co\.za\/assets\/badge\//i,
  /getclient\.co\.za\/assets\/seal-(gold|blue)\./i,
  /href=["']https?:\/\/(www\.)?getclient\.co\.za\/b\//i,
];

export function normaliseUrl(raw: string): URL | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase();
    // never fetch internal addresses
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
        /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.includes(':') || !h.includes('.')) return null;
    return u;
  } catch { return null; }
}

export const domainOf = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, '');

export async function checkBadge(raw: string): Promise<{ found: boolean; how: string; url: string; checked_at: string; error?: string }> {
  const checked_at = new Date().toISOString();
  const u = normaliseUrl(raw);
  if (!u) return { found: false, how: '', url: raw, checked_at, error: 'That website address is not valid.' };

  // 1. the badge script has reported in from this domain
  const { data: pings } = await admin.from('gc_badge_pings').select('domain,last_seen').eq('domain', domainOf(u))
    .gte('last_seen', new Date(Date.now() - 30 * 864e5).toISOString()).limit(1);
  if (pings && pings.length) return { found: true, how: 'badge script reported from ' + domainOf(u), url: u.href, checked_at };

  // 2. the page HTML contains the badge
  try {
    const r = await fetch(u.href, {
      redirect: 'follow', signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'GetclientBadgeCheck/1.0 (+https://getclient.co.za/badge/)', Accept: 'text/html' },
    });
    if (!r.ok) return { found: false, how: '', url: u.href, checked_at, error: `The website answered with HTTP ${r.status}.` };
    const reader = r.body!.getReader();
    let html = '', size = 0;
    while (size < 3_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      html += new TextDecoder().decode(value);
      if (MARKERS.some((m) => m.test(html))) { reader.cancel(); return { found: true, how: 'badge code found in page', url: r.url, checked_at }; }
    }
    return { found: false, how: '', url: r.url, checked_at, error: 'The badge code was not found on that page.' };
  } catch (e) {
    return { found: false, how: '', url: u.href, checked_at, error: 'The website could not be reached: ' + String(e).slice(0, 120) };
  }
}
