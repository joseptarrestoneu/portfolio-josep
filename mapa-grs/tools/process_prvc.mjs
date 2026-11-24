// Afegeix els PR de la Comunitat Valenciana (raw_prvc/) a senders.json (estat publicat del mapa).
// Reutilitza la projecció de base.mjs i les funcions del pipeline original (chain, dp, hav, ccOf).
import fs from 'fs';
import * as d3 from 'd3-geo';
import { project, feats } from './base.mjs';

const FEMECV = 'https://senders.femecv.com/es/senderos/index';
const rels = new Map();
for (const f of fs.readdirSync('raw_prvc').sort()) for (const r of JSON.parse(fs.readFileSync('raw_prvc/' + f, 'utf8'))) rels.set(r.id, r);
console.log('relacions amb geometria', rels.size);

// ref normalitzat: PR-CV 24, PR-CV 24.1, PR-V 10
const normPR = (r) => { const m = /\bPR[ -]?(CV|V)[ -]?(\d+)(?:\.(\d+))?/i.exec(r || ''); return m ? 'PR-' + m[1].toUpperCase() + ' ' + m[2] + (m[3] ? '.' + m[3] : '') : null; };
const parentOf = new Map(); for (const r of rels.values()) for (const s of r.sub || []) parentOf.set(s, r);
const groups = new Map();
for (const r of rels.values()) {
  const t = r.tags || {};
  let ref = normPR(t.ref); if (!ref && parentOf.has(r.id)) ref = normPR((parentOf.get(r.id).tags || {}).ref);
  if (!ref) continue;
  if (!r.ways.length) continue;
  const key = 'pr:' + ref;
  if (!groups.has(key)) groups.set(key, { key, ref, rels: [] });
  groups.get(key).rels.push(r);
}
console.log('grups', groups.size);

