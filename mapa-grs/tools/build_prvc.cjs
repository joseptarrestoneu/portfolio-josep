// Construeix mapa-grs/index.html a partir de la plantilla extreta del repo + senders_new.json + comarques_full.json
const fs = require('fs');
let h = fs.readFileSync('template_shell.html', 'utf8');
const rp = (a, b) => { if (!h.includes(a)) throw new Error('no trobat: ' + a.slice(0, 70)); h = h.split(a).join(b); };
rp("esc(t(s.t === 'pr' ? 'lFeec' : 'lWeb'))", "esc(t(s.t === 'pr' ? (/femecv/.test(web) ? 'lFemecv' : 'lFeec') : 'lWeb'))");
rp("lFeec: 'Llistat de la FEEC',", "lFeec: 'Llistat de la FEEC', lFemecv: 'Buscador de la FEMECV',");
rp("lFeec: 'Listado de la FEEC',", "lFeec: 'Listado de la FEEC', lFemecv: 'Buscador de la FEMECV',");
rp("lFeec: 'FEEC list',", "lFeec: 'FEEC list', lFemecv: 'FEMECV trail finder',");
rp("els senders europeus i els petits recorreguts de Catalunya", "els senders europeus i els petits recorreguts de Catalunya i la Comunitat Valenciana");
rp("els senders europeus i els PR de Catalunya en un sol mapa interactiu.", "els senders europeus i els PR de Catalunya i la Comunitat Valenciana en un sol mapa interactiu.");
const sd = fs.readFileSync('senders_new.json', 'utf8'), com = fs.readFileSync('comarques_full.json', 'utf8');
rp('<script src="senders.js"></script>', '<script>const SD=' + sd + ';\nconst COM=' + com + ';\n</script>');
fs.writeFileSync('index_new.html', h);
console.log('index_new.html', (h.length / 1e6).toFixed(2), 'MB');
