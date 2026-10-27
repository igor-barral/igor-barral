// Generates assets/*.svg (light and dark) and README.md from GitHub data
// (src/data.mjs) and fixed copy (src/content.mjs).
// GitHub strips CSS from READMEs, so the igorbarral.com.br identity lives inside
// SVGs: fonts are subset from Google Fonts and embedded, text is measured with
// opentype.js so wrapping and bars line up with the real glyphs.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import opentype from 'opentype.js';
import * as si from 'simple-icons';
import * as c from './content.mjs';
import { icons } from './icons.mjs';
import { loadStats } from './data.mjs';

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

// ---------- data ----------

const stats = await loadStats();
const today = new Date().toISOString().slice(0, 10);
const fmt = (n) => n.toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const publicRepos = stats.repos.filter((r) => !r.isPrivate);
const studyRepos = stats.repos.filter((r) => /-study$/.test(r.name));
const since = new Date(stats.createdAt);
const years = Math.floor((Date.now() - since) / (365.25 * 864e5));

const langTotals = {};
for (const [name, size] of Object.entries(stats.languages)) {
  const key = c.languageAliases[name] ?? name;
  langTotals[key] = (langTotals[key] ?? 0) + size;
}
const langSum = Object.values(langTotals).reduce((a, b) => a + b, 0);
const langSorted = Object.entries(langTotals).sort((a, b) => b[1] - a[1]);
const languages = langSorted.slice(0, c.topLanguages).map(([name, size]) => ({ name, share: size / langSum }));
const otherShare = langSorted.slice(c.topLanguages).reduce((a, [, s]) => a + s, 0) / langSum;

const tracks = {};
for (const r of studyRepos) {
  const track = r.name.match(/-([a-z]+)-study$/)?.[1];
  if (track) tracks[track] = (tracks[track] ?? 0) + 1;
}
const trackRows = Object.entries(tracks).sort((a, b) => b[1] - a[1])
  .map(([k, n]) => ({ name: c.studyTracks[k] ?? k, count: n }));

const recent = publicRepos.filter((r) => !/-study$/.test(r.name) && r.name !== stats.login).slice(0, c.recentRepos);

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

function ellipsize(font, size, str, max) {
  if (measure(font, size, str) <= max) return str;
  while (str && measure(font, size, `${str}…`) > max) str = str.slice(0, -1);
  return `${str.trimEnd()}…`;
}

// ---------- svg primitives ----------

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function text(font, size, x, y, str, fill, { ls = 0, anchor } = {}) {
  for (const ch of str) used[font].add(ch);
  const extra = (ls ? ` letter-spacing="${ls}"` : '') + (anchor ? ` text-anchor="${anchor}"` : '');
  return `<text class="${font}" x="${x}" y="${y}" font-size="${size}" fill="${fill}"${extra}>${esc(str)}</text>`;
}

const hline = (y, x1, x2, color) => `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="1" fill="${color}"/>`;

// Horizontal bar with a 2px rounded data end; the baseline end stays square.
const hbar = (x, y, w, h, fill) => w <= 0 ? '' :
  `<path d="M${x} ${y}H${x + w - 2}Q${x + w} ${y} ${x + w} ${y + 2}V${y + h - 2}Q${x + w} ${y + h} ${x + w - 2} ${y + h}H${x}Z" fill="${fill}"/>`;
const vbar = (x, y, w, h, fill) => h <= 0 ? '' :
  `<path d="M${x} ${y + h}V${y + 2}Q${x} ${y} ${x + 2} ${y}H${x + w - 2}Q${x + w} ${y} ${x + w} ${y + 2}V${y + h}Z" fill="${fill}"/>`;

// The "B" mark: the yellow I is the stem of the B.
const logoMark = (x, y, h, ink) =>
  `<svg x="${x}" y="${y}" height="${h}" width="${h * 0.7}" viewBox="0 0 70 100"><rect width="16" height="100" fill="#f5c842"/><path d="M16 7H36A21.5 21.5 0 0 1 36 50H16M16 50H40A21.5 21.5 0 0 1 40 93H16" fill="none" stroke="${ink}" stroke-width="14"/></svg>`;

const icon = (name, x, y, size, fill) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${icons[name]}" fill="${fill}"/></svg>`;

