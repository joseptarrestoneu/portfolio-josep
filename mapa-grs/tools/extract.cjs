const fs=require('fs');const h=fs.readFileSync('C:/Users/Josep Tarres/Documents/Developer/portfolio-josep/mapa-grs/index.html','utf8');
const a=h.indexOf('<script>const SD=');const b=h.indexOf('</script>',a);
console.log('bloc',a,b,b-a);
const code=h.slice(a+8,b);
const SD=JSON.parse(code.slice(code.indexOf('const SD=')+9,code.indexOf(';\nconst COM=')));
const COM=JSON.parse(code.slice(code.indexOf('const COM=')+10,code.lastIndexOf(';')));
fs.writeFileSync('senders.json',JSON.stringify(SD));fs.writeFileSync('comarques_full.json',JSON.stringify(COM));
const t={};SD.forEach(s=>t[s.t]=(t[s.t]||0)+1);console.log(SD.length,t,COM.length);
fs.writeFileSync('template_shell.html',h.slice(0,a)+'<script src="senders.js"></script>'+h.slice(b+9));
console.log(Object.keys(SD[0]).join(','));
// comprova base.json == cc del repo
const base=JSON.parse(fs.readFileSync('base.json','utf8'));let ok=0,bad=0;
for(const [k,v] of Object.entries(base.cc)){const m=h.includes('data-cc="'+k+'" d="'+v.d+'"');m?ok++:bad++}console.log('cc iguals',ok,'diferents',bad);
console.log(SD.filter(s=>s.t==='pr').slice(0,2).map(s=>({...s,d:s.d.slice(0,40)})));
const i=h.indexOf('lFeec');console.log(h.slice(i-40,i+120));