const R = 6371;
const hav = (a, b) => { const dl = (b[0] - a[0]) * Math.PI / 180, dn = (b[1] - a[1]) * Math.PI / 180; const x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [i, j] = st.pop(); let md = 0, mi = -1;
    const [ay, ax] = pts[i], [by, bx] = pts[j]; const dx = bx - ax, dy = by - ay; const L = dx * dx + dy * dy;
    for (let k = i + 1; k < j; k++) {
      const [py, px] = pts[k]; let d;
      if (L === 0) d = Math.hypot(px - ax, py - ay);
      else { let u = ((px - ax) * dx + (py - ay) * dy) / L; u = Math.max(0, Math.min(1, u)); d = Math.hypot(px - (ax + u * dx), py - (ay + u * dy)); }
      if (d > md) { md = d; mi = k; }
    }
    if (md > eps) { keep[mi] = 1; st.push([i, mi], [mi, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const key = (p) => p[0].toFixed(4) + ',' + p[1].toFixed(4);
function chain(ways) {
  const used = new Array(ways.length).fill(false); const idx = new Map();
  ways.forEach((w, i) => { for (const p of [w[0], w[w.length - 1]]) { const k = key(p); if (!idx.has(k)) idx.set(k, []); idx.get(k).push(i); } });
  const out = [];
  for (let s = 0; s < ways.length; s++) {
    if (used[s]) continue; used[s] = true; let line = ways[s].slice();
    for (let dir = 0; dir < 2; dir++) {
      for (;;) {
        const endp = line[line.length - 1]; const cand = (idx.get(key(endp)) || []).find((i) => !used[i]);
        if (cand == null) break; used[cand] = true;
        const w = ways[cand]; const fwd = key(w[0]) === key(endp);
        line = line.concat((fwd ? w : w.slice().reverse()).slice(1));
      }
      line.reverse();
    }
    out.push(line);
  }
  return out;
}
const featBB = feats.map((f) => ({ id: f.id, f, b: d3.geoBounds(f) }));
function ccOf(lat, lon) {
  for (const { id, f, b } of featBB) {
    if (lon < b[0][0] || lon > b[1][0] || lat < b[0][1] || lat > b[1][1]) continue;
    if (d3.geoContains(f, [lon, lat])) return id;
  }
  return null;
}

const clean0 = (n) => String(n || '').replace(/^\s*(GR|E|PR[ -]?[A-Z]{0,2})[ -]?\d+(\.\d+)?\s*[:\-–.]?\s*/i, '').replace(/\s*[-–:,.]?\s*(Etapa|Tram|Tramo|Stage)\s*\d+.*$/i, '').trim();

const out = [];
for (const g of groups.values()) {
  const seen = new Set(); const ways = [];
  for (const r of g.rels) for (const w of r.ways) { const k = key(w[0]) + '|' + key(w[w.length - 1]) + '|' + w.length; if (seen.has(k)) continue; seen.add(k); ways.push(w); }
  if (!ways.length) continue;
  const lines = chain(ways).map((l) => dp(l, 0.0007)).filter((l) => l.length > 1);
  let km = 0; for (const w of ways) for (let i = 1; i < w.length; i++) km += hav(w[i - 1], w[i]);
  const cnt = {}; let ns = 0;
  for (const l of lines) { const step = Math.max(1, Math.floor(l.length / 25)); for (let i = 0; i < l.length; i += step) { const c = ccOf(l[i][0], l[i][1]); ns++; if (c) cnt[c] = (cnt[c] || 0) + 1; } }
  const cc = Object.entries(cnt).filter(([, n]) => n >= 2 && n / ns >= 0.04).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; let d = '';
  for (const l of lines) {
    const pts = l.map(([la, lo]) => project(la, lo));
    let prev = null; let seg = '';
    pts.forEach((p) => { const x = Math.round(p[0] * 10) / 10, y = Math.round(p[1] * 10) / 10; if (prev && prev[0] === x && prev[1] === y) return; seg += (seg ? 'L' : 'M') + x + ',' + y; prev = [x, y]; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    d += seg;
  }
  const tags = g.rels.map((r) => r.tags || {});
  const names = g.rels.map((r) => ({ n: clean0((r.tags || {}).name), exact: normPR((r.tags || {}).ref) === g.ref })).filter((x) => x.n);
  const cn = {}; names.forEach((x) => { cn[x.n] = (cn[x.n] || 0) + (x.exact ? 3 : 1); });
  const nom = Object.entries(cn).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] || '';
  const most = (k) => { const c = {}; tags.forEach((t) => { if (t[k]) c[t[k]] = (c[t[k]] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]; };
  const distTags = tags.map((t) => parseFloat(String(t.distance || '').replace(',', '.'))).filter((n) => n > 0);
  out.push({
    id: g.key.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, ''),
    t: 'pr', ref: g.ref, nom, bk: 0, web: FEMECV, from: most('from') || '', to: most('to') || '',
    cc, co: [], km: Math.round(km), kmOsm: g.rels.length === 1 && distTags.length === 1 ? Math.round(distTags[0]) : null,
    eu: [], wp: most('wikipedia') || '', op: most('operator') || '',
    osm: g.rels.map((r) => r.id), inc: 0, n: g.rels.length, can: 0,
    bb: [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)], d,
  });
}
const SD = JSON.parse(fs.readFileSync('senders.json', 'utf8')).filter((s) => !(s.t === 'pr' && /^PR-(CV|V)\b/.test(s.ref)));
const all = SD.concat(out);
all.sort((a, b) => (a.t > b.t ? 1 : a.t < b.t ? -1 : a.ref.localeCompare(b.ref, 'en', { numeric: true })));
fs.writeFileSync('senders_new.json', JSON.stringify(all));
const ccs = {}; out.forEach((s) => s.cc.forEach((c) => { ccs[c] = (ccs[c] || 0) + 1; }));
console.log('PR nous', out.length, 'total', all.length, 'km', out.reduce((a, s) => a + s.km, 0), 'cc', ccs, 'sense nom', out.filter((s) => !s.nom).length, 'sense cc', out.filter((s) => !s.cc.length).length);