// Language icon from simple-icons in ink (identity stays monochrome); initials badge when missing.
function langIcon(name, x, y, size, t) {
  const ico = si[c.languageIcons[name]];
  if (ico) return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${ico.path}" fill="${t.ink}"/></svg>`;
  const initials = name.replace(/[^A-Za-z#+]/g, '').slice(0, 2);
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="${size - 1}" height="${size - 1}" fill="none" stroke="${t.ink}"/>` +
    text('monoMed', size * 0.45, x + size / 2, y + size * 0.66, initials, t.ink, { anchor: 'middle' });
}

const label = (x, y, str, t) => text('mono', 13, x, y, str.toUpperCase(), t.muted, { ls: 1.04 });

// ---------- components (each returns { w, h, body }) ----------

function header(t) {
  let b = logoMark(0, 6, 40, t.ink) + text('display', 24, 40, 36, 'igor barral', t.ink, { ls: -0.48 });
  const [a, mark] = c.header.motto;
  const size = 15, y = 36;
  const markW = measure('bodyBold', size, mark);
  const aW = measure('body', size, `${a} `);
  const x0 = W - markW - aW;
  b += text('body', size, x0, y, `${a} `, t.muted);
  // Light ink over the low highlight is unreadable, so dark mode marks the whole phrase.
  const full = t.ink !== t.onAccent;
  b += full
    ? `<rect x="${W - markW - 4}" y="${y - 15}" width="${markW + 4}" height="21" fill="${t.accent}"/>`
    : `<rect x="${W - markW - 2}" y="${y - 4}" width="${markW + 2}" height="8" fill="${t.accent}"/>`;
  b += text('bodyBold', size, full ? W - markW - 2 : W - markW, y, mark, full ? t.onAccent : t.ink);
  b += hline(64, 0, W, t.line) + label(0, 100, `${c.header.label} · github overview`, t);
  return { w: W, h: 124, body: b };
}

function tiles(t) {
  const items = [
    { k: 'Repositories', v: fmt(stats.repos.length), sub: 'owned, forks excluded' },
    { k: 'Public', v: fmt(publicRepos.length), sub: 'open on GitHub' },
    { k: 'Private', v: fmt(stats.repos.length - publicRepos.length), sub: 'client and product work' },
    { k: 'Contributions', v: fmt(stats.contributions), sub: `last 12 months, ${fmt(stats.privateContributions)} private` },
    { k: 'Study repos', v: fmt(studyRepos.length), sub: `${trackRows.length} tracks, one repo per topic` },
    { k: 'On GitHub', v: `${years} yrs`, sub: `since ${MONTHS[since.getUTCMonth()]} ${since.getUTCFullYear()}` },
  ];
  const gap = 12, cols = 3, tw = (W - gap * (cols - 1)) / cols, th = 116;
  let b = '';
  items.forEach((it, i) => {
    const x = (i % cols) * (tw + gap), y = Math.floor(i / cols) * (th + gap);
    b += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${tw - 1}" height="${th - 1}" fill="none" stroke="${t.line}"/>`;
    b += `<rect x="${x}" y="${y}" width="28" height="4" fill="${t.accent}"/>`;
    b += label(x + 18, y + 32, it.k, t);
    b += text('display', 38, x + 18, y + 76, it.v, t.ink, { ls: -0.76 });
    b += text('body', 13.5, x + 18, y + 100, ellipsize('body', 13.5, it.sub, tw - 36), t.muted);
  });
  return { w: W, h: th * 2 + gap + 2, body: b };
}

function sectionHead(t, lab, title, note) {
  let b = hline(0, 0, W, t.line) + label(0, 52, lab, t);
  let y = 52;
  if (title) { y += 40; b += text('display', 24, 0, y, title, t.ink, { ls: -0.48 }); }
  if (note) { y += 30; b += text('body', 16, 0, y, note, t.muted); }
  return { w: W, h: y + 24, body: b };
}

