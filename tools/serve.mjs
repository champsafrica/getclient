// Local preview of dist/ that behaves like the production .htaccess:
// directory indexes, the /b/<slug>/ fallback to b/profile.html, and the 404 page.
//   npm run serve   ->  http://localhost:4173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'dist');
const PORT = Number(process.env.PORT || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

function file(p) {
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  if (fs.existsSync(path.join(f, 'index.html'))) return path.join(f, 'index.html');
  return null;
}

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = file(p), status = 200;
  if (!f && /^\/b\/[A-Za-z0-9_-]+\/?$/.test(p)) f = file('/b/profile.html');
  if (!f) { f = file('/404.html'); status = 404; }
  if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found (is dist/ being rebuilt?)'); return; }
  const headers = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
  if (p === '/badge.js' || p.startsWith('/verify/') || p.startsWith('/assets/badge/')) headers['Access-Control-Allow-Origin'] = '*';
  res.writeHead(status, headers);
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Serving dist/ on http://localhost:${PORT}`));
