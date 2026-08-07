# Restyling estetico del gestionale — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare nel gestionale Expo il linguaggio visivo del sito
`ferramenta-loperfido` — colori, caratteri e componenti condivisi — senza
cambiare la disposizione né il comportamento di nessuna schermata.

**Architecture:** `frontend/src/theme.ts` diventa l'unica sorgente di colori,
caratteri e stili di testo. Sopra ci sta un piccolo insieme di componenti
condivisi (`Asse`, `Vite`, `Filetto`, `Scheda`, più le versioni rifatte di
`AppButton`, `ScreenHeader`, `ModeToggle`). Le 20 schermate che oggi scrivono
i colori a mano vengono migrate ai token una alla volta, sorvegliate da uno
script che fallisce se un file già migrato torna a scrivere colori a mano.

**Tech Stack:** Expo 54, React Native 0.81, expo-router 6, TypeScript 5.9,
`expo-font` e `expo-linear-gradient` (entrambi già installati).

**Specifica di riferimento:** `docs/superpowers/specs/2026-08-07-restyling-gestionale-design.md`

## Global Constraints

- **Nessuna dipendenza nuova**, né runtime né di sviluppo. I caratteri si
  includono come file `.ttf` locali, non tramite pacchetti `@expo-google-fonts`.
- **Nessuna schermata cambia disposizione né flusso.** Solo colori,
  caratteri, spaziature interne dei componenti condivisi. Due eccezioni
  approvate esplicitamente, e nessun'altra:
  1. i bottoni alla pressione scendono di 2 pixel invece di rimpicciolire
     (Task 5);
  2. sotto ogni intestazione una striscia di legno alta 3 pixel sostituisce
     il bordo di 1 pixel (Task 6).
  Qualsiasi altro cambiamento di comportamento è un difetto, anche se
  migliora qualcosa.
- **Nessuna modifica sotto `backend/`.** La modifica in corso su
  `backend/server.py` resta non committata e non va toccata.
- **Ramo di lavoro:** `estetica-gestionale`, staccato dalla punta di
  `sviluppo-vendite-statistiche`.
- **Comandi di verifica** (dalla cartella `frontend/`):
  `npx tsc --noEmit`, `npm run lint`, `npm run check:theme`.
- **Su Android i pesi dei caratteri non si sintetizzano.** Con font
  personalizzati, `fontWeight: '700'` non produce il grassetto: va indicata
  la famiglia esatta (`Archivo_700Bold`). Il tema espone quindi una famiglia
  per peso, e `fontWeight` non va più usato insieme a `fontFamily`.
- **Lingua:** commenti e messaggi di commit in italiano, come il resto del
  repository.

---

## Struttura dei file

**Creati:**

| File | Responsabilità |
|---|---|
| `frontend/scripts/check-theme.mjs` | La sentinella: fallisce se un file fuori dalla lista di migrazione contiene colori scritti a mano |
| `frontend/src/theme.ts` (riscritto) | Tavolozza grezza, token semantici, famiglie di caratteri, stili di testo, raggi e ombre |
| `frontend/src/components/materiale/Asse.tsx` | L'asse di legno a sfumature |
| `frontend/src/components/materiale/Vite.tsx` | La vite d'acciaio |
| `frontend/src/components/materiale/Filetto.tsx` | Il filetto inciso |
| `frontend/src/components/Scheda.tsx` | La scheda ricorrente, varianti carta e noce |
| `frontend/assets/fonts/*.ttf` | I sei file dei caratteri |

**Modificati:**

| File | Cosa cambia |
|---|---|
| `frontend/app/_layout.tsx` | Caricamento dei caratteri all'avvio |
| `frontend/src/components/AppButton.tsx` | Proprietà `variante` |
| `frontend/src/components/ScreenHeader.tsx` | Caratteri nuovi, asse sotto l'intestazione |
| `frontend/src/components/ModeToggle.tsx` | Diventa la leva |
| `frontend/app/(tabs)/_layout.tsx` | Colori della barra dalle costanti |
| 20 file di schermata | Colori a mano sostituiti dai token |
| `frontend/app/liste-standard.tsx`, `frontend/app/product/new.tsx` | Schede copiate a mano sostituite da `Scheda` (non hanno colori a mano) |
| `frontend/package.json` | Script `check:theme` |

---

## Tabella di conversione dei colori

Vale per tutte le migrazioni (Task 10-15). I 58 valori distinti trovati nel
codice si riducono ai token del tema così:

| Valori trovati | Diventa |
|---|---|
| `#F4EFE7` `#F4EFE6` `#EFEAE0` `#FAFAFA` `#F3F3F3` `#FFF9EF` | `COLORS.surface` |
| `#EFE5D6` `#EFE6D8` `#E9DDCD` `#E8D8BD` | `COLORS.surfaceSecondary` |
| `#D7C7AF` `#DDD` `#E5E5E5` `#D6D8D6` | `COLORS.border` |
| `#2F2A22` `#2A211B` `#4A4033` `#000` `#000000` (come testo) | `COLORS.onSurface` |
| `#6F6252` `#7A6B5B` `#7B6A5D` `#666` `#999` `#6B7280` | `COLORS.onSurfaceSecondary` |
| `#8B1E1E` `#C0392B` `#C62828` `#B3261E` `#B00020` `#A94438` | `COLORS.error` |
| `#315C3A` `#2F6B45` `#2E7D32` `#1F7A3A` `#176B3A` `#1F4D36` | `COLORS.success` |
| `#263B2B` `#213F28` `#18261C` | `PALETTE.verdeScuro` |
| `#F1F7EF` `#EEF6F0` `#EAF6EE` | `COLORS.successSurface` |
| `#8B5A2B` `#9A633B` `#A06A43` | `COLORS.brandPrimary` |
| `#9B4E18` `#A85E2A` `#5A341F` | `COLORS.brandSecondary` |
| `#D4A373` `#D8662A` `#F7E8D0` | `COLORS.brandTertiary` |
| `#8A908B` `#7B817C` `#5F665F` `#4F5751` | `COLORS.acciaio` |

**`#FFFFFF` e `#FFF` richiedono giudizio, non sostituzione meccanica.** Sono
32 e 7 occorrenze con due significati diversi:

- usato come **fondo** di una scheda o di un riquadro → `COLORS.surface`
- usato come **testo o icona sopra un colore pieno** → il token `on...`
  corrispondente al fondo: `COLORS.onError` su rosso, `COLORS.onSuccess` su
  verde, `COLORS.onBrandPrimary` su legno

Chi migra deve guardare a cosa è applicato, non solo trovare e sostituire.

**`shadowColor`** resta un colore letterale: usare `PALETTE.noce3`
(`#1A100A`) al posto di `#000` per intonare le ombre al resto.

---

## Task 1: Il ramo e la sentinella dei colori