// Single series, so no legend: every row is direct-labeled with its value.
function barList(t, rows, { iconFor, value, max }) {
  const nameX = iconFor ? 32 : 0, barX = 210, valW = 64, barMax = W - barX - valW;
  const rh = 36;
  let b = '';
  rows.forEach((r, i) => {
    const y = i * rh;
    if (iconFor) b += iconFor(r, 0, y + 7, 20);
    b += text(r.muted ? 'body' : 'bodyBold', 15, nameX, y + 23, r.name, r.muted ? t.muted : t.ink);
    b += hline(y + 17, barX, W - valW, t.line);
    b += hbar(barX, y + 10, Math.max(2, (r.v / max) * barMax), 14, r.muted ? t.muted : t.ink);
    b += text('mono', 13, W, y + 23, value(r), t.ink, { anchor: 'end' });
  });
  return { w: W, h: rows.length * rh + 20, body: b };
}

function languagesChart(t) {
  const rows = languages.map((l) => ({ name: l.name, v: l.share }));
  if (otherShare > 0) rows.push({ name: 'Other', v: otherShare, muted: true });
  return barList(t, rows, {
    iconFor: (r, x, y, s) => r.muted ? '' : langIcon(r.name, x, y, s, t),
    value: (r) => `${(r.v * 100).toFixed(r.v < 0.01 ? 1 : 0)}%`,
    max: rows[0].v,
  });
}

function tracksChart(t) {
  const rows = trackRows.map((r) => ({ name: r.name, v: r.count }));
  return barList(t, rows, { value: (r) => String(r.v), max: rows[0]?.v ?? 1 });
}

function contributionsChart(t) {
  const left = 44, top = 30, ph = 170, pw = W - left;
  const max = Math.max(...stats.months.map(([, n]) => n), 1);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const tick = [1, 2, 5, 10].map((m) => m * step).find((s) => max / s <= 4);
  const yMax = Math.ceil(max / tick) * tick;
  let b = '';
  for (let v = 0; v <= yMax; v += tick) {
    const y = top + ph - (v / yMax) * ph;
    b += hline(Math.round(y), left, W, v === 0 ? t.muted : t.line);
    b += text('mono', 11.5, left - 10, y + 4, fmt(v), t.muted, { anchor: 'end' });
  }
  const slot = pw / stats.months.length, bw = Math.min(36, slot - 12);
  const peak = stats.months.reduce((a, m) => (m[1] > a[1] ? m : a));
  stats.months.forEach(([key, n], i) => {
    const x = left + i * slot + (slot - bw) / 2, h = (n / yMax) * ph;
    b += vbar(x, top + ph - h, bw, h, key === peak[0] ? t.accent : t.ink);
    const [yr, mo] = key.split('-');
    b += text('mono', 11.5, x + bw / 2, top + ph + 20, MONTHS[+mo - 1], t.muted, { anchor: 'middle' });
    if (mo === '01' || i === 0) b += text('mono', 11.5, x + bw / 2, top + ph + 36, yr, t.muted, { anchor: 'middle' });
    // Selective direct labels: the peak and the current month only.
    if (key === peak[0] || i === stats.months.length - 1) {
      b += text('monoMed', 12.5, x + bw / 2, top + ph - h - 8, fmt(n), t.ink, { anchor: 'middle' });
    }
  });
  return { w: W, h: top + ph + 56, body: b };
}

function repoRow(t, r) {
  let b = hline(0, 0, W, t.line);
  const lang = r.primaryLanguage?.name;
  const pushed = new Date(r.pushedAt);
  const meta = `${MONTHS[pushed.getUTCMonth()]} ${pushed.getUTCFullYear()}`;
  const right = 190;
  b += text('display', 17, 0, 32, ellipsize('display', 17, r.name, W - right - 20), t.ink, { ls: -0.34 });
  // Without a description the row collapses to one line: date beside the name.
  const desc = r.description?.trim();
  if (desc) b += text('body', 14.5, 0, 56, ellipsize('body', 14.5, desc, W - right - 20), t.muted);
  const metaX = desc || !lang ? W : W - 150;
  if (lang) {
    const name = c.languageAliases[lang] ?? lang;
    const lw = measure('mono', 12.5, name);
    b += langIcon(name, W - lw - 26, 19, 16, t);
    b += text('mono', 12.5, W, 32, name, t.ink, { anchor: 'end' });
  }
  b += text('mono', 12.5, metaX, desc ? 56 : 32, `pushed ${meta}`, t.muted, { anchor: 'end' });
  return { w: W, h: desc ? 74 : 50, body: b };
}

