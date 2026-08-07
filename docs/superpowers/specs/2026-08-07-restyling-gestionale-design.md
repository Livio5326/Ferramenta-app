# Restyling estetico del gestionale sul modello del sito

Data: 2026-08-07
Stato: approvato, da pianificare

## Obiettivo

Portare nel gestionale Expo/React Native il linguaggio visivo del sito
`ferramenta-loperfido` (`C:\Users\dario\Documents\Codex\sito-ferramenta-loperfido`,
pubblicato su Cloudflare Pages), in modo che le due cose si riconoscano come
parenti.

Ambito scelto: **token + componenti condivisi**. Nessuna schermata cambia
disposizione o comportamento. Un restyling completo schermata per schermata è
stato valutato e scartato: su un gestionale in uso quotidiano il rischio di
rallentare il lavoro non ripaga.

## Punto di partenza

I due progetti condividono già il DNA cromatico, campionato dalla stessa
insegna del negozio:

| | Sito (`src/stili.css`) | Gestionale (`frontend/src/theme.ts`) |
|---|---|---|
| Noce | `#3e2a1e` | `#3E2A1E` — identico |
| Verde | `#4a6b48` | `#4A6B48` — identico |
| Minio | `#a84432` | `#A84432` — identico |
| Carta | `#f5efe4` | `#F4EFE6` — quasi |

Anche il concetto dei due mondi esiste in entrambi: sul sito è la leva
dentro/fuori casa (`src/componenti/Mondi.tsx`), nel gestionale è il toggle
Gestore/Cliente (`frontend/src/components/ModeToggle.tsx`).

Manca al gestionale: il carattere con grazie per i titoli, il materiale
"asse di legno", le texture di fondo, la tipografia di servizio.

### Il problema vero

**170 colori scritti a mano in 19 delle 38 schermate scavalcano `theme.ts`.**
Sono 58 valori distinti, e in gran parte doppioni involontari: cinque
tonalità di carta (`#F4EFE6`, `#F4EFE7`, `#EFE5D6`, `#EFEAE0`, `#EFE6D8`),
sei rossi per gli errori, una decina di verdi. È deriva accumulata, non
scelta.

I conteggi si riferiscono ai soli file `.tsx` sotto `frontend/app`: due file
di backup (`fornitori.tsx.save`, `fornitori.tsx.before_detail_move`) sono
esclusi perché non sono schermate.

Finché restano lì, cambiare il tema non cambia l'app. Far collassare i
doppioni sui token è il lavoro principale di questa specifica, più della
grafica in sé.

## Approccio

**Tema esteso e sostituzione diretta.** `theme.ts` si allarga con i token del
sito; i 58 valori sparsi vengono sostituiti con riferimenti ai token, un file
alla volta. Gli stili restano `StyleSheet.create`. Nessuna dipendenza nuova.

Scartate:

- **Libreria di stile** (`@shopify/restyle` o simili) — dipendenza nuova su
  un'app Expo 54 già delicata su font e connessioni, e riscrittura di tutti
  gli stili. Sproporzionato al problema.
- **Solo ampliare le costanti** — mezz'ora di lavoro che non risolve niente:
  i colori sparsi restano dove sono.

## Sezione 1 — I token

`theme.ts` mantiene i nomi semantici che le schermate già usano
(`COLORS.surface`, `COLORS.brand`…): cambiano solo i valori dietro. Il codice
esistente continua a compilare e la migrazione procede un file alla volta.

Sotto i nomi semantici va aggiunta la tavolozza grezza del sito — `carta`,
`legno`, `noce`, `verde`, `minio`, `ottone`, `acciaio` — per i casi in cui
serve il colore preciso.

### Colori