**Files:**
- Create: `frontend/scripts/check-theme.mjs`
- Modify: `frontend/package.json` (sezione `scripts`)

**Interfaces:**
- Consumes: niente
- Produces: comando `npm run check:theme`, che esce con codice 1 se un file
  fuori dalla lista `DA_MIGRARE` contiene colori esadecimali, o se una voce
  della lista non ne contiene più (voce stantia). I task successivi tolgono
  voci da `DA_MIGRARE` per innescare il fallimento e poi migrano il file.

- [ ] **Step 1: Creare il ramo di lavoro**

```bash
cd C:/Users/dario/Documents/Codex/Ferramenta-app
git checkout -b estetica-gestionale
git status --short
```

Atteso: solo ` M backend/server.py`. Quella modifica non va committata in
nessuno dei task di questo piano.

- [ ] **Step 2: Scrivere la sentinella**

Create `frontend/scripts/check-theme.mjs`:

```js
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
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/catalogo-vendita.tsx',
  'app/(tabs)/catalogo.tsx',
  'app/(tabs)/fornitori.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/statistiche.tsx',
  'app/change-password.tsx',
  'app/cliente/piu-richiesti.tsx',
  'app/edit-profile.tsx',
  'app/impostazioni.tsx',
  'app/impostazioni/promozioni.tsx',
  'app/impostazioni/regole-prezzi.tsx',
  'app/impostazioni/sinonimi-ricerca.tsx',
  'app/login.tsx',
  'app/profile.tsx',
  'app/scanner.tsx',
  'app/user-detail.tsx',
  'app/users.tsx',
  'app/vendite-oggi.tsx',
  'src/components/PasswordInput.tsx',
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
```

- [ ] **Step 3: Registrare il comando**

In `frontend/package.json`, dentro `"scripts"`, aggiungere dopo `"lint"`:

```json
"check:theme": "node ./scripts/check-theme.mjs"
```

- [ ] **Step 4: Eseguire la sentinella — deve passare, con 20 file in coda**

```bash
cd frontend && npm run check:theme
```

Atteso: `Sentinella a posto. File ancora da migrare: 20.`

Se il numero di file è diverso da 20, la lista `DA_MIGRARE` non corrisponde
alla realtà: correggerla prima di proseguire, non aggirare il controllo.

- [ ] **Step 5: Verificare che la sentinella morda davvero**

Aggiungere temporaneamente `const prova = '#123456';` in cima a
`frontend/src/components/AppButton.tsx`, poi:

```bash
cd frontend && npm run check:theme
```

Atteso: esce con codice 1 e stampa
`src/components/AppButton.tsx — 1` sotto "Colori scritti a mano fuori dal
tema". Rimuovere la riga di prova e rieseguire: torna a passare.

- [ ] **Step 6: Commit**

```bash
git add frontend/scripts/check-theme.mjs frontend/package.json
git commit -m "chore: sentinella contro i colori scritti a mano"
```

---

## Task 2: I caratteri

**Files:**
- Create: `frontend/assets/fonts/` con sei file `.ttf`
- Modify: `frontend/app/_layout.tsx`

**Interfaces:**
- Consumes: niente
- Produces: sei famiglie disponibili a runtime con questi nomi esatti —
  `Fraunces_700Bold`, `Fraunces_900Black`, `Archivo_400Regular`,
  `Archivo_700Bold`, `IBMPlexMono_400Regular`, `IBMPlexMono_500Medium`.
  Il Task 3 li mette dentro `FONTS`.

- [ ] **Step 1: Chiedere il permesso di scaricare**

I file vanno presi da Google Fonts. **Fermarsi e chiedere a Dario prima di
scaricare.** Elenco esatto, tutti a licenza SIL Open Font License:

| File | Da |
|---|---|
| `Fraunces_700Bold.ttf` | fonts.google.com/specimen/Fraunces |
| `Fraunces_900Black.ttf` | idem |
| `Archivo_400Regular.ttf` | fonts.google.com/specimen/Archivo |
| `Archivo_700Bold.ttf` | idem |
| `IBMPlexMono_400Regular.ttf` | fonts.google.com/specimen/IBM+Plex+Mono |
| `IBMPlexMono_500Medium.ttf` | idem |

Sei file invece degli otto che coprirebbero tutti i pesi del sito: due pesi
per famiglia bastano a tutto quello che serve, e ogni file in più è peso
nell'app.

Fraunces è un carattere variabile: scaricare le versioni **statiche**, che
su Android sono più affidabili.

- [ ] **Step 2: Sistemare i file**

Metterli in `frontend/assets/fonts/` con esattamente i nomi della tabella. I
nomi dei file diventano i nomi delle famiglie: se sbagliano, il testo torna
al carattere di sistema senza errori visibili.

- [ ] **Step 3: Caricarli all'avvio**

In `frontend/app/_layout.tsx`, accanto al caricamento delle icone già
presente:

```tsx
import { useFonts } from 'expo-font';

const [caratteriPronti] = useFonts({
  Fraunces_700Bold: require('../assets/fonts/Fraunces_700Bold.ttf'),
  Fraunces_900Black: require('../assets/fonts/Fraunces_900Black.ttf'),
  Archivo_400Regular: require('../assets/fonts/Archivo_400Regular.ttf'),
  Archivo_700Bold: require('../assets/fonts/Archivo_700Bold.ttf'),
  IBMPlexMono_400Regular: require('../assets/fonts/IBMPlexMono_400Regular.ttf'),
  IBMPlexMono_500Medium: require('../assets/fonts/IBMPlexMono_500Medium.ttf'),
});
```

L'app non deve restare bloccata se il caricamento fallisce: se `_layout.tsx`
già aspetta le icone prima di mostrare il contenuto, aggiungere
`caratteriPronti` alla stessa condizione. Se non aspetta niente, non
introdurre un'attesa: il testo comparirà col carattere di sistema per un
istante e poi cambierà, che è preferibile a una schermata bianca.

- [ ] **Step 4: Verificare**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Poi avviare `AVVIA-ANTEPRIMA.cmd` e guardare l'app sul telefono. A questo
punto **niente deve essere cambiato visivamente**: i caratteri sono caricati
ma nessuno li usa ancora. Se qualcosa è cambiato, qualcosa è andato storto.

- [ ] **Step 5: Commit**

```bash
git add frontend/assets/fonts frontend/app/_layout.tsx
git commit -m "feat: carica Fraunces, Archivo e IBM Plex Mono"
```

---

## Task 3: I token nel tema

**Files:**
- Modify: `frontend/src/theme.ts` (riscrittura completa)

**Interfaces:**
- Consumes: le famiglie del Task 2
- Produces: `PALETTE`, `COLORS`, `FONTS`, `TESTO`, `SPACING`, `RADIUS`,
  `OMBRE`, `fmtEUR`. Tutti i nomi già esportati oggi (`COLORS`, `FONTS`,
  `SPACING`, `fmtEUR`) restano, così il codice esistente continua a
  compilare.

