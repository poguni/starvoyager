// 북쪽 밤하늘 고정 날짜 후보 찾기(기획서 17장 2번).
// 기준: 서울에서 저녁 8시 무렵 북두칠성과 카시오페이아자리가 북극성을 사이에 두고 좌우(북동·북서)에
//       비슷한 높이로 보이고, 두 별자리의 모든 별이 지평선 위에 있는 날.
// 실행: node scripts/sky-dates.mjs [연도]   → 표(마크다운)와 후보 그림(docs/design-check/phase7/date-*.svg)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { skyPositions, stereographic } from '../src/model/astro.js';
import { CONSTELLATIONS, POLARIS } from '../src/data/constellations.js';

const stars = JSON.parse(readFileSync(new URL('../src/data/stars.json', import.meta.url), 'utf8'));
const year = Number(process.argv[2] ?? 2026);
const dipper = CONSTELLATIONS.find((c) => c.id === 'dipper');
const cas = CONSTELLATIONS.find((c) => c.id === 'cassiopeia');
const pad = (n) => String(n).padStart(2, '0');

// 별자리 별들의 평균 고도·방위, 가장 낮은 별의 고도
function summary(pos, c) {
  const ps = c.stars.map((hr) => pos.get(hr));
  const mean = (k) => ps.reduce((s, p) => s + p[k], 0) / ps.length;
  return { alt: mean('alt'), az: mean('az'), low: Math.min(...ps.map((p) => p.alt)) };
}

const rows = [];
for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 86400000) {
  const d = new Date(t);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const pos = skyPositions(stars, date, 20);
  const D = summary(pos, dipper);
  const C = summary(pos, cas);
  // 저녁 6시 ~ 아침 6시 사이 가장 낮을 때(30분 간격)
  let lowD = 90, lowC = 90;
  for (let h = 18; h <= 30; h += 0.5) {
    const p = skyPositions(stars, date, h);
    lowD = Math.min(lowD, summary(p, dipper).low);
    lowC = Math.min(lowC, summary(p, cas).low);
  }
  const opposite = Math.sign(D.az) !== Math.sign(C.az);
  // 점수: 높이 차이 + 북동·북서(±45°)에서 벗어난 정도. 같은 쪽이거나 지평선 아래 별이 있으면 제외
  const score = Math.abs(D.alt - C.alt) + 0.5 * (Math.abs(Math.abs(D.az) - 45) + Math.abs(Math.abs(C.az) - 45));
  if (opposite && D.low > 0 && C.low > 0 && score < 10) rows.push({ date, D, C, lowD, lowC, score });
}

// 비슷한 날이 몰리므로 30일 안에서는 가장 좋은 하루만 남긴다.
rows.sort((a, b) => a.score - b.score);
const picked = [];
for (const r of rows) {
  if (picked.every((p) => Math.abs(Date.parse(p.date) - Date.parse(r.date)) > 30 * 86400000)) picked.push(r);
  if (picked.length === 3) break;
}

const side = (az) => (az > 0 ? `북동 ${az.toFixed(0)}°` : `북서 ${(-az).toFixed(0)}°`);
console.log('| 날짜 | 북두칠성(저녁 8시) | 카시오페이아자리(저녁 8시) | 지평선 아래 별 | 밤새 가장 낮을 때 고도(북두칠성 / 카시오페이아) |');
console.log('|---|---|---|---|---|');
for (const r of picked) {
  console.log(`| ${r.date} | ${side(r.D.az)}, 고도 ${r.D.alt.toFixed(0)}° | ${side(r.C.az)}, 고도 ${r.C.alt.toFixed(0)}° | 없음 | ${r.lowD.toFixed(0)}° / ${r.lowC.toFixed(0)}° |`);
}

// 후보 그림: 저녁 8시 북쪽 하늘(입체 사영, 가운데 = 북쪽 고도 35°)
mkdirSync(new URL('../docs/design-check/phase7/', import.meta.url), { recursive: true });
for (const r of picked) {
  const pos = skyPositions(stars, r.date, 20);
  const W = 1600, H = 900, S = 520;
  const xy = (p) => { const q = stereographic(p.alt, p.az, 35, 0); return [W / 2 + q.x * S, H / 2 - q.y * S]; };
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#070B1F"/>`];
  const [, hy] = xy({ alt: 0, az: 0 });
  parts.push(`<rect x="0" y="${hy}" width="${W}" height="${H - hy}" fill="#05070F"/>`);
  for (const [hr, p] of pos) {
    if (!p.up) continue;
    const [x, y] = xy(p);
    if (x < 0 || x > W || y < 0 || y > H) continue;
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(0.7, (5 - p.mag) * 0.9).toFixed(1)}" fill="#fff"${hr === POLARIS ? ' stroke="#7C8CF8" stroke-width="3"' : ''}/>`);
  }
  for (const c of CONSTELLATIONS) {
    for (const [a, b] of c.lines) {
      const [x1, y1] = xy(pos.get(a)); const [x2, y2] = xy(pos.get(b));
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7C8CF8" stroke-width="2"/>`);
    }
  }
  for (const [az, t] of [[-45, '북서'], [0, '북'], [45, '북동']]) {
    const [x, y] = xy({ alt: 0, az });
    parts.push(`<text x="${x}" y="${y + 34}" fill="#9aa3c0" font-size="26" text-anchor="middle" font-family="sans-serif">${t}</text>`);
  }
  parts.push(`<text x="24" y="40" fill="#e8ecf6" font-size="26" font-family="sans-serif">${r.date} 저녁 8시</text></svg>`);
  writeFileSync(new URL(`../docs/design-check/phase7/date-${r.date}.svg`, import.meta.url), parts.join('\n'));
}
