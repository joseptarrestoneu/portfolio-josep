import fs from 'fs';
const UA='portfolio-mapa-grs/0.1 (personal project)';const URLS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
fs.mkdirSync('raw_prvc',{recursive:true});
const M=JSON.parse(fs.readFileSync('meta_prvc.json','utf8')).filter(e=>!/^PR-CU/.test(e.tags.ref||''));
async function fb(id){const data=`[out:json][timeout:180];rel(id:${id});out geom qt;`;
 for(let i=0;i<8;i++){try{const r=await fetch(URLS[i%2],{method:'POST',headers:{'User-Agent':UA,'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(data),signal:AbortSignal.timeout(200000)});
  const t=await r.text();if(t[0]==='{'){const j=JSON.parse(t);if(!j.remark||!/runtime error/i.test(j.remark))return j}console.log('retry',r.status)}catch(e){console.log('ERR',e.message.slice(0,50))}await new Promise(r=>setTimeout(r,3000*(i+1)))}return null}
const slim=j=>j.elements.filter(e=>e.type==='relation').map(e=>({id:e.id,tags:e.tags,sub:e.members.filter(m=>m.type==='relation').map(m=>m.ref),ways:e.members.filter(m=>m.type==='way'&&m.geometry&&m.geometry.length>1).map(m=>m.geometry.map(p=>[Math.round(p.lat*1e5)/1e5,Math.round(p.lon*1e5)/1e5]))}));
const q=M.map(e=>e.id);const seen=new Set(q);let n=0;
async function w(){while(q.length){const id=q.shift();const f='raw_prvc/c'+id+'.json';let s;
 if(fs.existsSync(f))s=JSON.parse(fs.readFileSync(f,'utf8'));else{const j=await fb(id);if(!j){console.log('FALLIDA',id);continue}s=slim(j);fs.writeFileSync(f,JSON.stringify(s));console.log('ok',id,++n)}
 for(const r of s)for(const i of r.sub)if(!seen.has(i)){seen.add(i);q.push(i)}}}
await Promise.all([w(),w(),w(),w()]);console.log('FI',seen.size);