- [ ] **Step 1: Riscrivere `frontend/src/theme.ts`**

```ts
// Il sistema visivo del gestionale.
//
// I colori sono gli stessi del sito ferramenta-loperfido, campionati
// dall'insegna vera del negozio. Chi tocca questo file cambia l'aspetto di
// tutta l'app: è voluto. Nessun colore va scritto a mano nelle schermate —
// ci pensa scripts/check-theme.mjs a ricordarlo.

// --- La tavolozza grezza -------------------------------------------------
// Usarla solo quando serve il colore preciso. Altrimenti usare COLORS.

export const PALETTE = {
  carta: '#F5EFE4',
  carta2: '#EBE0CF',
  carta3: '#DDCFB8',

  inchiostro: '#241C15',
  inchiostro2: '#5B4A3A',
  inchiostro3: '#8A7864',

  legnoLuce: '#F0A878',
  legnoChiaro: '#E0954F',
  legno: '#C07848',
  legnoScuro: '#96603A',
  legnoOmbra: '#784830',

  noce: '#3E2A1E',
  noce2: '#2A1B12',
  noce3: '#1A100A',

  verde: '#4A6B48',
  verdeScuro: '#2F4630',
  verdeChiaro: '#7D9C6A',

  minio: '#A84432',
  ottone: '#C9A227',
  acciaio: '#9AA0A6',
} as const;

// --- I token semantici ---------------------------------------------------
// I nomi sono quelli che le schermate già usano: cambiano solo i valori.

export const COLORS = {
  surface: PALETTE.carta,
  onSurface: PALETTE.inchiostro,
  surfaceSecondary: PALETTE.carta2,
  onSurfaceSecondary: PALETTE.inchiostro2,
  surfaceTertiary: PALETTE.carta3,
  onSurfaceTertiary: PALETTE.inchiostro,
  surfaceInverse: PALETTE.noce,
  onSurfaceInverse: PALETTE.carta,

  brand: PALETTE.legnoScuro,
  brandPrimary: PALETTE.legnoScuro,
  onBrandPrimary: PALETTE.carta,
  brandSecondary: PALETTE.legnoOmbra,
  onBrandSecondary: PALETTE.carta,
  brandTertiary: PALETTE.legnoLuce,
  onBrandTertiary: PALETTE.inchiostro,

  success: PALETTE.verde,
  onSuccess: '#FFFFFF',
  successSurface: '#E6EFE2',

  warning: PALETTE.ottone,
  // Bianco su ottone non si legge: il testo sopra il giallo va scuro.
  onWarning: PALETTE.inchiostro,
  warningSurface: '#F6EDD2',

  error: PALETTE.minio,
  onError: '#FFFFFF',
  errorSurface: '#F3E1DD',

  acciaio: PALETTE.acciaio,

  border: PALETTE.carta3,
  borderStrong: PALETTE.legnoScuro,
  divider: PALETTE.carta3,
} as const;

// --- I caratteri ---------------------------------------------------------
// Su Android i pesi non si sintetizzano: va indicata la famiglia esatta.
// Non usare fontWeight insieme a fontFamily.

export const FONTS = {
  display: 'Fraunces_700Bold',
  displayForte: 'Fraunces_900Black',
  testo: 'Archivo_400Regular',
  testoForte: 'Archivo_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedio: 'IBMPlexMono_500Medium',
} as const;

// --- Gli stili di testo di servizio, presi dal sito ----------------------

export const TESTO = {
  // L'etichetta da cassettiera: piccola, spaziata, in stampatello.
  cassetto: {
    fontFamily: FONTS.monoMedio,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  // Il numero da inventario: cifre a larghezza fissa, così le colonne di
  // prezzi non ballano.
  cifra: {
    fontFamily: FONTS.monoMedio,
    fontVariant: ['tabular-nums'],
  },
  titolo: {
    fontFamily: FONTS.displayForte,
    fontSize: 24,
    letterSpacing: -0.4,
  },
} as const;

// --- Misure --------------------------------------------------------------

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

// Angoli quasi vivi, come le insegne smaltate del sito.
export const RADIUS = { sm: 2, md: 4, lg: 8 } as const;

export const OMBRE = {
  scheda: {
    shadowColor: PALETTE.noce3,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

export const fmtEUR = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};
```

Nota: `Platform` non serve più, l'import va tolto.

Nota sui token `successSurface`, `warningSurface`, `errorSurface`: non erano
nella specifica, ma il codice contiene già tre verdi pallidi
(`#F1F7EF`, `#EEF6F0`, `#EAF6EE`) usati come fondi di avviso. Senza un token
per quel ruolo non avrebbero dove andare.

- [ ] **Step 2: Verificare che compili**

```bash
cd frontend && npx tsc --noEmit
```

Atteso: nessun errore. `TESTO.cassetto.textTransform` e
`TESTO.cifra.fontVariant` possono richiedere un'asserzione di tipo quando
vengono usati dentro `StyleSheet.create`: se `tsc` protesta, tipizzare
`TESTO` con `satisfies Record<string, TextStyle>` importando `TextStyle` da
`react-native`.

- [ ] **Step 3: Guardare l'app**

`AVVIA-ANTEPRIMA.cmd`. I titoli delle schermate e i testi che già usavano
`FONTS.display` e `FONTS.mono` ora hanno i caratteri nuovi. I colori si sono
spostati di poco. Nessuna schermata deve essere rotta.

- [ ] **Step 4: Sentinella e lint**

```bash
cd frontend && npm run lint && npm run check:theme
```

Atteso: sentinella ancora a 20 file (nessuna schermata migrata finora).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/theme.ts
git commit -m "feat: token di colore, caratteri e stili di testo dal sito"
```

---

## Task 4: Il materiale — Asse, Vite, Filetto

**Files:**
- Create: `frontend/src/components/materiale/Asse.tsx`
- Create: `frontend/src/components/materiale/Vite.tsx`
- Create: `frontend/src/components/materiale/Filetto.tsx`

**Interfaces:**
- Consumes: `PALETTE`, `RADIUS` dal Task 3
- Produces:
  - `<Asse style?: StyleProp<ViewStyle>; viti?: boolean; filetto?: boolean; testID?: string; children?: ReactNode />`
  - `<Vite style?: StyleProp<ViewStyle> />` — 10×10, posizionamento assoluto a carico del chiamante
  - `<Filetto />` — si posiziona da solo dentro il genitore

- [ ] **Step 1: `Vite.tsx`**

```tsx
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { PALETTE } from '@/src/theme';

// La vite d'acciaio. Sull'insegna vera ce ne sono due per asse, agli estremi.
// Il sito usa una luce circolare per darle volume; React Native non ce l'ha
// senza librerie, quindi qui è acciaio pieno con il taglio inciso. A dieci
// pixel la differenza non si vede.

