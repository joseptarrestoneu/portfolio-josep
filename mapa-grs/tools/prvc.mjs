import fs from 'fs';
const UA='portfolio-mapa-grs/0.1 (personal project)';const URLS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const q='[out:json][timeout:180];area["ISO3166-2"="ES-VC"]->.a;rel(area.a)["route"~"hiking|foot"]["ref"~"^PR[ -]?(CV|V|A|AL|CS)?"];out tags;';
for(let i=0;i<6;i++){try{const r=await fetch(URLS[i%2],{method:'POST',headers:{'User-Agent':UA,'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q),signal:AbortSignal.timeout(200000)});const t=await r.text();if(t[0]==='{'){const j=JSON.parse(t);fs.writeFileSync('meta_prvc.json',JSON.stringify(j.elements));console.log('relacions',j.elements.length);break}console.log('retry',r.status)}catch(e){console.log('ERR',e.message.slice(0,50))}await new Promise(r=>setTimeout(r,4000))}
const E=JSON.parse(fs.readFileSync('meta_prvc.json','utf8'));
const pre={};E.forEach(e=>{const m=(e.tags.ref||'').match(/^PR[ -]?([A-Z]*)/);const k=m?m[1]||'(sense)':'?';pre[k]=(pre[k]||0)+1});console.log(pre);
const codes=new Set(E.map(e=>e.tags.ref));console.log('codis únics',codes.size);
console.log('principals (sense .x)',[...codes].filter(c=>!/\.\d+\s*$/.test(c)).length);
console.log([...codes].sort().slice(0,12).join(', '));
