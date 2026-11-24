import fs from 'fs';
import * as d3 from 'd3-geo';
import * as topo from 'topojson-client';

const t = JSON.parse(fs.readFileSync('node_modules/es-atlas/es/autonomous_regions.json', 'utf8'));
const obj = t.objects.autonomous_regions;
const ID = { 'Andalucía': 'and', 'Aragón': 'ara', 'Principado de Asturias': 'ast', 'Illes Balears': 'bal', 'Cantabria': 'cnt', 'Castilla y León': 'cyl', 'Castilla-La Mancha': 'clm', 'Cataluña/Catalunya': 'cat', 'Comunitat Valenciana': 'val', 'Extremadura': 'ext', 'Galicia': 'gal', 'Comunidad de Madrid': 'mad', 'Región de Murcia': 'mur', 'Comunidad Foral de Navarra': 'nav', 'País Vasco/Euskadi': 'pv', 'La Rioja': 'rio', 'Ciudad Autónoma de Ceuta': 'ceu', 'Ciudad Autónoma de Melilla': 'mel', 'Canarias': 'can' };
const feats = topo.feature(t, obj).features.filter((f) => ID[f.properties.name]);
feats.forEach((f) => { f.id = ID[f.properties.name]; });
const canF = feats.find((f) => f.id === 'can');
const main = feats.filter((f) => f.id !== 'can');

// Projecció peninsular + Balears (cònica conforme) ajustada al llenç 900x720
const W = 900, H = 720;
const mainProj = d3.geoConicConformal().rotate([3.5, 0]).parallels([36, 44]);
mainProj.fitExtent([[24, 20], [876, 612]], { type: 'FeatureCollection', features: main });
// Canàries: projecció pròpia dins del requadre inferior esquerre
const CAN_BOX = { x: 24, y: 628, w: 236, h: 76 };
const canProj = d3.geoMercator();
canProj.fitExtent([[CAN_BOX.x + 6, CAN_BOX.y + 6], [CAN_BOX.x + CAN_BOX.w - 6, CAN_BOX.y + CAN_BOX.h - 6]], canF);

const mainPath = d3.geoPath(mainProj).digits(1);
const canPath = d3.geoPath(canProj).digits(1);
const pathOf = (f) => (f.id === 'can' ? canPath(f) : mainPath(f));

const out = { W, H, canBox: CAN_BOX, cc: {}, land: '', coast: '', inner: '' };
for (const f of feats) out.cc[f.id] = { name: f.properties.name.split('/')[0], d: pathOf(f) };
out.land = main.map((f) => mainPath(f)).join('') + canPath(canF);
// costa i fronteres interiors a partir de la topologia
const geoms = obj.geometries.filter((g) => ID[g.properties.name]);
const isCan = (g) => ID[g.properties.name] === 'can';
const mainG = geoms.filter((g) => !isCan(g)), canG = geoms.filter(isCan);
const meshOut = (gs, path, filter) => path(topo.mesh(t, { type: 'GeometryCollection', geometries: gs }, filter));
out.coast = meshOut(mainG, mainPath, (a, b) => a === b) + meshOut(canG, canPath, (a, b) => a === b);
out.inner = meshOut(mainG, mainPath, (a, b) => a !== b);
fs.writeFileSync('base.json', JSON.stringify(out));
console.log('base.json', JSON.stringify(out).length, 'bytes');

// projecció utilitzable pels traçats
export function project(lat, lon) {
  const useCan = lon < -12 && lat < 30;
  const p = (useCan ? canProj : mainProj)([lon, lat]);
  return p;
}
export { mainProj, canProj, feats };