export function Vite({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.vite, style]} pointerEvents="none">
      <View style={styles.taglio} />
    </View>
  );
}

const styles = StyleSheet.create({
  vite: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.acciaio,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#5E6469',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglio: {
    width: 6,
    height: 1.5,
    backgroundColor: '#3C4044',
    transform: [{ rotate: '-28deg' }],
  },
});
```

- [ ] **Step 2: `Filetto.tsx`**

```tsx
import { View, StyleSheet } from 'react-native';

// Il filetto inciso: la riga chiara che corre dentro il bordo dell'asse.

export function Filetto() {
  return <View style={styles.filetto} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  filetto: {
    position: 'absolute',
    top: 9,
    right: 9,
    bottom: 9,
    left: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 232, 205, 0.34)',
    borderRadius: 2,
  },
});
```

- [ ] **Step 3: `Asse.tsx`**

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PALETTE, RADIUS } from '@/src/theme';
import { Vite } from './Vite';
import { Filetto } from './Filetto';

// L'asse di legno: il modulo che ricorre in tutto il sito, tradotto in
// React Native. Il sito ci mette sopra una grana di rumore in sovrapposizione
// che qui non è riproducibile: questa versione è a sole sfumature, quindi un
// po' più pulita e uniforme. Somiglia, non è identica.

type Props = {
  style?: StyleProp<ViewStyle>;
  viti?: boolean;
  filetto?: boolean;
  testID?: string;
  children?: ReactNode;
};

export function Asse({ style, viti = false, filetto = false, testID, children }: Props) {
  return (
    <LinearGradient
      colors={['#EAA066', '#DD9457', '#C9814C', '#B06D3F', PALETTE.legnoScuro]}
      locations={[0, 0.26, 0.58, 0.85, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.asse, style]}
      testID={testID}
    >
      {children}
      {filetto && <Filetto />}
      {viti && (
        <>
          <Vite style={{ top: 6, left: 6 }} />
          <Vite style={{ top: 6, right: 6 }} />
          <Vite style={{ bottom: 6, left: 6 }} />
          <Vite style={{ bottom: 6, right: 6 }} />
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  asse: {
    borderRadius: RADIUS.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 224, 195, 0.55)',
    shadowColor: PALETTE.noce3,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
```

- [ ] **Step 4: Provarli davvero**

Non basta che compilino: vanno guardati. Aggiungere **temporaneamente** in
cima al contenuto di `frontend/app/(tabs)/index.tsx`:

```tsx
<Asse viti filetto style={{ height: 90, margin: 16 }} />
```

con l'import `import { Asse } from '@/src/components/materiale/Asse';`.

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Poi `AVVIA-ANTEPRIMA.cmd`: sulla home deve comparire una tavola di legno con
quattro viti agli angoli e un filetto chiaro incassato. Se il legno appare
piatto o le viti mancano, sistemare prima di proseguire.

**Togliere la prova da `index.tsx` prima del commit.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/materiale
git commit -m "feat: componenti del materiale legno (asse, vite, filetto)"
```

---

## Task 5: Le varianti di AppButton

**Files:**
- Modify: `frontend/src/components/AppButton.tsx`

**Interfaces:**
- Consumes: `COLORS`, `PALETTE`, `FONTS`, `RADIUS` dal Task 3
- Produces: `AppButton` con proprietà `variante?: 'pieno' | 'pericolo' | 'scuro' | 'inciso'`.
  Quando `variante` è assente il componente si comporta esattamente come
  oggi. Esporta anche `TESTO_BOTTONE: Record<Variante, TextStyle>` per il
  colore del testo dentro il bottone.

- [ ] **Step 1: Aggiungere le varianti**

Il file mantiene tutta la logica esistente (aptica, doppio tocco, caricamento
automatico). Si aggiunge la proprietà e gli stili. In `Props`:

```tsx
variante?: 'pieno' | 'pericolo' | 'scuro' | 'inciso';
```

Sotto il componente:

```tsx
// I quattro bottoni del sito. Il pieno è legno e non minio: nel gestionale
// il rosso significa "attenzione, stai cancellando", e non può voler dire
// anche "conferma".
const VARIANTI = StyleSheet.create({
  pieno: {
    backgroundColor: COLORS.brandPrimary,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.legnoOmbra,
  },
  pericolo: {
    backgroundColor: COLORS.error,
    borderBottomWidth: 4,
    borderBottomColor: '#7D3125',
  },
  scuro: {
    backgroundColor: PALETTE.noce,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.noce3,
  },
  inciso: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
  },
});

const BASE = StyleSheet.create({
  bottone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.sm,
  },
});

export const TESTO_BOTTONE = {
  pieno: { fontFamily: FONTS.testoForte, fontSize: 15, color: COLORS.onBrandPrimary },
  pericolo: { fontFamily: FONTS.testoForte, fontSize: 15, color: COLORS.onError },
  scuro: { fontFamily: FONTS.testoForte, fontSize: 15, color: COLORS.onSurfaceInverse },
  inciso: { fontFamily: FONTS.testoForte, fontSize: 15, color: COLORS.brandPrimary },
} as const;
```

- [ ] **Step 2: Cambiare la sensazione al tocco**

Nella funzione `style` del `Pressable`, sostituire il blocco che oggi fa
`transform: [{ scale: 0.96 }], opacity: 0.88` con:

```tsx
state.pressed &&
  !effectivelyDisabled && {
    // Il tasto scende di due pixel e il bordo sotto si accorcia, come un
    // interruttore vero. È il gesto del sito.
    transform: [{ translateY: 2 }],
    borderBottomWidth: variante && variante !== 'inciso' ? 2 : undefined,
  },
```

E inserire la variante nella catena di stili, **prima** di `baseStyle`, così
chi passa uno stile a mano continua a vincere:

```tsx
return [
  { position: 'relative' },
  variante && BASE.bottone,
  variante && VARIANTI[variante],
  baseStyle,
  // ...il resto invariato
];
```

- [ ] **Step 3: Verificare che il vecchio uso non si sia rotto**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Poi `AVVIA-ANTEPRIMA.cmd`: **nessun bottone esistente deve essere cambiato**,
perché nessuno passa ancora `variante`. L'unica differenza percepibile è che
alla pressione i bottoni scendono invece di rimpicciolire. Provarne almeno
tre in schermate diverse.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppButton.tsx
git commit -m "feat: varianti del bottone e pressione fisica"
```

---

## Task 6: ScreenHeader

**Files:**
- Modify: `frontend/src/components/ScreenHeader.tsx`

**Interfaces:**
- Consumes: `COLORS`, `FONTS`, `TESTO` dal Task 3; `Asse` dal Task 4
- Produces: `ScreenHeader` con la stessa firma di oggi
  (`title`, `subtitle?`, `right?`, `style?`). Nessun cambio d'interfaccia.

