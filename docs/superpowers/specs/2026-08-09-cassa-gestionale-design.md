# Cassa collegata al gestionale — Design (Fase 1)

Data: 2026-08-09
Branch: sviluppo-vendite-statistiche

## Contesto

Il negozio (ferramenta) usa una cassa fiscale **autonoma** (Registratore Telematico
RCH o Ditron) che batte gli scontrini con la propria tastiera. Oggi la cassa e il
gestionale non si parlano: quando si vende, il magazzino del gestionale non si
aggiorna da solo.

Il gestionale invece **ha gia** i mattoni di una cassa:

- `frontend/app/(tabs)/vendita.tsx`: carrello con quantita, totale, "COMPLETA VENDITA".
- `frontend/app/scanner.tsx`: scanner a fotocamera che **legge gia i QR** (i
  `barcodeTypes` includono `qr`/`datamatrix`) e aggiunge al carrello.
- `backend/server.py` `POST /api/sales` (`create_sale`): valida la giacenza e
  **scala `quantita`** in modo atomico, con compensazione se qualcosa fallisce.
  Risolve il prodotto per `id` / `codice_prodotto` / `barcode`.
- `frontend/src/local/db.ts`: percorso **offline** con `createLocalSale`, tabelle
  `sales` / `sale_items` e flag `da_sincronizzare`.

## Verdetto tecnico sul collegamento con la cassa

Ricerca sui protocolli RCH e Ditron:

- **RCH** (es. PRINT!F): Seriale/USB/Ethernet, protocolli **RCH** e **RCH
  Webservice (HTTP/HTTPS)**. Integrazione col gestionale tramite un software
  master (es. RCH MultiDriverServer) che **comanda la cassa a stampare**.
- **Ditron** (es. IT-ONE, Quadra): driver **WinEcrCom** (Seriale/Ethernet); la
  cassa "riceve i comandi di stampa dal software gestionale" (driver .NET
  UPOS/OlePOS/JavaPOS o protocollo Xon/Xoff).

Conclusione: un RT autonomo **non spinge** ogni vendita in tempo reale verso
l'esterno. Il modello supportato e l'opposto — un **software master** guida la
cassa (stampante fiscale) e nello stesso momento scala il magazzino. L'obiettivo
dell'utente (scansiono al banco, stampo lo scontrino, scalo i prodotti) e quindi
raggiungibile mettendo il **cervello nel gestionale** (tablet al banco), non nella
cassa.

## Obiettivo (Fase 1)

Alla cassa si scansionano gli articoli, il gestionale registra la vendita e
**scala il magazzino**, in modo robusto anche senza rete, con la stampa fiscale
**predisposta** ma non ancora attiva.

## Decisioni chiave (dal brainstorming con l'utente)

1. **Approccio A predisposto a B**: costruiamo "app che scala da scansione" con il
   punto di conferma vendita gia predisposto per agganciare in Fase 2 la stampa
   fiscale automatica.
2. **Codici**: il QR/etichetta codifica una **chiave stabile gia esistente** del
   prodotto (`codice_prodotto` interno, o l'EAN `barcode` quando c'e). Nessun
   formato custom: `create_sale` risolve gia questi codici. Formato etichetta:
   **QR** (deciso; commutabile a codice a barre lineare senza cambiare il flusso).
3. **Scansione Fase 1**: **fotocamera** (gia legge QR/EAN). La logica
   "codice -> prodotto" viene isolata cosi che una **penna ottica hardware**
   (scanner BT/USB keyboard-wedge) si possa agganciare dopo senza riscrivere.
4. **Offline-first**: il backend gira in **cloud**, quindi la cassa registra la
   vendita in **locale** (scala la giacenza locale subito) e **sincronizza** verso
   il cloud in background. Il banco non si blocca mai.
5. **Prezzo/quantita modificabili al banco**: ogni riga del carrello permette di
   cambiare prezzo (anche **0€**, sconti, arrotondamenti) e quantita. Nasce
   dall'esigenza reale sugli sfusi.
6. **Sfusi**: solo **alcuni** (i piu importanti) vengono tracciati a magazzino →
   le etichette QR restano ma in **versione ridotta**, generate a richiesta per il
   sottoinsieme scelto. Gli sfusi non tracciati (o regalati) si gestiscono con una
   **riga rapida a prezzo libero** che non tocca il magazzino.
7. **Stampa etichette**: **PDF A4 adesivo** generato dal gestionale. Etichettatrice
   termica predisposta ma fuori ambito Fase 1.

## Ambito

### In ambito (Fase 1)

1. **Scansione -> carrello** con fotocamera, con la risoluzione codice->prodotto
   isolata in un modulo riusabile (predisposto per penna ottica hardware).
2. **Riga carrello con prezzo e quantita modificabili** (incluso 0€).
3. **Riga rapida a prezzo libero** per articoli fuori catalogo o sfusi non
   tracciati (non tocca il magazzino).
4. **Vendita offline-first**: conferma tramite `createLocalSale` + scarico giacenza
   locale immediato + **sync** verso il backend cloud.
5. **Generazione etichette QR (PDF A4)** dal prodotto e in blocco, per gli articoli
   senza EAN che si sceglie di tracciare; assegnazione di un `codice_prodotto`
   interno agli sfusi tracciati.
