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
  light: { ink: '#111111', muted: '#5f6362', line: '#e3e4e2', panel: '#ffffff', track: '#efefed', accent: '#f5c842', onAccent: '#111111',
    heat: ['#efefed', '#fbe9a8', '#f5c842', '#d19e12', '#7a5a00'] },
  dark: { ink: '#ececea', muted: '#9da3a1', line: '#30363d', panel: '#0d1117', track: '#21262d', accent: '#f5c842', onAccent: '#111111',
    heat: ['#1c2128', '#4a3c10', '#8a6c18', '#c99e2a', '#f5c842'] },
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

const days = stats.weeks.flat();
const activeDays = days.filter((d) => d.contributionCount).length;
const top = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0]);
const busiest = (([y, m, d]) => `${MONTHS[+m - 1]} ${+d}, ${y}`)(top.date.split('-'));
const streak = { current: 0, longest: 0 };
{
  let run = 0;
  for (const d of days) { run = d.contributionCount ? run + 1 : 0; streak.longest = Math.max(streak.longest, run); }
  // Today without contributions yet doesn't break the streak.
  let i = days.length - 1;
  if (!days[i].contributionCount) i--;
  while (i >= 0 && days[i].contributionCount) { streak.current++; i--; }
}

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

const label = (x, y, str, t) => text('monoMed', 12.5, x, y, str.toUpperCase(), t.ink, { ls: 1.1 });

// ---------- components (each returns { w, h, body }) ----------

const R = 10, PAD = 24;
const panel = (t, h, w = W) =>
  `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${R}" fill="${t.panel}" stroke="${t.line}"/>`;
// Panel title: small yellow tick + mono caps, optional right-aligned note.
function panelTitle(t, str, note, w = W) {
  let b = `<rect x="${PAD}" y="${PAD + 1}" width="3" height="12" fill="${t.accent}"/>` + label(PAD + 12, PAD + 12, str, t);
  if (note) b += text('mono', 12.5, w - PAD, PAD + 12, note, t.muted, { anchor: 'end' });
  return b;
}

function header(t) {
  const h = 92;
  let b = logoMark(0, 18, 50, t.ink);
  b += text('display', 30, 52, 50, stats.login, t.ink, { ls: -0.6 });
  b += text('mono', 13, 54, 74, `github.com/${stats.login} · on GitHub since ${MONTHS[since.getUTCMonth()]} ${since.getUTCFullYear()}`, t.muted);
  const pill = `updated ${today}`, pw = measure('mono', 12, pill) + 38;
  b += `<rect x="${W - pw + 0.5}" y="29.5" width="${pw - 1}" height="27" rx="13.5" fill="none" stroke="${t.line}"/>`;
  b += `<circle cx="${W - pw + 13}" cy="43" r="3.5" fill="${t.accent}"/>`;
  b += text('mono', 12, W - 12, 47, pill, t.muted, { anchor: 'end' });
  return { w: W, h, body: b };
}

function statGrid(t) {
  const items = [
    { k: 'Contributions', v: fmt(stats.contributions), sub: `last 12 months` },
    { k: 'Commits', v: fmt(stats.commits), sub: `public, +${fmt(stats.privateContributions)} private` },
    { k: 'Active days', v: fmt(activeDays), sub: `of the last ${days.length}` },
    { k: 'Repositories', v: fmt(stats.repos.length), sub: `${publicRepos.length} public · ${stats.repos.length - publicRepos.length} private` },
    { k: 'Current streak', v: `${streak.current}d`, sub: streak.current ? 'consecutive days' : 'starts today' },
    { k: 'Longest streak', v: `${streak.longest}d`, sub: 'last 12 months' },
    { k: 'Study repos', v: fmt(studyRepos.length), sub: `${trackRows.length} tracks, one per topic` },
    { k: 'On GitHub', v: `${years} yrs`, sub: `since ${MONTHS[since.getUTCMonth()]} ${since.getUTCFullYear()}` },
  ];
  const cols = 4, cw = (W - PAD * 2) / cols, rh = 92, top = 54;
  let b = '';
  items.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = PAD + col * cw, y = top + row * rh;
    if (col) b += `<rect x="${x - 0.5}" y="${y + 6}" width="1" height="${rh - 22}" fill="${t.line}"/>`;
    const ix = x + (col ? 18 : 0);
    b += text('mono', 11.5, ix, y + 18, it.k.toUpperCase(), t.muted, { ls: 0.9 });
    b += text('display', 32, ix, y + 54, it.v, t.ink, { ls: -0.64 });
    b += text('body', 13, ix, y + 74, ellipsize('body', 13, it.sub, cw - 24), t.muted);
  });
  b += hline(top + rh - 6, PAD, W - PAD, t.line);
  const h = top + rh * 2 + 10;
  return { w: W, h, body: panel(t, h) + panelTitle(t, 'Overview') + b };
}

