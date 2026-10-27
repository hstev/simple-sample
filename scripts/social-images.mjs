// Renders the social/ads preview images (Open Graph, X, Google/Meta Ads) into public/social/.
// Usage: npm run social-images  (set OG_FONT_DIR to a folder with Inter .ttf files for best results)
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const OUT = new URL('../public/social/', import.meta.url).pathname;
const URL_LABEL = 'hstev.github.io/simple-sample';
const FONT = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', Menlo, monospace";

// Deterministic waveform so the images are reproducible.
function wave(n) {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, (_, i) => {
    const beat = Math.abs(Math.sin(i * 0.39)) ** 3;
    return Math.min(1, 0.18 + beat * 0.7 + rnd() * 0.25);
  });
}

function waveform(x, y, w, h, bars, sel) {
  const step = w / bars;
  const bw = Math.max(3, step * 0.55);
  return wave(bars)
    .map((a, i) => {
      const bh = Math.max(bw, a * h);
      const inSel = i >= sel[0] * bars && i < sel[1] * bars;
      return `<rect x="${(x + i * step).toFixed(1)}" y="${(y + (h - bh) / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bw / 2).toFixed(1)}" fill="${inSel ? 'url(#grad)' : 'url(#wave)'}"/>`;
    })
    .join('');
}

function selection(x, y, w, h, sel) {
  const sx = x + sel[0] * w;
  const sw = (sel[1] - sel[0]) * w;
  return `<rect x="${sx}" y="${y}" width="${sw}" height="${h}" rx="10" fill="#ff3d7f" fill-opacity=".08" stroke="#ff3d7f" stroke-opacity=".5" stroke-width="2"/>`;
}

const LIT = { 1: 1, 6: 0.55, 8: 0.75, 11: 1, 13: 0.55 };
const KEYS = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V'];

function pads(x, y, size) {
  const gap = size * 0.05;
  const cell = (size - gap * 3) / 4;
  let out = `<g transform="translate(${x} ${y})">`;
  KEYS.forEach((k, i) => {
    const cx = (i % 4) * (cell + gap);
    const cy = Math.floor(i / 4) * (cell + gap);
    const lit = LIT[i];
    out += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="${cell * 0.2}" fill="#1d1d29" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>`;
    if (lit) out += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="${cell * 0.2}" fill="url(#grad)" opacity="${lit}"/>`;
    out += `<text x="${cx + cell * 0.14}" y="${cy + cell * 0.3}" font-family="${MONO}" font-size="${cell * 0.2}" fill="${lit ? '#fff' : '#6b6b80'}" fill-opacity="${lit ? 0.85 : 1}">${k}</text>`;
  });
  return out + '</g>';
}

function chips(x, y, labels, fs) {
  let cx = x;
  const h = fs * 2.1;
  return labels
    .map((l) => {
      const w = l.length * fs * 0.58 + fs * 1.8;
      const s = `<rect x="${cx}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#fff" fill-opacity=".06" stroke="#fff" stroke-opacity=".12"/><text x="${cx + w / 2}" y="${y + h * 0.66}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" font-weight="600" fill="#f2f2f7">${l}</text>`;
      cx += w + fs * 0.7;
      return s;
    })
    .join('');
}

function logo(x, y, s) {
  const c = s * 0.42;
  const o = s - c;
  return `<g transform="translate(${x} ${y})"><rect width="${s}" height="${s}" rx="${s * 0.22}" fill="#16161f" stroke="#fff" stroke-opacity=".1"/><g fill="url(#grad)" transform="translate(${s * 0.08} ${s * 0.08}) scale(.84)"><rect width="${c}" height="${c}" rx="${c * 0.2}"/><rect x="${o}" width="${c}" height="${c}" rx="${c * 0.2}" opacity=".55"/><rect y="${o}" width="${c}" height="${c}" rx="${c * 0.2}" opacity=".55"/><rect x="${o}" y="${o}" width="${c}" height="${c}" rx="${c * 0.2}"/></g></g>`;
}

