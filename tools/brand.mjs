// Generates every brand asset from code: the logo, icons, tier seals and the
// "Listed on Getclient" badge images. Text is converted to outlines with the
// Poppins font files in tools/fonts, so the SVGs render identically everywhere
// (email clients, other people's websites, print) without needing the font.
//
//   npm run brand      -> writes into src/static/
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'src', 'static');
const font = w => opentype.loadSync(path.join(ROOT, 'tools', 'fonts', `Poppins-${w}.ttf`));
const F = { med: font('Medium'), semi: font('SemiBold'), bold: font('Bold'), xbold: font('ExtraBold') };

export const C = {
  blue: '#1652F0', navy: '#0B2A6F', ink: '#071A47', white: '#FFFFFF', mist: '#EEF3FF', line: '#D5E0FB',
  muted: '#5B6B93', gold: '#C8901A',
  // South African flag colours, used only as a thin ribbon accent
  sa: ['#007749', '#FFB81C', '#E03C31', '#001489', '#000000']
};

/* ---------- text to outlines ---------- */
function measure(f, str, size, track = 0) {
  let w = 0, prev = null;
  for (const ch of str) {
    const g = f.charToGlyph(ch);
    if (prev) w += f.getKerningValue(prev, g) * size / f.unitsPerEm;
    w += g.advanceWidth * size / f.unitsPerEm + track;
    prev = g;
  }
  return w - track;
}
function text(f, str, x, y, size, fill, track = 0, extra = '') {
  let d = '', prev = null, cx = x;
  for (const ch of str) {
    const g = f.charToGlyph(ch);
    if (prev) cx += f.getKerningValue(prev, g) * size / f.unitsPerEm;
    d += g.getPath(cx, y, size).toPathData(2);
    cx += g.advanceWidth * size / f.unitsPerEm + track;
    prev = g;
  }
  return `<path d="${d}" fill="${fill}"${extra}/>`;
}

/* ---------- the mark: a G that has caught its client ---------- */
function mark(x, y, s, bg, fg, rx = 15) {
  const k = s / 64;
  return `<g transform="translate(${x} ${y}) scale(${k})">` +
    `<rect width="64" height="64" rx="${rx}" fill="${bg}"/>` +
    `<path d="M50 32 A18 18 0 1 1 38.16 15.09" fill="none" stroke="${fg}" stroke-width="6.5" stroke-linecap="round"/>` +
    `<path d="M50 32 H33" fill="none" stroke="${fg}" stroke-width="6.5" stroke-linecap="round"/>` +
    `<circle cx="46.75" cy="21.67" r="3.6" fill="${fg}"/></g>`;
}

/* ---------- tier seals: unchanged geometry, so existing embeds stay valid ---------- */
function sealPoints() {
  let pts = '';
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI / 12) * i - Math.PI / 2, r = i % 2 === 0 ? 15.2 : 12.6;
    pts += (16 + r * Math.cos(a)).toFixed(2) + ',' + (16 + r * Math.sin(a)).toFixed(2) + ' ';
  }
  return pts.trim();
}
const SEAL = { gold: ['#E0A32E', '#B8860B'], blue: ['#5A9BFF', '#1D6FF2'], official: ['#829AAB', '#829AAB'] };
function seal(tier, x = 0, y = 0, s = 32, id = 'g') {
  const [a, b] = SEAL[tier];
  return `<g transform="translate(${x} ${y}) scale(${s / 32})"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<polygon points="${sealPoints()}" fill="url(#${id})"/>` +
    `<path d="M10.6 16.4l3.6 3.6 7.2-7.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

/* ---------- SA ribbon ---------- */
function ribbon(x, y, w, h) {
  const seg = w / C.sa.length;
  return C.sa.map((c, i) => `<rect x="${(x + i * seg).toFixed(2)}" y="${y}" width="${(seg + 0.3).toFixed(2)}" height="${h}" fill="${c}"/>`).join('');
}

/* ---------- logo lockups ---------- */
function logo(onDark) {
  const size = 38, track = -0.5;
  const wGet = measure(F.med, 'get', size, track), wClient = measure(F.bold, 'client', size, track);
  const x0 = 86, w = Math.ceil(x0 + wGet + track + wClient + 10);
  const getC = onDark ? '#B9CCFF' : C.blue, clientC = onDark ? C.white : C.navy;
  const body = mark(8, 8, 64, onDark ? C.white : C.blue, onDark ? C.blue : C.white) +
    text(F.med, 'get', x0, 53, size, getC, track) +
    text(F.bold, 'client', x0 + wGet + track, 53, size, clientC, track);
  return { w, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 80" width="${w * 3}" height="240" role="img" aria-label="Getclient"><title>Getclient</title>${body}</svg>` };
}