function heatmap(t) {
  const cell = 11, gap = 3, step = cell + gap, left = PAD + 32, top = 76;
  const weeks = stats.weeks;
  const gridW = weeks.length * step - gap;
  const x0 = left + (W - PAD - left - gridW);
  let b = '';
  const max = Math.max(...days.map((d) => d.contributionCount), 1);
  // Quartiles of non-zero days, like GitHub, so one huge day doesn't wash out the rest.
  const nz = days.map((d) => d.contributionCount).filter(Boolean).sort((a, b) => a - b);
  const q = [0.25, 0.5, 0.75].map((p) => nz[Math.floor(p * (nz.length - 1))] ?? max);
  const level = (n) => (!n ? 0 : n <= q[0] ? 1 : n <= q[1] ? 2 : n <= q[2] ? 3 : 4);
  let lastMonth = null;
  weeks.forEach((w, i) => {
    const x = x0 + i * step;
    const m = w[0].date.slice(5, 7);
    if (m !== lastMonth && i < weeks.length - 2 && new Date(w[0].date).getUTCDate() <= 7) {
      b += text('mono', 11, x, top - 10, MONTHS[+m - 1], t.muted);
    }
    lastMonth = m;
    for (const d of w) {
      b += `<rect x="${x}" y="${top + d.weekday * step}" width="${cell}" height="${cell}" rx="2.5" fill="${t.heat[level(d.contributionCount)]}"/>`;
    }
  });
  ['Mon', 'Wed', 'Fri'].forEach((dn, i) => { b += text('mono', 11, PAD, top + (1 + i * 2) * step + 9, dn, t.muted); });
  const by = top + 7 * step + 22;
  b += text('body', 13, PAD, by + 9, `${fmt(stats.contributions)} contributions · busiest day ${fmt(max)} on ${busiest}`, t.muted);
  const lx = W - PAD - 5 * step - measure('mono', 11, 'More') - 8;
  b += text('mono', 11, lx - 8, by + 9, 'Less', t.muted, { anchor: 'end' });
  t.heat.forEach((c, i) => { b += `<rect x="${lx + i * step}" y="${by}" width="${cell}" height="${cell}" rx="2.5" fill="${c}"/>`; });
  b += text('mono', 11, lx + 5 * step + 5, by + 9, 'More', t.muted);
  const h = by + 34;
  return { w: W, h, body: panel(t, h) + panelTitle(t, 'Contributions', 'last 12 months') + b };
}

function languagesPanel(t) {
  const cols = 2, colGap = 40, cw = (W - PAD * 2 - colGap) / cols, rh = 44, top = 58;
  const max = languages[0].share;
  let b = '';
  languages.forEach((l, i) => {
    const col = Math.floor(i / Math.ceil(languages.length / cols)), row = i % Math.ceil(languages.length / cols);
    const x = PAD + col * (cw + colGap), y = top + row * rh;
    b += langIcon(l.name, x, y, 16, t);
    b += text('bodyBold', 14.5, x + 26, y + 13, l.name, t.ink);
    b += text('mono', 12.5, x + cw, y + 13, `${(l.share * 100).toFixed(1)}%`, t.muted, { anchor: 'end' });
    b += `<rect x="${x}" y="${y + 24}" width="${cw}" height="5" rx="2.5" fill="${t.track}"/>`;
    b += `<rect x="${x}" y="${y + 24}" width="${Math.max(5, (l.share / max) * cw)}" height="5" rx="2.5" fill="${i ? t.ink : t.accent}"/>`;
  });
  const h = top + Math.ceil(languages.length / cols) * rh + 10;
  const note = otherShare > 0 ? `all owned repos · other ${(otherShare * 100).toFixed(1)}%` : 'all owned repos';
  return { w: W, h, body: panel(t, h) + panelTitle(t, 'Languages', note) + b };
}

