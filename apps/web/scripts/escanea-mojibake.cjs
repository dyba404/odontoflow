// Barrido de mojibake: detecta doble-codificacion UTF-8->Latin1/CP1252 y
// caracteres de reemplazo en codigo fuente user-facing.
// Uso: node scripts/escanea-mojibake.cjs  (desde apps/web o raiz)
const { readFileSync, readdirSync, statSync } = require("fs");
const { join, relative } = require("path");

const RAIZ = process.cwd();
const DIRS = ["apps/web/src", "packages/core/src", "packages/db/src", "packages/ui/src", "apps/web/public"];
const EXT = [".ts", ".tsx", ".js", ".mjs", ".html", ".json", ".webmanifest", ".css"];
const SKIP = /vendor|node_modules|\.next|test-results|playwright-report/;

const PATRONES = [
  ["reemplazo-unicode", /\uFFFD/],
  ["doble-encode", /[\u00C2\u00C3][\u0080-\u00BF]/],
  ["A-guion", /A-[a-z]/],
  ["A3-vocal", /A3(?=[a-z\u00E1\u00E9\u00ED\u00F3\u00F1])/],
  ["A-simbolo", /A[\u00B1\u00A9\u00BA\u00A1\u00AD]/],
  ["palabras-rotas", /cuAc|estA-|Asltimo|aquA-|EscrA-|AsA-|mAdic|comunicaciA3|gestiA3|reemplazA3/],
];

const hallados = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { if (!SKIP.test(full)) walk(full); continue; }
    if (!EXT.some((x) => e.endsWith(x))) continue;
    if (SKIP.test(full)) continue;
    let texto;
    try { texto = readFileSync(full, "utf8"); } catch { continue; }
    const lineas = texto.split("\n");
    for (let i = 0; i < lineas.length; i++) {
      for (const [nombre, re] of PATRONES) {
        const m = lineas[i].match(re);
        if (m) {
          hallados.push({ archivo: relative(RAIZ, full), linea: i + 1, tipo: nombre, muestra: m[0], contexto: lineas[i].trim().slice(0, 130) });
          break; // un tipo por linea basta
        }
      }
    }
  }
}

for (const d of DIRS) walk(join(RAIZ, d));

if (hallados.length === 0) {
  console.log("LIMPIO: 0 hallazgos en " + DIRS.join(", "));
} else {
  console.log("HALLAZGOS: " + hallados.length);
  for (const h of hallados) {
    console.log(`\n[${h.tipo}] ${h.archivo}:${h.linea} (match: "${h.muestra}")`);
    console.log("  " + h.contexto);
  }
}