- [ ] **Step 1: Rifare gli stili**

Il ramo speciale per `title === 'FERRAMENTA'` resta com'è nella struttura.
Cambiano solo gli stili in fondo al file:

```tsx
const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    gap: 12,
  },

  homeWrap: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },

  homeLogo: { width: '95%', height: 90, marginBottom: 18 },

  homeAddress: {
    width: '100%',
    ...TESTO.cassetto,
    fontSize: 13,
    lineHeight: 22,
    color: COLORS.onSurfaceSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },

  homeToggle: { width: '100%', alignItems: 'flex-end' },

  // Fraunces porta già il suo peso: niente fontWeight, su Android non
  // funziona con i caratteri personalizzati.
  title: {
    fontFamily: FONTS.displayForte,
    fontSize: 26,
    color: COLORS.onSurface,
    letterSpacing: -0.4,
    textTransform: 'none',
  },

  sub: {
    ...TESTO.cassetto,
    color: COLORS.onSurfaceSecondary,
    marginTop: 6,
  },

  // L'asse sostituisce il filo grigio sotto l'intestazione.
  assettina: { height: 3, width: '100%' },
});
```

- [ ] **Step 2: Mettere l'asse sotto l'intestazione**

Avvolgere entrambi i rami del `return` in un frammento con l'asse in coda:

```tsx
<>
  <View style={[styles.wrap, style]}>{/* ...contenuto invariato... */}</View>
  <Asse style={styles.assettina} />
</>
```

Stessa cosa per il ramo `homeWrap`. Togliere `borderBottomWidth` e
`borderBottomColor` da entrambi: adesso il bordo è l'asse.

- [ ] **Step 3: Verificare**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

`AVVIA-ANTEPRIMA.cmd`: i titoli sono in Fraunces nero, i sottotitoli in
stampatello spaziato, e sotto ogni intestazione corre una striscia di legno
alta 3 pixel. Controllare che i titoli lunghi non vadano a capo male: prima
c'era `letterSpacing: 4` che li allargava, ora non più, quindi ci sta più
testo.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ScreenHeader.tsx
git commit -m "feat: intestazioni in Fraunces con l'asse di legno"
```

---

## Task 7: La Scheda

**Files:**
- Create: `frontend/src/components/Scheda.tsx`

**Interfaces:**
- Consumes: `COLORS`, `RADIUS`, `SPACING`, `OMBRE` dal Task 3
- Produces: `<Scheda variante?: 'carta' | 'noce'; style?: StyleProp<ViewStyle>; children: ReactNode />`.
  I task 10-15 la usano al posto delle schede copiate a mano.

- [ ] **Step 1: Scrivere il componente**

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, StyleProp, View, ViewStyle } from 'react-native';

import { COLORS, OMBRE, RADIUS, SPACING } from '@/src/theme';

// La scheda ricorrente: prodotti, fornitori, righe di lista. Prima di questo
// componente ogni schermata si inventava la propria, ed erano tutte diverse
// di qualche pixel.

type Props = {
  variante?: 'carta' | 'noce';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function Scheda({ variante = 'carta', style, children }: Props) {
  return <View style={[styles.base, styles[variante], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    ...OMBRE.scheda,
  },
  carta: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  noce: {
    backgroundColor: COLORS.surfaceInverse,
    borderColor: COLORS.brandSecondary,
  },
});
```

- [ ] **Step 2: Verificare**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Il componente non è ancora usato da nessuno: non c'è niente da guardare
sullo schermo. Verrà provato nel Task 10, sulla prima schermata migrata.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Scheda.tsx
git commit -m "feat: componente Scheda, varianti carta e noce"
```

---

## Task 8: La leva

**Files:**
- Modify: `frontend/src/components/ModeToggle.tsx`

**Interfaces:**
- Consumes: `COLORS`, `PALETTE`, `TESTO`, `RADIUS` dal Task 3; `Asse` e
  `Vite` dal Task 4
- Produces: `ModeToggle` con la stessa firma di oggi — nessuna proprietà.
  La logica (`useAppStore`, `mode`, `setMode`) resta identica.

- [ ] **Step 1: Rifare il componente**

La struttura del sito: un'asse di legno con quattro viti, e sopra un cursore
che scorre — noce sotto Gestore, verde sotto Cliente.

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS, PALETTE, RADIUS, TESTO } from '@/src/theme';
import { useAppStore } from '@/src/store';
import { Asse } from '@/src/components/materiale/Asse';
import { Vite } from '@/src/components/materiale/Vite';
import AppButton from '@/src/components/AppButton';

// La leva dei due mondi, presa dal sito. Lì cambia il terreno sotto i piedi:
// noce dentro casa, verde fuori. Qui i due mondi sono Gestore e Cliente.

export function ModeToggle() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const gestore = mode === 'gestore';

  return (
    <Asse style={styles.asse} testID="mode-toggle">
      <Vite style={{ top: 5, left: 5 }} />
      <Vite style={{ top: 5, right: 5 }} />
      <Vite style={{ bottom: 5, left: 5 }} />
      <Vite style={{ bottom: 5, right: 5 }} />

      <View
        style={[
          styles.cursore,
          gestore
            ? { left: 6, backgroundColor: PALETTE.noce }
            : { right: 6, backgroundColor: PALETTE.verdeScuro },
        ]}
        pointerEvents="none"
      />

      <AppButton style={styles.meta} onPress={() => setMode('gestore')} testID="mode-gestore-btn">
        <Feather name="tool" size={14} color={gestore ? COLORS.onSurfaceInverse : PALETTE.noce2} />
        <Text style={[styles.txt, gestore && styles.txtAttivo]}>GESTORE</Text>
      </AppButton>

      <AppButton style={styles.meta} onPress={() => setMode('cliente')} testID="mode-cliente-btn">
        <Feather name="user" size={14} color={!gestore ? COLORS.onSurfaceInverse : PALETTE.noce2} />
        <Text style={[styles.txt, !gestore && styles.txtAttivo]}>CLIENTE</Text>
      </AppButton>
    </Asse>
  );
}

const styles = StyleSheet.create({
  asse: { flexDirection: 'row', padding: 6, alignItems: 'center' },
  cursore: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: '50%',
    borderRadius: RADIUS.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 240, 190, 0.5)',
  },
  meta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  txt: { ...TESTO.cassetto, color: PALETTE.noce2 },
  txtAttivo: { color: COLORS.onSurfaceInverse },
});
```

I tre `testID` esistenti (`mode-toggle`, `mode-gestore-btn`,
`mode-cliente-btn`) vanno conservati: potrebbero essere usati dai test del
backend o da script di verifica. `Asse` accetta già `testID` dal Task 4.