function topicsPanel(t) {
  const top = 54, ch = 34, gap = 10;
  let x = PAD, y = top, b = '';
  for (const r of trackRows) {
    const nw = measure('monoMed', 12.5, String(r.count)) + 16;
    const w = 14 + measure('bodyBold', 14, r.name) + 10 + nw + 4;
    if (x + w > W - PAD) { x = PAD; y += ch + gap; }
    b += `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${ch - 1}" rx="${ch / 2}" fill="none" stroke="${t.line}"/>`;
    b += text('bodyBold', 14, x + 14, y + 22, r.name, t.ink);
    const nx = x + w - nw - 4;
    b += `<rect x="${nx}" y="${y + 4}" width="${nw}" height="${ch - 8}" rx="${(ch - 8) / 2}" fill="${t.accent}"/>`;
    b += text('monoMed', 12.5, nx + nw / 2, y + 21.5, String(r.count), t.onAccent, { anchor: 'middle' });
    x += w + gap;
  }
  const h = y + ch + PAD;
  return { w: W, h, body: panel(t, h) + panelTitle(t, 'Study repositories', `${studyRepos.length} repos · one per topic`) + b };
}

const sectionLabel = (t, str) => ({ w: W, h: 34, body: `<rect x="0" y="13" width="3" height="12" fill="${t.accent}"/>` + label(12, 24, str, t) });

function repoCard(t, r) {
  const h = 64;
  let b = panel(t, h);
  const lang = r.primaryLanguage?.name;
  const pushed = new Date(r.pushedAt);
  const right = 230;
  const desc = r.description?.trim();
  b += text('display', 16.5, PAD, desc ? 28 : 38, ellipsize('display', 16.5, r.name, W - right - PAD * 2), t.ink, { ls: -0.33 });
  if (desc) b += text('body', 13.5, PAD, 48, ellipsize('body', 13.5, desc, W - right - PAD * 2), t.muted);
  const when = `${MONTHS[pushed.getUTCMonth()]} ${pushed.getUTCDate()}, ${pushed.getUTCFullYear()}`;
  b += text('mono', 12, W - PAD, 38, when, t.muted, { anchor: 'end' });
  if (lang) {
    const name = c.languageAliases[lang] ?? lang;
    const rx = W - PAD - measure('mono', 12, when) - 24;
    b += text('mono', 12, rx, 38, name, t.ink, { anchor: 'end' });
    b += langIcon(name, rx - measure('mono', 12, name) - 22, 26, 15, t);
  }
  return { w: W, h, body: b };
}

function linkChip(t, { icon: name, text: str }) {
  const size = 14, w = 14 + 16 + 9 + measure('bodyBold', size, str) + 16, h = 38;
  const glyph = name === 'logo' ? logoMark(16, 11, 16, t.ink) : icon(name, 14, 11, 16, t.ink);
  const body = `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${h / 2}" fill="${t.panel}" stroke="${t.line}"/>` +
    glyph + text('bodyBold', size, 39, 24, str, t.ink);
  return { w, h, body };
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
await emit('overview', statGrid);
await emit('contributions', heatmap);
await emit('languages', languagesPanel);
await emit('topics', topicsPanel);
await emit('recent-head', (t) => sectionLabel(t, 'Recently pushed'));
const recentFiles = [];
for (const r of recent) recentFiles.push({ r, file: await emit(`repo-${r.name.toLowerCase()}`, (t) => repoCard(t, r)) });
await emit('links-head', (t) => sectionLabel(t, 'Find me elsewhere'));
for (const l of c.links) await emit(`link-${l.id}`, (t) => linkChip(t, l));

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

// The panels are images, so the same numbers also ship as collapsible tables.
const readme = `<!-- Generated by \`npm run build\` from the GitHub API and src/content.mjs. Do not edit by hand. -->

<p>
${linked(`https://github.com/${stats.login}`, 'header', `${stats.login}, on GitHub since ${since.getUTCFullYear()}. Updated ${today}.`)}
</p>

<p>
${pic('overview', `${stats.contributions} contributions and ${stats.commits} commits in the last 12 months, ${activeDays} active days, current streak ${streak.current} days, longest ${streak.longest} days, ${stats.repos.length} repositories, ${studyRepos.length} study repositories, ${years} years on GitHub.`)}
</p>

<p>
${pic('contributions', `Contribution calendar: ${stats.contributions} contributions in the last 12 months.`)}
</p>

<p>
${pic('languages', languages.map((l) => `${l.name} ${pct(l.share)}`).join(', '))}
</p>

<p>
${pic('topics', trackRows.map((r) => `${r.name}: ${r.count}`).join(', '))}
</p>

<p>
${pic('recent-head', 'Recently pushed')}<br>
${recentFiles.map(({ r, file }) => linked(r.url, file, `${r.name}: ${r.description ?? ''}`)).join('<br>\n')}
</p>

<p>
${pic('links-head', 'Find me elsewhere')}<br>
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
`;

await writeFile(new URL('README.md', ROOT), readme);
console.log(`${files.length} SVGs + README.md`);