/* ---------- badge images (plain HTML and email versions) ---------- */
export function badgeSVG(tier, theme) {
  const dark = theme === 'dark';
  const bg = dark ? C.ink : C.white, stroke = dark ? '#24407F' : C.line;
  const strong = dark ? C.white : C.navy, soft = dark ? '#9FB3E6' : C.muted, brand = dark ? '#8FB0FF' : C.blue;
  const H = 52, pad = 10, icon = 32, tx = pad + icon + 10;
  let lines, w;
  if (tier === 'none') {
    const w1 = measure(F.med, 'Listed on', 11), w2 = measure(F.bold, 'Getclient', 17, -0.2);
    w = Math.ceil(tx + Math.max(w1, w2) + 18);
    lines = text(F.med, 'Listed on', tx, 22, 11, soft) + text(F.bold, 'Getclient', tx, 40, 17, strong, -0.2);
  } else {
    const label = tier === 'gold' ? 'Gold Verified' : tier === 'official' ? 'Official' : 'Blue Verified';
    const k = 'Listed on Getclient';
    const w1 = measure(F.semi, k, 10.5), w2 = measure(F.bold, label, 15, -0.1);
    w = Math.ceil(tx + Math.max(w1, w2) + 18);
    lines = text(F.semi, k, tx, 21, 10.5, brand) + text(F.bold, label, tx, 38.5, 15, strong, -0.1);
  }
  const iconSvg = tier === 'none' ? mark(pad, (H - icon) / 2 - 1, icon, C.blue, C.white, 14) : seal(tier, pad, (H - icon) / 2 - 1, icon, 's' + tier + theme);
  const title = tier === 'none' ? 'Listed on Getclient' : `Listed on Getclient — ${tier === 'gold' ? 'Gold Verified' : tier === 'official' ? 'Official' : 'Blue Verified'}`;
  return { w, h: H, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="${title}"><title>${title}</title>` +
    `<defs><clipPath id="pill${tier}${theme}"><rect x="0.75" y="0.75" width="${w - 1.5}" height="${H - 1.5}" rx="${(H - 1.5) / 2}"/></clipPath></defs>` +
    `<rect x="0.75" y="0.75" width="${w - 1.5}" height="${H - 1.5}" rx="${(H - 1.5) / 2}" fill="${bg}" stroke="${stroke}" stroke-width="1.5"/>` +
    `<g clip-path="url(#pill${tier}${theme})">${ribbon(0, H - 4.5, w, 3.75)}</g>` +
    iconSvg + lines + `</svg>` };
}

/* ---------- write ---------- */
const write = (rel, data) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return p; };
const png = (svg, rel, w, h, opts = {}) => sharp(Buffer.from(svg), { density: 300 }).resize(w, h, { fit: 'contain', background: opts.bg || { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, rel));

async function main() {
  const L = logo(false), LW = logo(true);
  write('assets/brand/logo.svg', L.svg);
  write('assets/brand/logo-white.svg', LW.svg);
  const markSvg = s => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${s}" height="${s}">${mark(0, 0, 64, C.blue, C.white)}</svg>`;
  write('assets/brand/mark.svg', markSvg(512));
  write('assets/brand/mark-white.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">${mark(0, 0, 64, C.white, C.blue)}</svg>`);
  write('favicon.svg', markSvg(64));

  // square icons: the mark on a full-bleed tile for maskable / apple
  const tile = s => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${s}" height="${s}"><rect width="64" height="64" fill="${C.blue}"/>${mark(8, 8, 48, C.blue, C.white, 0)}</svg>`;
  await png(markSvg(512), 'logo.png', 512, 512);          // kept at the old path: og:image, manifest, old links
  await png(markSvg(512), 'assets/brand/icon-192.png', 192, 192);
  await png(markSvg(512), 'assets/brand/icon-512.png', 512, 512);
  await png(tile(512), 'assets/brand/maskable-512.png', 512, 512);
  await png(tile(180), 'apple-touch-icon.png', 180, 180);
  await png(markSvg(64), 'favicon-32.png', 32, 32);
  await png(L.svg, 'assets/brand/logo.png', L.w * 4, 320);
  await png(LW.svg, 'assets/brand/logo-white.png', LW.w * 4, 320);

  // social share card 1200x630
  const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">` +
    `<rect width="1200" height="630" fill="${C.ink}"/>` +
    `<path d="M-40 -40 L520 315 L-40 670" fill="none" stroke="#123A9C" stroke-width="150" opacity=".55"/>` +
    `<path d="M520 315 H1240" stroke="#123A9C" stroke-width="150" opacity=".55"/>` +
    `<g transform="translate(120 170) scale(2.4)">${LW.svg.replace(/^<svg[^>]*>/, '').replace('</svg>', '').replace(/<title>.*?<\/title>/, '')}</g>` +
    text(F.semi, 'South Africa’s verified business directory', 128, 430, 40, '#DCE6FF') +
    text(F.med, 'getclient.co.za', 128, 488, 28, '#8FB0FF') + ribbon(0, 618, 1200, 12) + `</svg>`;
  await png(og, 'og.png', 1200, 630);

  // seals: identical artwork at the identical paths, plus the PNGs email badges point at
  for (const t of ['gold', 'blue']) {
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64">${seal(t, 0, 0, 32, 'g')}</svg>`;
    write(`assets/seal-${t}.svg`, s);
    await png(s, `assets/seal-${t}.png`, 96, 96);
  }

  // badge images
  for (const tier of ['none', 'blue', 'gold', 'official']) for (const theme of ['light', 'dark']) {
    const name = `assets/badge/${tier === 'none' ? 'listed' : tier}-${theme}`;
    const b = badgeSVG(tier, theme);
    write(name + '.svg', b.svg);
    await png(b.svg, name + '.png', b.w * 2, b.h * 2);
  }
  console.log('brand assets written to', OUT);
}
main();