- [ ] **Step 2: Verificare**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

`AVVIA-ANTEPRIMA.cmd`, schermata home: la leva è una tavola di legno con
quattro viti; toccando Cliente il cursore passa a destra e diventa verde,
toccando Gestore torna a sinistra e diventa noce. **Verificare che il
passaggio di modalità funzioni ancora davvero**: in modalità Cliente le
schede Vendita, Fornitori e Statistiche devono sparire dalla barra in basso.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ModeToggle.tsx
git commit -m "feat: il toggle modalita' diventa la leva dei due mondi"
```

---

## Task 9: La barra delle schede

**Files:**
- Modify: `frontend/app/(tabs)/_layout.tsx`
- Modify: `frontend/scripts/check-theme.mjs` (togliere una voce)

**Interfaces:**
- Consumes: `COLORS`, `PALETTE`, `FONTS` dal Task 3
- Produces: niente per i task successivi

- [ ] **Step 1: Togliere il file dalla lista — la sentinella deve fallire**

In `frontend/scripts/check-theme.mjs` cancellare la riga
`'app/(tabs)/_layout.tsx',` da `DA_MIGRARE`, poi:

```bash
cd frontend && npm run check:theme
```

Atteso: **esce con codice 1**, elencando `app/(tabs)/_layout.tsx — 5`.
Questo è il rosso: la sentinella ha visto i cinque colori a mano.

- [ ] **Step 2: Sostituire i colori**

In `screenOptions`:

```tsx
tabBarActiveTintColor: COLORS.warning,
tabBarInactiveTintColor: PALETTE.carta3,

tabBarStyle: {
  backgroundColor: PALETTE.verdeScuro,
  borderTopWidth: 2,
  borderTopColor: COLORS.brandPrimary,
  height: Platform.OS === 'ios' ? 88 : 70,
  paddingTop: 3,
  paddingBottom: Platform.OS === 'ios' ? 24 : 9,
  elevation: 10,
  shadowColor: PALETTE.noce3,
  shadowOpacity: 0.16,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: -3 },
},

tabBarLabelStyle: {
  fontFamily: FONTS.mono,
  fontSize: 10,
  letterSpacing: 0.9,
  textTransform: 'uppercase',
},
```

`fontWeight: '800'` va tolto: con IBM Plex Mono su Android non produce
niente e confonde chi legge il codice.

Aggiungere `PALETTE` all'import da `@/src/theme`.

- [ ] **Step 3: La sentinella deve tornare verde**

```bash
cd frontend && npm run check:theme && npx tsc --noEmit && npm run lint
```

Atteso: `Sentinella a posto. File ancora da migrare: 19.`

- [ ] **Step 4: Guardare**

`AVVIA-ANTEPRIMA.cmd`: la barra in basso è verde scuro con il filo di legno
sopra e la linguetta attiva in ottone. Controllare la leggibilità
dell'ottone `#C9A227` sul verde `#2F4630` — se risulta debole sul telefono,
passare a `PALETTE.legnoLuce` e annotarlo nel messaggio di commit.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(tabs\)/_layout.tsx frontend/scripts/check-theme.mjs
git commit -m "feat: barra delle schede sui colori del tema"
```

---

## Task 10: Accesso e profilo

**Files:**
- Modify: `frontend/app/login.tsx` (16 righe con colori)
- Modify: `frontend/app/profile.tsx` (8)
- Modify: `frontend/app/users.tsx` (5)
- Modify: `frontend/app/user-detail.tsx` (5)
- Modify: `frontend/app/change-password.tsx` (3)
- Modify: `frontend/app/edit-profile.tsx` (2)
- Modify: `frontend/src/components/PasswordInput.tsx` (3)
- Modify: `frontend/scripts/check-theme.mjs` (togliere sette voci)

**Interfaces:**
- Consumes: `COLORS`, `PALETTE`, `FONTS`, `TESTO` dal Task 3; `Scheda` dal
  Task 7; `AppButton variante` dal Task 5
- Produces: niente

Queste sette schermate vengono per prime perché sono le meno usate: se
qualcosa va storto, lo si scopre dove non blocca il lavoro in negozio.

- [ ] **Step 1: Togliere le sette voci — la sentinella deve fallire**

Cancellare da `DA_MIGRARE`: `app/login.tsx`, `app/profile.tsx`,
`app/users.tsx`, `app/user-detail.tsx`, `app/change-password.tsx`,
`app/edit-profile.tsx`, `src/components/PasswordInput.tsx`.

```bash
cd frontend && npm run check:theme
```

Atteso: esce con codice 1, elencando i sette file.

- [ ] **Step 2: Migrare i colori**

Per ogni file, sostituire ogni valore esadecimale secondo la **Tabella di
conversione dei colori** in cima a questo piano. Aggiungere l'import dei
token dove manca:

```tsx
import { COLORS, FONTS, PALETTE, TESTO } from '@/src/theme';
```

Per `#FFFFFF` e `#FFF` guardare a cosa sono applicati, come spiegato nella
tabella: fondo → `COLORS.surface`, testo su colore pieno → il token `on...`
corrispondente.

- [ ] **Step 3: Usare i componenti condivisi**

Dove queste schermate disegnano una scheda a mano — un `View` con
`borderRadius`, `borderWidth` e un'ombra — sostituirla con `<Scheda>`. Dove
disegnano un bottone principale a mano, passare a
`<AppButton variante="pieno">` con `<Text style={TESTO_BOTTONE.pieno}>`
dentro, togliendo lo stile scritto a mano.

Non forzare: se una scheda ha una struttura diversa per un motivo, lasciarla
e annotarlo nel messaggio di commit.

- [ ] **Step 4: Verificare**

```bash
cd frontend && npm run check:theme && npx tsc --noEmit && npm run lint
```

Atteso: `Sentinella a posto. File ancora da migrare: 12.`

- [ ] **Step 5: Guardare tutte e sette**

