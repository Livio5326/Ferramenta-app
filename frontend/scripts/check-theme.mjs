// Sentinella dei colori.
//
// Fallisce se un file di interfaccia scrive colori esadecimali a mano invece
// di prenderli da src/theme.ts. I file elencati in DA_MIGRARE sono quelli
// non ancora migrati: man mano che si migrano si tolgono dalla lista, e da
// quel momento la sentinella li sorveglia.
//
// Uso: npm run check:theme

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const CARTELLE = ['app', 'src'];
const ESTENSIONI = ['.tsx'];
const COLORE = /#[0-9a-fA-F]{3,8}\b/g;

// I file non ancora migrati. Togliere una voce quando il file è a posto.
const DA_MIGRARE = [
  'app/cliente/piu-richiesti.tsx',
  'app/scanner.tsx',
];

function* file(cartella) {
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === 'node_modules' || voce.name.startsWith('.')) continue;
      yield* file(percorso);
    } else if (ESTENSIONI.some((e) => voce.name.endsWith(e))) {
      yield percorso;
    }
  }
}

const trovati = new Map();

for (const cartella of CARTELLE) {
  const base = join(RADICE, cartella);
  try {
    statSync(base);
  } catch {
    continue;
  }
  for (const percorso of file(base)) {
    const colori = readFileSync(percorso, 'utf8').match(COLORE);
    if (colori) {
      trovati.set(relative(RADICE, percorso).split(sep).join('/'), colori.length);
    }
  }
}

const permessi = new Set(DA_MIGRARE);
const intrusi = [...trovati.keys()].filter((f) => !permessi.has(f)).sort();
const stantii = DA_MIGRARE.filter((f) => !trovati.has(f)).sort();

if (intrusi.length) {
  console.error('\nColori scritti a mano fuori dal tema:\n');
  for (const f of intrusi) console.error(`  ${f} — ${trovati.get(f)}`);
  console.error('\nUsare i token di src/theme.ts.\n');
}

if (stantii.length) {
  console.error('\nVoci stantie in DA_MIGRARE (file ormai puliti):\n');
  for (const f of stantii) console.error(`  ${f}`);
  console.error('\nToglierle dalla lista in scripts/check-theme.mjs.\n');
}

if (intrusi.length || stantii.length) process.exit(1);

console.log(`Sentinella a posto. File ancora da migrare: ${DA_MIGRARE.length}.`);
