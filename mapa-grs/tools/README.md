# Eines del Mapa de senders

Scripts (Node) amb què s'ha generat la capa de PR de la Comunitat Valenciana. Dades d'OpenStreetMap (ODbL).

Ordre: `npm i d3-geo@3 topojson-client@3 es-atlas` → `node base.mjs` (projecció, genera `base.json`) → `node prvc.mjs` (llista de relacions) → `node dlprvc.mjs` (baixa la geometria a `raw_prvc/`, es pot rellançar per reintentar) → `node extract.cjs` (extreu `senders.json` i la plantilla del `index.html` publicat) → `node process_prvc.mjs` → `node build_prvc.cjs` (escriu `index_new.html`).

Nota: les dades en brut de GR, vies verdes, camins de Santiago, EuroVelo i PR de Catalunya no s'han conservat; l'estat actual del mapa és el que hi ha a `index.html`.