`AVVIA-ANTEPRIMA.cmd`, e passare per: accesso (uscire e rientrare), profilo,
modifica profilo, cambio password, elenco utenti, dettaglio utente. In
particolare l'accesso, che ha 16 righe colorate ed è la schermata che si vede
per prima.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/login.tsx frontend/app/profile.tsx frontend/app/users.tsx frontend/app/user-detail.tsx frontend/app/change-password.tsx frontend/app/edit-profile.tsx frontend/src/components/PasswordInput.tsx frontend/scripts/check-theme.mjs
git commit -m "feat: accesso e profilo sui token del tema"
```

---

## Task 11: Impostazioni

**Files:**
- Modify: `frontend/app/impostazioni.tsx` (6)
- Modify: `frontend/app/impostazioni/promozioni.tsx` (7)
- Modify: `frontend/app/impostazioni/sinonimi-ricerca.tsx` (4)
- Modify: `frontend/app/impostazioni/regole-prezzi.tsx` (3)
- Modify: `frontend/scripts/check-theme.mjs` (togliere quattro voci)

**Interfaces:** come il Task 10.

- [ ] **Step 1: Togliere le quattro voci — rosso**

```bash
cd frontend && npm run check:theme
```

Atteso: esce con codice 1, elenca i quattro file.

- [ ] **Step 2: Migrare**

Stessa procedura del Task 10: tabella di conversione, poi `Scheda` e
`AppButton variante` dove ci sono schede e bottoni disegnati a mano.

In `promozioni.tsx` prestare attenzione ai colori delle promozioni: se
esiste un colore che segnala "in promozione", quello è `COLORS.warning`
(ottone) — è il ruolo che il sito dà a quel colore.

- [ ] **Step 3: Verificare**

```bash
cd frontend && npm run check:theme && npx tsc --noEmit && npm run lint
```

Atteso: `Sentinella a posto. File ancora da migrare: 8.`

- [ ] **Step 4: Guardare**

`AVVIA-ANTEPRIMA.cmd`: impostazioni e le tre sottopagine. Verificare che le
regole prezzi e i sinonimi di ricerca funzionino ancora — sono schermate con
moduli, e un colore sbagliato su un campo lo rende illeggibile.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/impostazioni.tsx frontend/app/impostazioni frontend/scripts/check-theme.mjs
git commit -m "feat: impostazioni sui token del tema"
```

---

## Task 12: Home, statistiche, venduto di oggi

**Files:**
- Modify: `frontend/app/(tabs)/index.tsx` (3)
- Modify: `frontend/app/(tabs)/statistiche.tsx` (7)
- Modify: `frontend/app/vendite-oggi.tsx` (10)
- Modify: `frontend/scripts/check-theme.mjs` (togliere tre voci)

**Interfaces:** come il Task 10, più `Asse` dal Task 4.

- [ ] **Step 1: Togliere le tre voci — rosso**

```bash
cd frontend && npm run check:theme
```

- [ ] **Step 2: Migrare i colori**

Tabella di conversione come sopra.

- [ ] **Step 3: I numeri passano a `TESTO.cifra`**

Queste tre schermate sono piene di importi e conteggi. Ogni `Text` che
contiene un numero, un prezzo o una quantità prende `...TESTO.cifra`, così
le colonne restano allineate. È il punto in cui il carattere a larghezza
fissa si guadagna il peso aggiunto: verificarlo guardando una lista di
importi con cifre diverse.

- [ ] **Step 4: L'asse sui riquadri della home**

Sulla home, i riquadri di ingresso ai reparti sono il posto giusto per il
legno: avvolgerli in `<Asse viti>` invece del fondo pieno attuale. Non
toccare le liste.

- [ ] **Step 5: Verificare**

```bash
cd frontend && npm run check:theme && npx tsc --noEmit && npm run lint
```

Atteso: `Sentinella a posto. File ancora da migrare: 5.`

- [ ] **Step 6: Guardare**

`AVVIA-ANTEPRIMA.cmd`: home, statistiche, venduto di oggi. Controllare che i
grafici o le barre delle statistiche siano ancora leggibili: se usavano
verdi diversi per distinguere serie, ora sono tutti `COLORS.success` e
potrebbero essere diventati indistinguibili. Se succede, usare i tre gradi
di verde della `PALETTE` (`verde`, `verdeScuro`, `verdeChiaro`).

- [ ] **Step 7: Commit**

```bash
git add frontend/app/\(tabs\)/index.tsx frontend/app/\(tabs\)/statistiche.tsx frontend/app/vendite-oggi.tsx frontend/scripts/check-theme.mjs
git commit -m "feat: home e statistiche sui token, numeri a larghezza fissa"
```

---

## Task 13: Fornitori

**Files:**
- Modify: `frontend/app/(tabs)/fornitori.tsx` (55 righe con colori)
- Modify: `frontend/scripts/check-theme.mjs` (togliere una voce)

**Interfaces:** come il Task 10.

Ha un task tutto suo perché da solo contiene un terzo dei colori a mano di
tutta l'app.

- [ ] **Step 1: Togliere la voce — rosso**

```bash
cd frontend && npm run check:theme
```

Atteso: esce con codice 1, `app/(tabs)/fornitori.tsx — 55`.

- [ ] **Step 2: Leggere il file prima di toccarlo**

55 righe colorate su un file solo vogliono dire che qui dentro c'è un
sistema visivo parallelo: probabilmente un colore per fornitore, o per stato
dell'ordine. Capire cosa distingue cosa **prima** di sostituire, altrimenti
si perde un'informazione che l'utente usa.

Se esiste una mappa colore→fornitore, va spostata nel tema come token
dedicato, non appiattita.

- [ ] **Step 3: Migrare**

Tabella di conversione per i colori di ruolo (fondi, testi, bordi, errori).
Per gli eventuali colori identificativi, definire nel tema una costante
dedicata accanto a `PALETTE`, con un commento che spieghi cosa distingue.

- [ ] **Step 4: Verificare**

```bash
cd frontend && npm run check:theme && npx tsc --noEmit && npm run lint
```

Atteso: `Sentinella a posto. File ancora da migrare: 4.`

- [ ] **Step 5: Guardare con attenzione**

`AVVIA-ANTEPRIMA.cmd`, scheda Fornitori. Scorrere l'elenco intero.
Verificare che i fornitori restino distinguibili come prima: è la prova che
non si è appiattita informazione.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(tabs\)/fornitori.tsx frontend/src/theme.ts frontend/scripts/check-theme.mjs
git commit -m "feat: fornitori sui token del tema"
```

---

## Task 14: Catalogo

**Files:**
- Modify: `frontend/app/(tabs)/catalogo.tsx` (13)
- Modify: `frontend/app/(tabs)/catalogo-vendita.tsx` (13)
- Modify: `frontend/scripts/check-theme.mjs` (togliere due voci)

**Interfaces:** come il Task 10.

- [ ] **Step 1: Togliere le due voci — rosso**

```bash
cd frontend && npm run check:theme
```

- [ ] **Step 2: Migrare**

Tabella di conversione. Le righe di prodotto diventano `<Scheda>` se oggi
sono schede disegnate a mano.

- [ ] **Step 3: Niente legno nelle liste**

Il catalogo è una lista lunga che si scorre. **Nessun `Asse` qui dentro**, né
come fondo né sulle righe: resta carta pulita. Il legno sta solo
nell'intestazione, che ce l'ha già dal Task 6.

I prezzi prendono `...TESTO.cifra`.

- [ ] **Step 4: Verificare**

```bash
cd frontend && npm run check:theme && npx tsc --noEmit && npm run lint
```

Atteso: `Sentinella a posto. File ancora da migrare: 2.`

- [ ] **Step 5: Guardare, e scorrere davvero**

`AVVIA-ANTEPRIMA.cmd`, catalogo. Scorrere una lista lunga fino in fondo e
verificare che lo scorrimento sia fluido come prima. Se è diventato scattoso,
la causa è quasi certamente un'ombra o una sfumatura aggiunta alle righe:
toglierla.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(tabs\)/catalogo.tsx frontend/app/\(tabs\)/catalogo-vendita.tsx frontend/scripts/check-theme.mjs
git commit -m "feat: catalogo sui token del tema"
```

