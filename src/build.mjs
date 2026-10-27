// Generates assets/*.svg (light and dark) and README.md from src/content.mjs.
// GitHub strips CSS from READMEs, so the site's identity lives inside SVGs:
// fonts are subset from Google Fonts and embedded, text is measured with
// opentype.js so wrapping and boxes match the real glyphs.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import opentype from 'opentype.js';
import * as c from './content.mjs';
import { icons } from './icons.mjs';

const ROOT = new URL('../', import.meta.url);
const W = 840;

// Same tokens as igorbarral.com.br/style.css; dark is derived for GitHub's dark theme.
const themes = {
  light: { ink: '#111111', muted: '#5f6362', line: '#e6e6e6', accent: '#f5c842', onAccent: '#111111' },
  dark: { ink: '#ececea', muted: '#9da3a1', line: '#30363d', accent: '#f5c842', onAccent: '#111111' },
};

const FONTS = {
  display: { family: 'Space Grotesk', weight: 700 },
  body: { family: 'IBM Plex Sans', weight: 400 },
  bodyBold: { family: 'IBM Plex Sans', weight: 600 },
  mono: { family: 'IBM Plex Mono', weight: 400 },
  monoMed: { family: 'IBM Plex Mono', weight: 500 },
};

// ---------- fonts ----------