| Token | Ora | Diventa | Nota |
|---|---|---|---|
| `surface` | `#F4EFE6` | `#F5EFE4` carta | scarto invisibile, allinea al sito |
| `surfaceSecondary` | `#E8DFD1` | `#EBE0CF` carta-2 | |
| `surfaceTertiary` | `#DCD0BF` | `#DDCFB8` carta-3 | |
| `onSurface` | `#2C221B` | `#241C15` inchiostro | un filo più scuro, legge meglio |
| `onSurfaceSecondary` | `#4A3C31` | `#5B4A3A` inchiostro-2 | |
| `onSurfaceTertiary` | `#2C221B` | `#241C15` inchiostro | resta scuro: sta su carta-3 |
| `surfaceInverse` | `#3E2A1E` | invariato | già identico al noce |
| `onSurfaceInverse` | `#F4EFE6` | `#F5EFE4` carta | |
| `brand` / `brandPrimary` | `#8C5A35` | `#96603A` legno-scuro | |
| `onBrandPrimary` | `#F4EFE6` | `#F5EFE4` carta | |
| `brandSecondary` | `#6B4423` | `#784830` legno-ombra | |
| `brandTertiary` | `#D5B59C` | `#F0A878` legno-luce | fondi tenui, testo scuro sopra |
| `onBrandTertiary` | `#3E2A1E` | `#241C15` inchiostro | |
| `success` | `#4A6B48` | invariato | già identico al verde |
| `warning` | `#C27A30` | `#C9A227` ottone | |
| `onWarning` | `#FFFFFF` | `#241C15` inchiostro | **correzione**: vedi sotto |
| `error` | `#A84432` | invariato | già identico al minio |
| `border` / `divider` | `#DCD0BF` | `#DDCFB8` carta-3 | |
| `borderStrong` | `#8C5A35` | `#96603A` legno-scuro | |

Token nuovi: `ottone #C9A227` per promozioni e badge, `acciaio #9AA0A6` per
elementi disattivati, i tre gradi di noce (`#3E2A1E`, `#2A1B12`, `#1A100A`)
per le superfici scure, i cinque gradi di legno per il materiale.

### Due decisioni esplicite

**Il minio non diventa il colore dell'azione principale.** Sul sito il
pulsante pieno è minio, giusto per una vetrina. Nel gestionale quel rosso è
già `error`: promuoverlo ad azione principale darebbe a "Salva" e "Elimina"
lo stesso colore. L'azione principale resta nella famiglia del legno; il
minio conserva il significato di pericolo. È l'unico punto in cui l'app si
discosta consapevolmente dal sito.

**`onWarning` va corretto.** Oggi è bianco. Su ottone `#C9A227`, che è
chiaro, il bianco non si legge. Passa a inchiostro. I contrasti vanno
verificati con un calcolo in fase di lavorazione, non a occhio.

### Caratteri

| Token | Carattere | Dove |
|---|---|---|
| `display` | Fraunces | titoli di schermata, intestazioni di sezione |
| `testo` — nuovo | Archivo | corpo del testo |
| `mono` | IBM Plex Mono | numeri, prezzi, codici, etichette maiuscole |

`testo` oggi non esiste: il corpo del testo usa il font di sistema.

I file `.ttf` vanno inclusi nell'app come asset locali, non presi da CDN:
`expo-font` è già installato, e il caricamento locale evita il problema noto
con le icone su Expo Go documentato in `frontend/src/hooks/use-icon-fonts.ts`.
Peso aggiunto stimato: qualche centinaio di kilobyte.

I caratteri sono a licenza libera (SIL Open Font License) e vanno scaricati
da Google Fonts. **Lo scaricamento va chiesto a Dario prima di eseguirlo.**

### Tipografia di servizio

Portati dal sito, oggi assenti nell'app:

- **cassetto** — mono, ~11px, `letterSpacing` ~2.4, maiuscolo, peso 500:
  l'etichetta da cassettiera
- **cifra** — mono con `fontVariant: ['tabular-nums']`, così le colonne di
  importi restano allineate. Utile davvero, non solo bello: in un gestionale
  i prezzi che ballano in colonna sono un fastidio quotidiano

## Sezione 2 — I componenti condivisi

114 punti fra raggi, bordi e ombre sono sparsi su 19 file: ogni schermata si
è inventata la propria scheda e il proprio pulsante. Questi componenti
servono a riassorbirli.

| Componente | Stato | Cosa diventa |
|---|---|---|
| `AppButton` | esiste, solo comportamento | Proprietà `variante` facoltativa: `pieno` (legno), `pericolo` (minio), `scuro` (noce), `inciso` (contorno). Le chiamate esistenti continuano a funzionare |
| `ScreenHeader` | esiste | Titolo in Fraunces, sottotitolo in stile cassetto, sottile asse di legno al posto del filo grigio |
| `Scheda` | non esiste | La scheda ricorrente per prodotti, fornitori, righe di lista. Due varianti: carta e noce. È il componente che assorbe più duplicazione |
| `ModeToggle` | esiste | Diventa la leva del sito: cursore d'ottone che scorre, noce sotto Gestore, verde sotto Cliente |
| Barra delle schede | colori a mano in `app/(tabs)/_layout.tsx` | Verde scuro `#2F4630`, bordo legno, linguetta attiva in ottone |
| `Asse`, `Vite`, `Filetto` | non esistono | Il materiale legno come componenti riutilizzabili, con `expo-linear-gradient` (già installato) |