---

## Task 15: Scanner e schermate cliente

**Files:**
- Modify: `frontend/app/scanner.tsx` (3)
- Modify: `frontend/app/cliente/piu-richiesti.tsx` (1)
- Modify: `frontend/scripts/check-theme.mjs` (togliere le ultime due voci)

**Interfaces:** come il Task 10.

- [ ] **Step 1: Togliere le ultime due voci — rosso**

```bash
cd frontend && npm run check:theme
```

- [ ] **Step 2: Migrare**

Tabella di conversione.

- [ ] **Step 3: Lo scanner resta spoglio**

`scanner.tsx` è la schermata più critica dell'app: ci si lavora col cliente
davanti. Nessuna decorazione, nessun legno, nessuna ombra aggiunta. Solo i
tre colori sostituiti con i token corrispondenti. Il mirino della fotocamera
deve restare esattamente com'è.

- [ ] **Step 4: Verificare**

```bash
cd frontend && npm run check:theme && npx tsc --noEmit && npm run lint
```

Atteso: `Sentinella a posto. File ancora da migrare: 0.`

- [ ] **Step 5: Provare lo scanner con un codice vero**

`AVVIA-ANTEPRIMA.cmd`, aprire lo scanner e leggere il codice a barre di un
prodotto reale. Deve trovarlo come prima. Questa è l'unica verifica che
conta su questa schermata.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/scanner.tsx frontend/app/cliente/piu-richiesti.tsx frontend/scripts/check-theme.mjs
git commit -m "feat: scanner e schermate cliente sui token del tema"
```

---

## Task 16: Le ultime schede copiate a mano

**Files:**
- Modify: `frontend/app/liste-standard.tsx`
- Modify: `frontend/app/product/new.tsx`

**Interfaces:**
- Consumes: `Scheda` dal Task 7, `AppButton variante` dal Task 5
- Produces: niente

Questi due file non contengono colori scritti a mano — prendono già tutto da
`COLORS` — quindi la sentinella non li ha mai segnalati. Disegnano però le
proprie schede a mano, con `borderRadius` e ombre copiate. Senza questo task
resterebbero le uniche due schermate con schede diverse da tutte le altre.

**La sentinella non aiuta qui: non c'è un rosso da far diventare verde.**
La verifica è la lettura del codice e lo sguardo sullo schermo.

- [ ] **Step 1: Trovare le schede copiate**

```bash
cd frontend && grep -n "borderRadius" app/liste-standard.tsx app/product/new.tsx
```

Ogni `View` che ha insieme `borderRadius`, un bordo e un'ombra è una scheda
copiata a mano.

- [ ] **Step 2: Sostituirle**

Rimpiazzare ognuna con `<Scheda>`, togliendo dallo `StyleSheet` locale le
proprietà che `Scheda` fornisce già (`borderRadius`, `padding`,
`borderWidth`, `borderColor`, `backgroundColor`, ombre). Quello che resta —
larghezze, margini, disposizione — si passa a `Scheda` con `style`.

Se una di queste schede ha una struttura che `Scheda` non copre, lasciarla e
scriverlo nel messaggio di commit. Meglio una scheda diversa dichiarata che
un componente piegato a forza.

- [ ] **Step 3: I bottoni principali**

Dove queste schermate hanno un bottone di conferma disegnato a mano, passare
a `<AppButton variante="pieno">` con `<Text style={TESTO_BOTTONE.pieno}>`
dentro.

- [ ] **Step 4: Verificare**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Guardare**

`AVVIA-ANTEPRIMA.cmd`: aprire le liste standard e la creazione di un nuovo
prodotto. **Creare davvero un prodotto di prova e cancellarlo**: è un modulo
lungo, e una scheda sostituita male può nascondere un campo.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/liste-standard.tsx frontend/app/product/new.tsx
git commit -m "feat: liste standard e nuovo prodotto usano la Scheda condivisa"
```

---

## Task 17: Chiudere la sentinella

**Files:**
- Modify: `frontend/scripts/check-theme.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: tutto quanto sopra
- Produces: `npm run lint` che fallisce anche sui colori a mano

- [ ] **Step 1: Svuotare la lista e renderla definitiva**

`DA_MIGRARE` deve essere un array vuoto. Sostituire il commento sopra con:

```js
// La migrazione è finita: questa lista deve restare vuota. Se qualcuno
// aggiunge un file qui, sta rimandando il lavoro invece di farlo.
const DA_MIGRARE = [];
```

- [ ] **Step 2: Legare la sentinella al lint**

In `frontend/package.json`:

```json
"lint": "expo lint && npm run check:theme"
```

Così chi lancia il lint — a mano o da un gancio — inciampa nei colori a mano
senza doversi ricordare del comando in più.

- [ ] **Step 3: Verifica finale completa**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Atteso: nessun errore di tipo, lint pulito, e
`Sentinella a posto. File ancora da migrare: 0.`

Contro-prova che la sentinella morde ancora: aggiungere
`const prova = '#123456';` in un file di schermata qualsiasi, rilanciare
`npm run lint`, verificare che fallisca, togliere la riga.

- [ ] **Step 4: Il giro completo sul telefono**

`AVVIA-ANTEPRIMA.cmd`, e passare per ogni schermata: home, catalogo,
vendita, fornitori, statistiche, impostazioni e sottopagine, profilo, utenti,
scanner, schermate cliente, carrello, checkout. Cercare testo illeggibile,
bottoni scomparsi, campi senza bordo.

Questa è l'unica verifica che copre l'estetica, e non è automatizzabile.

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/check-theme.mjs frontend/package.json
git commit -m "chore: la sentinella dei colori entra nel lint"
```

- [ ] **Step 6: Riassunto per Dario**

Riportare: quali schermate sono state migrate, quali scelte di colore hanno
richiesto giudizio (i `#FFFFFF`, i colori dei fornitori), e cosa non ha
funzionato come previsto. Non dichiarare finito quello che non è stato
guardato sul telefono.

---

## Cosa questo piano non fa

- Non aggiunge test automatici al frontend: non ce ne sono, e introdurli
  richiederebbe una dipendenza che la specifica esclude. L'estetica si
  verifica a schermo
- Non tocca `backend/`
- Non cambia la disposizione né il comportamento di nessuna schermata
- Non mette legno in liste, tabelle, moduli e scanner
- Non tocca il sito