async function fetchTtf(key, text) {
  const { family, weight } = FONTS[key];
  let url = `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@${weight}`;
  if (text) url += `&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const src = css.match(/src: url\((.+?)\) format\('truetype'\)/)?.[1];
  if (!src) throw new Error(`No TTF for ${family} ${weight}:\n${css}`);
  return Buffer.from(await (await fetch(src)).arrayBuffer());
}

const metrics = {};
const used = Object.fromEntries(Object.keys(FONTS).map((k) => [k, new Set()]));

for (const key of Object.keys(FONTS)) {
  const buf = await fetchTtf(key);
  metrics[key] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const measure = (font, size, str, ls = 0) => metrics[font].getAdvanceWidth(str, size) + ls * str.length;

function wrap(font, size, str, max) {
  const lines = [];
  let cur = '';
  for (const word of str.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(font, size, next) > max) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- svg primitives ----------

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function text(font, size, x, y, str, fill, { ls = 0, anchor } = {}) {
  for (const ch of str) used[font].add(ch);
  const extra = (ls ? ` letter-spacing="${ls}"` : '') + (anchor ? ` text-anchor="${anchor}"` : '');
  return `<text class="${font}" x="${x}" y="${y}" font-size="${size}" fill="${fill}"${extra}>${esc(str)}</text>`;
}

const hline = (y, x1, x2, color) => `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="1" fill="${color}"/>`;

// The "B" mark: the yellow I is the stem of the B.
const logoMark = (x, y, h, ink) =>
  `<svg x="${x}" y="${y}" height="${h}" width="${h * 0.7}" viewBox="0 0 70 100"><rect width="16" height="100" fill="#f5c842"/><path d="M16 7H36A21.5 21.5 0 0 1 36 50H16M16 50H40A21.5 21.5 0 0 1 40 93H16" fill="none" stroke="${ink}" stroke-width="14"/></svg>`;

const icon = (name, x, y, size, fill) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${icons[name]}" fill="${fill}"/></svg>`;

const logoCache = {};
async function projectLogo(file, x, y, size, theme, t) {
  logoCache[file] ??= await readFile(new URL(`src/logos/${file}`, ROOT), 'utf8');
  let svg = logoCache[file];
  if (theme === 'dark') {
    // Dark ink would vanish on GitHub's dark background: swap ink for light,
    // and solid dark shapes (IB Link Guard shield) become yellow with dark strokes.
    if (svg.includes('#20221c')) svg = svg.replaceAll('#f5c842', '#111111').replaceAll('#20221c', t.accent);
    else svg = svg.replaceAll('#111111', t.ink);
  }
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMinYMid meet" `);
}

function tag(x, baseline, str, t) {
  const size = 11.5, padX = 7;
  const w = measure('monoMed', size, str) + padX * 2;
  return {
    w,
    svg: `<rect x="${x}" y="${baseline - 13}" width="${w}" height="18" fill="${t.accent}"/>` +
      text('monoMed', size, x + padX, baseline, str, t.onAccent),
  };
}

const label = (x, y, str, t) => text('mono', 13, x, y, str.toUpperCase(), t.muted, { ls: 1.04 });

// ---------- components (each returns { w, h, body }) ----------

function hero(t) {
  const { label: lab, title, text: p } = c.hero;
  let b = logoMark(0, 14, 36, t.ink) + text('display', 20, 36, 39, 'igor barral', t.ink);
  const host = 'igorbarral.com.br';
  const hw = measure('mono', 13, host) + 16;
  b += `<rect x="${W - hw - 0.5}" y="20.5" width="${hw}" height="23" fill="none" stroke="${t.ink}"/>` +
    text('mono', 13, W - hw / 2 - 0.5, 36.5, host, t.ink, { anchor: 'middle' });
  b += hline(64, 0, W, t.line);

  b += label(0, 128, lab, t);
  const size = 52, y1 = 196, y2 = 254;
  b += text('display', size, 0, y1, title[0], t.ink, { ls: -1.04 });
  const markW = measure('display', size, title[1], -1.04);
  // Light ink over the low highlight is unreadable, so dark mode marks the whole line.
  const full = t.ink !== t.onAccent;
  b += full
    ? `<rect x="-6" y="${y2 - 44}" width="${markW + 14}" height="58" fill="${t.accent}"/>`
    : `<rect x="-2" y="${y2 - 9}" width="${markW + 6}" height="21" fill="${t.accent}"/>`;
  b += text('display', size, 0, y2, title[1], full ? t.onAccent : t.ink, { ls: -1.04 });

  let y = y2 + 52;
  for (const line of wrap('body', 19, p, 620)) { b += text('body', 19, 0, y, line, t.muted); y += 30; }
  return { w: W, h: y + 26, body: b };
}

// "What I build": the site's two-column section (label left, list right).
function buildList(t) {
  const col = 170;
  let b = hline(0, 0, W, t.line) + label(0, 58, c.build.label, t);
  let y = 32;
  for (const item of c.build.items) {
    b += hline(y, col, W, t.line);
    b += text('display', 18, col, y + 34, item.title, t.ink, { ls: -0.36 });
    b += text('body', 16, col, y + 60, item.text, t.muted);
    y += 82;
  }
  b += hline(y, col, W, t.line);
  return { w: W, h: y + 40, body: b };
}

function sectionHead(t, { label: lab, title, intro }) {
  let b = hline(0, 0, W, t.line) + label(0, 58, lab, t);
  let y = 58;
  if (title) { y += 46; b += text('display', 26, 0, y, title, t.ink, { ls: -0.52 }); }
  if (intro) { y += 34; b += text('body', 17, 0, y, intro, t.muted); }
  return { w: W, h: y + 26, body: b };
}

async function row(t, theme, item) {
  const x = 60, top = 20;
  let b = hline(0, 0, W, t.line);
  b += item.logo ? await projectLogo(item.logo, 0, top + 2, 40, theme, t) : icon(item.icon, 4, top + 6, 30, t.ink);

  let y = top + 20;
  b += text('display', 18, x, y, item.title, t.ink, { ls: -0.36 });
  if (item.tag) b += tag(x + measure('display', 18, item.title, -0.36) + 10, y - 1, item.tag, t).svg;

  for (const line of wrap('body', 16, item.text, W - x - 40)) { y += 26; b += text('body', 16, x, y, line, t.muted); }
  if (item.meta) {
    y += 24;
    const meta = item.icon ? `${item.meta} →` : item.meta;
    b += text('mono', 12.5, x, y, meta, t.muted);
  }
  b += text('display', 20, W - 4, top + 20, '↗', t.muted, { anchor: 'end' });
  return { w: W, h: y + 22, body: b };
}

// Primary button with the site's hard shadow (its hover state, frozen).
function button(t, str) {
  const size = 17, padX = 22;
  const w = measure('bodyBold', size, str) + padX * 2 + 4;
  const body = `<rect x="5" y="5" width="${w - 4}" height="50" fill="${t.ink}"/>` +
    `<rect x="1" y="1" width="${w - 4}" height="50" fill="${t.accent}" stroke="${t.ink}" stroke-width="2"/>` +
    text('bodyBold', size, 1 + (w - 4) / 2, 32, str, t.onAccent, { anchor: 'middle' });
  return { w: w + 6, h: 60, body };
}

function textLink(t, str) {
  const w = measure('bodyBold', 17, str);
  const body = text('bodyBold', 17, 4, 32, str, t.ink) + `<rect x="4" y="38" width="${w}" height="2" fill="${t.accent}"/>`;
  return { w: w + 8, h: 60, body };
}

function socialButton(t, { icon: name, text: str }) {
  const size = 15, w = 14 + 18 + 8 + measure('bodyBold', size, str) + 14;
  const body = `<rect x="0.5" y="0.5" width="${w}" height="39" fill="none" stroke="${t.line}"/>` +
    icon(name, 14.5, 11.5, 18, t.ink) + text('bodyBold', size, 40.5, 25.5, str, t.ink);
  return { w: w + 1, h: 41, body };
}

function foot(t) {
  const body = hline(0, 0, W, t.line) + text('body', 14.5, 0, 40, c.footer, t.muted) +
    logoMark(W - 14, 25, 20, t.ink);
  return { w: W, h: 64, body };
}

// ---------- output ----------

const files = [];
const assets = new URL('assets/', ROOT);

async function emit(name, render) {
  for (const theme of Object.keys(themes)) {
    const { w, h, body } = await render(themes[theme], theme);
    files.push({ path: `${name}-${theme}.svg`, w, h, body });
  }
  return name;
}

const heroId = await emit('hero', hero);
const buildId = await emit('build', buildList);
const projectsHead = await emit('projects', (t) => sectionHead(t, c.projects));
const projectRows = [];
for (const p of c.projects.items) projectRows.push({ ...p, file: await emit(`project-${p.id}`, (t, th) => row(t, th, p)) });
const channelsHead = await emit('channels', (t) => sectionHead(t, c.channels));
const channelRows = [];
for (const ch of c.channels.items) channelRows.push({ ...ch, file: await emit(`channel-${ch.id}`, (t, th) => row(t, th, ch)) });
const socials = [];
for (const s of c.channels.social) socials.push({ ...s, file: await emit(`social-${s.id}`, (t) => socialButton(t, s)) });
const contactHead = await emit('contact', (t) => sectionHead(t, c.contact));
const contactBtn = await emit('contact-button', (t) => button(t, c.contact.button.text));
const contactLink = await emit('contact-link', (t) => textLink(t, c.contact.link.text));
const footId = await emit('footer', foot);

// Embed one subset per font, covering every glyph used across all SVGs.
const faces = {};
for (const [key, chars] of Object.entries(used)) {
  if (!chars.size) continue;
  const ttf = await fetchTtf(key, [...chars].join(''));
  const { family, weight } = FONTS[key];
  faces[key] = `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${ttf.toString('base64')}) format('truetype')}` +
    `.${key}{font-family:'${family}',${key.startsWith('mono') ? 'monospace' : 'sans-serif'};font-weight:${weight}}`;
}

await rm(assets, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
for (const f of files) {
  const css = Object.keys(faces).filter((k) => f.body.includes(`class="${k}"`)).map((k) => faces[k]).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(f.w)}" height="${Math.ceil(f.h)}" viewBox="0 0 ${Math.ceil(f.w)} ${Math.ceil(f.h)}">` +
    `<style>${css}</style>${f.body}</svg>\n`;
  await writeFile(new URL(f.path, assets), svg);
}

// ---------- README ----------

const pic = (name, alt) =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg"><img src="assets/${name}-light.svg" alt="${esc(alt)}"></picture>`;
const linked = (href, name, alt) => `<a href="${href}">${pic(name, alt)}</a>`;

const readme = `<!-- Generated by \`npm run build\` from src/content.mjs. Do not edit by hand. -->

<p>
${linked(c.site, heroId, `Igor Barral. ${c.hero.label}. ${c.hero.title.join(' ')} ${c.hero.text}`)}
</p>

<p>
${pic(buildId, `${c.build.label}: ${c.build.items.map((i) => `${i.title}, ${i.text}`).join(' ')}`)}
</p>

<p>
${pic(projectsHead, c.projects.label)}<br>
${projectRows.map((p) => linked(p.href, p.file, `${p.title}: ${p.text}`)).join('<br>\n')}
</p>

<p>
${pic(channelsHead, `${c.channels.title}. ${c.channels.intro}`)}<br>
${channelRows.map((ch) => linked(ch.href, ch.file, `YouTube ${ch.title} (${ch.meta}): ${ch.text}`)).join('<br>\n')}
</p>

<p>
${socials.map((s) => linked(s.href, s.file, s.text)).join('&nbsp;\n')}
</p>

<p>
${pic(contactHead, `${c.contact.title} ${c.contact.intro}`)}<br>
${linked(c.contact.button.href, contactBtn, c.contact.button.text)}&nbsp;&nbsp;
${linked(c.contact.link.href, contactLink, c.contact.link.text)}
</p>

<p>
${pic(footId, c.footer)}
</p>
`;

await writeFile(new URL('README.md', ROOT), readme);
console.log(`${files.length} SVGs + README.md`);