### La leva

Sul sito è il pezzo migliore: tiri la leva e cambia il terreno sotto i piedi,
noce dentro casa, verde fuori. Nel gestionale quella leva esiste già — è il
toggle Gestore/Cliente — ma oggi sono due pulsantini grigi. Farla diventare
la stessa leva del sito è l'intervento che lega di più le due cose, e costa
poco perché la logica c'è già.

### Il tocco del pulsante

Oggi `AppButton` rimpicciolisce alla pressione (`scale(0.96)` + opacità). Sul
sito il pulsante si abbassa di 2 pixel e l'ombra sotto si accorcia, come un
tasto vero che scende. Si passa alla seconda: più coerente e più fisica sotto
il dito.

### Limite tecnico dichiarato

Il legno del sito ha sopra una grana di rumore in `mix-blend-mode: overlay`, e
le viti hanno una luce circolare (`radial-gradient`). Nessuna delle due esiste
in React Native senza librerie aggiuntive. Il legno dell'app sarà quindi a
sole sfumature lineari: leggermente più pulito e uniforme di quello del sito.
Somiglia, non è identico.

Aggiungere `react-native-svg` per colmare la differenza è stato valutato e
scartato: molta dipendenza per un dettaglio che si nota solo affiancando i due
schermi.

### Dove il legno non va

Liste lunghe, tabelle, campi dei moduli e la schermata dello scanner restano
su carta pulita. Il legno sta nelle cornici — intestazioni, leva, riquadri
della home, barra delle schede — dove decora senza mettersi fra l'occhio e il
dato.

## Sezione 3 — Lavorazione e verifica

### Il frontend non ha test propri

Verificato: gli unici file di test sotto `frontend/` stanno dentro
`node_modules`. Non esiste quindi un modo automatico di dimostrare che il
restyling è riuscito — quello lo giudica Dario a schermo.

Le due cose misurabili sono:

- **la compilazione non si è rotta** — `npx tsc --noEmit` e `npm run lint`
  puliti
- **i colori passano davvero dal tema** — il conteggio dei valori scritti a
  mano scende da 170 verso zero, misurabile con:

  ```
  grep -rhoE "#[0-9a-fA-F]{3,8}\b" --include="*.tsx" frontend/app | wc -l
  ```

### Ramo di lavoro

Ramo dedicato `estetica-gestionale`, staccato dalla punta di
`sviluppo-vendite-statistiche`. Si tocca solo `frontend/`: la modifica in
corso su `backend/server.py` resta nell'albero di lavoro e non va committata.

### Fasi

Dal meno rischioso al più rischioso. Ogni fase è un commit a sé, guardabile
sul telefono con `AVVIA-ANTEPRIMA.cmd` e rifiutabile senza buttare il resto.

| Fase | Cosa | Verificabile |
|---|---|---|
| 0 | Caratteri caricati + token nel tema | L'app si apre, i titoli cambiano carattere, nient'altro si muove |
| 1 | `Asse`, `Vite`, `Filetto`, poi `AppButton`, `ScreenHeader`, `Scheda`, la leva, la barra delle schede | Componenti aggiunti senza ancora sostituirli ovunque |
| 2 | Schermate poco usate: impostazioni e sottopagine, profilo, utenti, accesso, cambio password | Se qualcosa va storto, si scopre dove non blocca il lavoro |
| 3 | Consultazione: home, statistiche, statistiche-prodotti, venduto di oggi, fornitori | |
| 4 | Catalogo, catalogo vendita, schede prodotto, nuovo prodotto, importazione | |
| 5 | Le critiche, per ultime: vendita, scanner, carrello e checkout cliente, preventivo, schermate cliente | A questo punto il linguaggio è collaudato su trenta schermate |
| 6 | Regola eslint contro i colori scritti a mano | La deriva non ricomincia |

### Fuori ambito

- Nessuna schermata cambia disposizione o comportamento
- Nessuna dipendenza nuova
- Nessuna modifica al backend
- Nessuna texture su liste, tabelle e moduli
- Nessun intervento sul sito

### Quando è finito

Quando le 38 schermate leggono i colori dal tema, i componenti condivisi sono
in uso al posto degli stili copiati, `tsc` e `lint` sono puliti, e Dario apre
l'app e la riconosce come parente del sito. L'ultimo criterio non è
misurabile in automatico ed è quello che decide.