function linkButton(t, { icon: name, text: str }) {
  const size = 15, w = 14 + 18 + 8 + measure('bodyBold', size, str) + 14;
  const glyph = name === 'logo' ? logoMark(17, 11, 18, t.ink) : icon(name, 14.5, 11.5, 18, t.ink);
  const body = `<rect x="0.5" y="0.5" width="${w}" height="39" fill="none" stroke="${t.line}"/>` +
    glyph + text('bodyBold', size, 40.5, 25.5, str, t.ink);
  return { w: w + 1, h: 41, body };
}

function foot(t) {
  const body = hline(0, 0, W, t.line) +
    text('mono', 12.5, 0, 40, `Updated ${today} · generated from the GitHub API`, t.muted) +
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

await emit('header', header);
await emit('tiles', tiles);
await emit('languages-head', (t) => sectionHead(t, 'Languages', 'What the code is written in', 'Share of code across all owned repositories, public and private.'));
await emit('languages', languagesChart);
await emit('activity-head', (t) => sectionHead(t, 'Activity', `${fmt(stats.contributions)} contributions in the last 12 months`, 'Contributions per month, private repositories included.'));
await emit('activity', contributionsChart);
await emit('study-head', (t) => sectionHead(t, 'Study in public', `${studyRepos.length} study repositories`, 'One repository per topic, grouped by track.'));
await emit('study', tracksChart);
await emit('recent-head', (t) => sectionHead(t, 'Recently pushed', null, null));
const recentFiles = [];
for (const r of recent) recentFiles.push({ r, file: await emit(`repo-${r.name.toLowerCase()}`, (t) => repoRow(t, r)) });
for (const l of c.links) await emit(`link-${l.id}`, (t) => linkButton(t, l));
await emit('footer', foot);

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
const pct = (v) => `${(v * 100).toFixed(1)}%`;

// The charts are images, so the same numbers also ship as collapsible tables.
const readme = `<!-- Generated by \`npm run build\` from the GitHub API and src/content.mjs. Do not edit by hand. -->

<p>
${linked(c.site, 'header', `Igor Barral. ${c.header.label}. ${c.header.motto.join(' ')}`)}
</p>

<p>
${pic('tiles', `${stats.repos.length} repositories: ${publicRepos.length} public, ${stats.repos.length - publicRepos.length} private. ${stats.contributions} contributions in the last 12 months. ${studyRepos.length} study repositories. ${years} years on GitHub.`)}
</p>

<p>
${pic('languages-head', 'Languages')}<br>
${pic('languages', languages.map((l) => `${l.name} ${pct(l.share)}`).join(', '))}
</p>

<p>
${pic('activity-head', 'Activity')}<br>
${pic('activity', stats.months.map(([k, n]) => `${k}: ${n}`).join(', '))}
</p>

<p>
${pic('study-head', 'Study in public')}<br>
${pic('study', trackRows.map((r) => `${r.name}: ${r.count}`).join(', '))}
</p>

<p>
${pic('recent-head', 'Recently pushed')}<br>
${recentFiles.map(({ r, file }) => linked(r.url, file, `${r.name}: ${r.description ?? ''}`)).join('<br>\n')}
</p>

<p>
${c.links.map((l) => linked(l.href, `link-${l.id}`, l.text)).join('&nbsp;\n')}
</p>

<details>
<summary>Data as tables</summary>

| Language | Share |
| --- | ---: |
${languages.map((l) => `| ${l.name} | ${pct(l.share)} |`).join('\n')}
${otherShare > 0 ? `| Other | ${pct(otherShare)} |` : ''}

| Month | Contributions |
| --- | ---: |
${stats.months.map(([k, n]) => `| ${k} | ${n} |`).join('\n')}

| Study track | Repositories |
| --- | ---: |
${trackRows.map((r) => `| ${r.name} | ${r.count} |`).join('\n')}

</details>

<p>
${pic('footer', `Updated ${today}`)}
</p>
`;

await writeFile(new URL('README.md', ROOT), readme);
console.log(`${files.length} SVGs + README.md`);