6. **Gancio di stampa**: interfaccia `ReceiptPrinter.printReceipt(vendita)` con
   implementazione "manuale" in Fase 1 (mostra il totale da battere sulla cassa).
7. **Gestione errori**: codice non trovato, giacenza insufficiente, scan doppio
   (accorpa quantita sulla stessa riga), rete assente.

### Fuori ambito (Fase 2, spec separato)

- Stampa fiscale **automatica** sul modello RCH/Ditron reale (implementazioni
  concrete di `ReceiptPrinter`: RCH via webservice HTTP, Ditron via ponte/driver).
- **Penna ottica hardware** (aggancio dell'input keyboard-wedge).
- **Etichettatrice termica**.

## Architettura e componenti

Il flusso vive nel frontend Expo; il backend resta la verita condivisa del
magazzino, raggiunta via sync.

- **Modulo risoluzione codice** (`resolveCode`): dato un codice letto (QR/EAN/testo
  da wedge), trova il prodotto in locale (SQLite) con la stessa semantica del
  backend (`id`/`codice_prodotto`/`barcode`). Unico punto usato sia dalla
  fotocamera sia, in futuro, dalla penna ottica.
- **Schermata Cassa**: evoluzione di `vendita.tsx`. Righe con prezzo/quantita
  editabili; pulsante "riga rapida"; totale; "COMPLETA VENDITA".
- **Servizio vendita locale** (`createLocalSale` + sync): scrive la vendita e scala
  la giacenza in SQLite, marca `da_sincronizzare`, e un job di sync la propaga al
  backend cloud.
- **Generatore etichette** (`labelPdf`): produce un PDF A4 con griglia di QR
  (codice interno + descrizione + prezzo) per i prodotti selezionati.
- **`ReceiptPrinter`** (interfaccia): `printReceipt(vendita)`. Fase 1:
  `ManualReceiptPrinter` (no-op che mostra il totale). Fase 2: `RchReceiptPrinter`,
  `DitronReceiptPrinter`.

## Flusso dati (vendita)

1. Operatore scansiona (fotocamera) o aggiunge una riga rapida.
2. `resolveCode` trova il prodotto -> `addToCart`. Scan doppio = +1 sulla riga.
3. Se serve, l'operatore modifica prezzo/quantita della riga (anche 0€).
4. "COMPLETA VENDITA":
   a. `createLocalSale(righe)` scrive la vendita e **scala la giacenza locale**;
   b. `ReceiptPrinter.printReceipt(vendita)` (Fase 1: mostra il totale da battere);
   c. la vendita viene marcata `da_sincronizzare`;
   d. il job di **sync** la invia al backend (`POST /api/sales`) appena c'e rete.

## Modello dati

Nessuna nuova collection nel backend. Si sfruttano i campi prodotto attuali
(`codice_prodotto`, `barcode`, `prezzo_vendita`, `quantita`) e le tabelle locali
`sales` / `sale_items`. Agli sfusi tracciati si assegna un `codice_prodotto`
interno se mancante.

Punto da verificare in fase di piano: esiste gia un **sync delle vendite locali
verso il backend**? Se non c'e, va aggiunto (invio delle `sales` con
`da_sincronizzare` a `POST /api/sales`, con riconciliazione della giacenza lato
server).

## Gestione errori

- **Codice non trovato**: avviso; possibilita di aprire "nuovo prodotto" o riga
  rapida.
- **Giacenza insufficiente**: la riga si puo comunque vendere solo fino alla
  giacenza; feedback chiaro (coerente con il 409 del backend).
- **Scan doppio**: stesso codice due volte -> incrementa la quantita della riga
  esistente invece di duplicarla.
- **Rete assente**: la vendita si chiude comunque in locale; la sync avviene dopo.

## Testing

- Unit su `resolveCode` (id/codice/barcode, non trovato).
- Unit sulla codifica/decodifica del contenuto QR.
- Test sullo scarico giacenza locale e sull'accorpamento da scan doppio.
- Test sul percorso offline -> sync (vendita creata offline, propagata dopo).
- Test/anteprima della generazione del PDF etichette.

## Rischi e dipendenze (per la Fase 2)

- La stampa fiscale automatica dipende dal **modello RCH/Ditron esatto** e va
  provata con la cassa reale (RCH: webservice HTTP in LAN; Ditron: ponte Windows
  con WinEcrCom). Il gancio `ReceiptPrinter` isola questo rischio dalla logica di
  vendita.
- Il backend in cloud implica latenza/cadute: mitigato dall'offline-first.

## Fonti

- RCH — protocolli e integrazione: <https://support.rch.it/docs/print-3-0-rt/manuale-utente-print-3-0-rt/pagamenti-elettronici/>, <https://www.nabirio.com/it/software-gestione-magazzino-per-registratore-fiscale-rch-e-stampanti-fiscali-rch/>
- Ditron — driver WinEcrCom e stampa da gestionale: <https://www.edupass.it/manuali/manualistica-plan/manuale-prodotto?a=manuale-plan/configurazione/stampante/stampanti-fiscali>