function frame(w, h, body, glow = [0.8, 0.45]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3d7f"/><stop offset="1" stop-color="#7c5cff"/></linearGradient>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16162a"/><stop offset="1" stop-color="#0b0b10"/></linearGradient>
  <radialGradient id="glow" cx="${glow[0]}" cy="${glow[1]}" r="0.6"><stop offset="0" stop-color="#7c5cff" stop-opacity=".35"/><stop offset="1" stop-color="#7c5cff" stop-opacity="0"/></radialGradient>
  <radialGradient id="glow2" cx="0.05" cy="1" r="0.5"><stop offset="0" stop-color="#ff3d7f" stop-opacity=".18"/><stop offset="1" stop-color="#ff3d7f" stop-opacity="0"/></radialGradient>
  <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b8bff" stop-opacity=".15"/><stop offset=".2" stop-color="#8b8bff" stop-opacity=".6"/><stop offset=".8" stop-color="#8b8bff" stop-opacity=".6"/><stop offset="1" stop-color="#8b8bff" stop-opacity=".15"/></linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
<rect width="${w}" height="${h}" fill="url(#glow2)"/>
${body}
</svg>`;
}

const title = (x, y, fs, anchor = 'start') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${fs}" font-weight="800" fill="#f2f2f7" letter-spacing="${-fs * 0.03}">Simple <tspan fill="url(#grad)">Sample</tspan></text>`;
const text = (x, y, fs, fill, s, { weight = 400, anchor = 'start', family = FONT } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}" font-size="${fs}" font-weight="${weight}" fill="${fill}">${s}</text>`;
const cta = (x, y, w, h, label) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#grad)"/>${text(x + w / 2, y + h * 0.63, h * 0.4, '#fff', label, { weight: 700, anchor: 'middle' })}`;

const SEL = [0.42, 0.58];
const FEATURES = ['Gratis', 'Sin registro', 'Offline', 'MIDI'];

const images = {
  // 1.91:1 — Open Graph (Facebook, LinkedIn, WhatsApp, Slack, Discord), X large card, Google Ads landscape.
  'og-image.png': frame(
    1200,
    630,
    [
      logo(72, 64, 64),
      text(152, 108, 26, '#a4a4b8', 'Sampler web estilo MPC', { weight: 600 }),
      title(68, 228, 96),
      text(72, 290, 34, '#f2f2f7', 'Corta canciones y tócalas en pads'),
      text(72, 334, 34, '#a4a4b8', 'desde el navegador, móvil o MIDI.'),
      chips(72, 372, FEATURES, 22),
      pads(800, 64, 336),
      selection(64, 470, 1072, 110, SEL),
      waveform(76, 478, 1048, 94, 120, SEL),
      text(1136, 610, 18, '#6b6b80', URL_LABEL, { anchor: 'end', family: MONO }),
    ].join(''),
  ),
  // 1:1 — Google Ads square, Meta/Instagram feed ads.
  'og-square.png': frame(
    1200,
    1200,
    [
      logo(80, 80, 72),
      text(172, 128, 30, '#a4a4b8', 'Sampler web estilo MPC', { weight: 600 }),
      title(76, 300, 132),
      text(82, 380, 44, '#f2f2f7', 'Corta canciones y tócalas'),
      text(82, 438, 44, '#a4a4b8', 'en pads, sin instalar nada.'),
      chips(82, 486, FEATURES, 26),
      pads(82, 600, 400),
      selection(540, 640, 580, 320, SEL),
      waveform(556, 660, 548, 280, 56, SEL),
      cta(82, 1060, 560, 72, 'Pruébalo gratis →'),
      text(1120, 1106, 24, '#6b6b80', URL_LABEL, { anchor: 'end', family: MONO }),
    ].join(''),
    [0.85, 0.6],
  ),
  // 9:16 — Stories / Reels / Shorts ads.
  'og-story.png': frame(
    1080,
    1920,
    [
      logo(484, 240, 112),
      title(540, 520, 136, 'middle'),
      text(540, 610, 50, '#f2f2f7', 'Corta canciones y tócalas', { anchor: 'middle' }),
      text(540, 676, 50, '#a4a4b8', 'en pads estilo MPC', { anchor: 'middle' }),
      selection(80, 750, 920, 200, SEL),
      waveform(96, 766, 888, 168, 64, SEL),
      pads(270, 1010, 540),
      cta(240, 1610, 600, 96, 'Pruébalo gratis →'),
      text(540, 1770, 30, '#6b6b80', URL_LABEL, { anchor: 'middle', family: MONO }),
    ].join(''),
    [0.5, 0.55],
  ),
  // iOS home screen icon (180×180, no transparency).
  'apple-touch-icon.png': `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3d7f"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs><rect width="180" height="180" fill="#0b0b10"/><g fill="url(#grad)"><rect x="34" y="34" width="49" height="49" rx="10"/><rect x="97" y="34" width="49" height="49" rx="10" opacity=".55"/><rect x="34" y="97" width="49" height="49" rx="10" opacity=".55"/><rect x="97" y="97" width="49" height="49" rx="10"/></g></svg>`,
};

const fontDir = process.env.OG_FONT_DIR;
const fontFiles = fontDir ? readdirSync(fontDir).filter((f) => f.endsWith('.ttf')).map((f) => join(fontDir, f)) : [];

mkdirSync(OUT, { recursive: true });
for (const [name, svg] of Object.entries(images)) {
  const png = new Resvg(svg, {
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: 'Inter' },
  })
    .render()
    .asPng();
  writeFileSync(join(OUT, name), png);
  console.log(`public/social/${name} (${(png.length / 1024).toFixed(0)} KB)`);
}
