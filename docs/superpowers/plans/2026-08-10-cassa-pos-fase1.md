# Cassa POS (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare la schermata Vendita in una cassa da banco dove ogni riga ha prezzo e quantita modificabili (anche 0€), si puo aggiungere una "riga rapida" a prezzo libero che non tocca il magazzino, e alla conferma la vendita scala il magazzino (via `createSale` online esistente) passando da un gancio di stampa predisposto.

**Architecture:** La logica di calcolo (prezzo effettivo di riga, subtotali, totale, costruzione del payload di vendita, riga manuale) vive in un modulo puro `frontend/src/pos/cart.ts`, unit-testato. Il gancio di stampa e un'interfaccia `ReceiptPrinter` con implementazione `ManualReceiptPrinter` in `frontend/src/pos/receiptPrinter.ts`. Lo store Zustand esistente viene esteso in modo retro-compatibile (campi opzionali sul `CartItem`, nuove azioni) senza toccare i flussi cliente. La schermata `vendita.tsx` consuma questi moduli.

**Tech Stack:** React Native (Expo 54), TypeScript, Zustand, jest-expo per i test unit.

## Global Constraints

- TypeScript senza errori: `npx tsc --noEmit` deve passare.
- Sentinella colori del tema: `node ./scripts/check-theme.mjs` deve restituire "Sentinella a posto" (nessun colore scritto a mano; usare solo i token di `@/src/theme`).
- Riuso dell'API esistente: la vendita usa `api.createSale(items)` con `items: { product_id: string; descrizione: string; prezzo_vendita: number; quantita: number }[]` (in `frontend/src/api.ts:470`). Non modificare il backend in questo piano.
- Font personalizzati su Android: NON usare `fontWeight` insieme a una `fontFamily` esplicita (non si sintetizza); il peso si sceglie con la `fontFamily` (vedi `frontend/src/theme.ts`).
- Importi in EUR, formattati con `fmtEUR` da `@/src/theme`.
- Le righe manuali (prezzo libero) NON toccano il magazzino e NON vengono inviate a `createSale`.

---

### Task 1: Setup del runner di test (jest-expo)

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/jest.config.js`
- Create: `frontend/src/pos/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nulla.
- Produces: comando `npm test` funzionante nel frontend; convenzione file di test in `src/**/__tests__/*.test.ts`.

- [ ] **Step 1: Aggiungere le devDependencies e lo script test**

In `frontend/package.json`, aggiungere allo script block `"test": "jest"` e alle `devDependencies`:

```json
"jest": "~29.7.0",
"jest-expo": "~54.0.0",
"@types/jest": "~29.5.12"
```

- [ ] **Step 2: Creare la config jest**

`frontend/jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|zustand))',
  ],
};
```

- [ ] **Step 3: Installare e scrivere uno smoke test**

Run: `npm install` (in `frontend/`)

`frontend/src/pos/__tests__/smoke.test.ts`:

```ts
test('jest funziona', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Eseguire i test**

Run: `npm test -- src/pos/__tests__/smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/jest.config.js frontend/src/pos/__tests__/smoke.test.ts frontend/package-lock.json
git commit -m "chore: aggiunge jest-expo per i test unit del frontend"
```

---

### Task 2: Modulo puro della cassa (`cart.ts`)

**Files:**
- Create: `frontend/src/pos/cart.ts`
- Test: `frontend/src/pos/__tests__/cart.test.ts`

**Interfaces:**
- Consumes: `Product`, `CartItem`, `getPrezzoFinale` da `@/src/store` (in Task 4 il `CartItem` verra esteso con `prezzoOverride?: number | null` e `manuale?: boolean`; qui usiamo gia questi campi opzionali).
- Produces:
  - `lineUnitPrice(item: CartItem): number` — prezzo effettivo di riga (override se presente, altrimenti `getPrezzoFinale(product)`).
  - `lineSubtotal(item: CartItem): number`
  - `cartTotalPos(cart: CartItem[]): number`
  - `buildSalePayload(cart: CartItem[]): { product_id: string; descrizione: string; prezzo_vendita: number; quantita: number }[]` — solo righe NON manuali.
  - `makeManualLine(descrizione: string, prezzoUnitario: number, quantita: number): CartItem` — riga con `manuale: true` e product sintetico.

- [ ] **Step 1: Scrivere i test falliti**

`frontend/src/pos/__tests__/cart.test.ts`:

```ts
import {
  lineUnitPrice,
  lineSubtotal,
  cartTotalPos,
  buildSalePayload,
  makeManualLine,
} from '../cart';
import type { CartItem, Product } from '@/src/store';

function prod(over: Partial<Product> = {}): Product {
  return {
    id: 'P1', codice_prodotto: 'C1', barcode: 'B1', descrizione: 'Vite',
    marca: '', categoria: '', prezzo_acquisto: 0, prezzo_vendita: 10,
    quantita: 100, fornitore: '', foto: '', note: '', soglia_scorta: 0,
    ...over,
  };
}

test('lineUnitPrice usa il prezzo di listino senza override', () => {
  const item: CartItem = { product: prod(), quantita: 2 };
  expect(lineUnitPrice(item)).toBe(10);
});

test('lineUnitPrice rispetta override, anche 0', () => {
  const item: CartItem = { product: prod(), quantita: 3, prezzoOverride: 0 };
  expect(lineUnitPrice(item)).toBe(0);
});

test('lineSubtotal e cartTotalPos sommano con override', () => {
  const a: CartItem = { product: prod({ id: 'A' }), quantita: 2 };
  const b: CartItem = { product: prod({ id: 'B' }), quantita: 5, prezzoOverride: 2 };
  expect(lineSubtotal(a)).toBe(20);
  expect(lineSubtotal(b)).toBe(10);
  expect(cartTotalPos([a, b])).toBe(30);
});

test('buildSalePayload esclude le righe manuali e usa il prezzo effettivo', () => {
  const p: CartItem = { product: prod({ id: 'A', descrizione: 'Vite' }), quantita: 2, prezzoOverride: 8 };
  const m = makeManualLine('Chiodi sfusi', 0, 30);
  const payload = buildSalePayload([p, m]);
  expect(payload).toEqual([
    { product_id: 'A', descrizione: 'Vite', prezzo_vendita: 8, quantita: 2 },
  ]);
});

test('makeManualLine crea riga manuale che non tocca il magazzino', () => {
  const m = makeManualLine('Chiodi', 1.5, 4);
  expect(m.manuale).toBe(true);
  expect(lineUnitPrice(m)).toBe(1.5);
  expect(lineSubtotal(m)).toBe(6);
  expect(buildSalePayload([m])).toEqual([]);
});
```

- [ ] **Step 2: Eseguire i test per verificarne il fallimento**

Run: `npm test -- src/pos/__tests__/cart.test.ts`
Expected: FAIL ("Cannot find module '../cart'")

- [ ] **Step 3: Implementare il modulo**

`frontend/src/pos/cart.ts`:

```ts
import { getPrezzoFinale, type CartItem, type Product } from '@/src/store';

export function lineUnitPrice(item: CartItem): number {
  if (item.prezzoOverride !== undefined && item.prezzoOverride !== null) {
    return Number(item.prezzoOverride);
  }
  return getPrezzoFinale(item.product);
}

export function lineSubtotal(item: CartItem): number {
  return lineUnitPrice(item) * item.quantita;
}

export function cartTotalPos(cart: CartItem[]): number {
  return cart.reduce((acc, item) => acc + lineSubtotal(item), 0);
}

export function buildSalePayload(cart: CartItem[]) {
  return cart
    .filter((item) => !item.manuale)
    .map((item) => ({
      product_id: String(
        item.product.id || item.product.codice_prodotto || item.product.barcode
      ),
      descrizione: item.product.descrizione,
      prezzo_vendita: lineUnitPrice(item),
      quantita: item.quantita,
    }));
}

export function makeManualLine(
  descrizione: string,
  prezzoUnitario: number,
  quantita: number
): CartItem {
  const id = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const product: Product = {
    id,
    codice_prodotto: '',
    barcode: '',
    descrizione,
    marca: '',
    categoria: '',
    prezzo_acquisto: 0,
    prezzo_vendita: prezzoUnitario,
    quantita: Number.MAX_SAFE_INTEGER,
    fornitore: '',
    foto: '',
    note: '',
    soglia_scorta: 0,
  };
  return { product, quantita, prezzoOverride: prezzoUnitario, manuale: true };
}
```

- [ ] **Step 4: Eseguire i test per verificarne il successo**

Run: `npm test -- src/pos/__tests__/cart.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pos/cart.ts frontend/src/pos/__tests__/cart.test.ts
git commit -m "feat: logica pura della cassa (prezzo di riga, totali, payload, riga manuale)"
```

---

### Task 3: Gancio di stampa (`ReceiptPrinter` + `ManualReceiptPrinter`)

**Files:**
- Create: `frontend/src/pos/receiptPrinter.ts`
- Test: `frontend/src/pos/__tests__/receiptPrinter.test.ts`

**Interfaces:**
- Consumes: `cartTotalPos` da `../cart`; `CartItem` da `@/src/store`.
- Produces:
  - `type Receipt = { total: number; righe: { descrizione: string; quantita: number; prezzo: number }[] }`
  - `interface ReceiptPrinter { printReceipt(receipt: Receipt): Promise<{ printed: boolean; total: number }> }`
  - `class ManualReceiptPrinter implements ReceiptPrinter` — non stampa nulla, restituisce `{ printed: false, total }`.
  - `buildReceipt(cart: CartItem[]): Receipt`

- [ ] **Step 1: Scrivere i test falliti**

`frontend/src/pos/__tests__/receiptPrinter.test.ts`:

```ts
import { ManualReceiptPrinter, buildReceipt } from '../receiptPrinter';
import { makeManualLine } from '../cart';
import type { CartItem, Product } from '@/src/store';

function prod(over: Partial<Product> = {}): Product {
  return {
    id: 'P1', codice_prodotto: '', barcode: '', descrizione: 'Vite',
    marca: '', categoria: '', prezzo_acquisto: 0, prezzo_vendita: 10,
    quantita: 100, fornitore: '', foto: '', note: '', soglia_scorta: 0, ...over,
  };
}

test('buildReceipt include tutte le righe (anche manuali) e il totale', () => {
  const p: CartItem = { product: prod(), quantita: 2 };
  const m = makeManualLine('Chiodi', 0, 30);
  const r = buildReceipt([p, m]);
  expect(r.total).toBe(20);
  expect(r.righe).toEqual([
    { descrizione: 'Vite', quantita: 2, prezzo: 10 },
    { descrizione: 'Chiodi', quantita: 30, prezzo: 0 },
  ]);
});

test('ManualReceiptPrinter non stampa ma riporta il totale', async () => {
  const printer = new ManualReceiptPrinter();
  const res = await printer.printReceipt({ total: 20, righe: [] });
  expect(res).toEqual({ printed: false, total: 20 });
});
```

- [ ] **Step 2: Eseguire i test per verificarne il fallimento**

Run: `npm test -- src/pos/__tests__/receiptPrinter.test.ts`
Expected: FAIL ("Cannot find module '../receiptPrinter'")

- [ ] **Step 3: Implementare il modulo**

`frontend/src/pos/receiptPrinter.ts`:

```ts
import { lineUnitPrice, cartTotalPos } from './cart';
import type { CartItem } from '@/src/store';

export type Receipt = {
  total: number;
  righe: { descrizione: string; quantita: number; prezzo: number }[];
};

export interface ReceiptPrinter {
  printReceipt(receipt: Receipt): Promise<{ printed: boolean; total: number }>;
}

export function buildReceipt(cart: CartItem[]): Receipt {
  return {
    total: cartTotalPos(cart),
    righe: cart.map((item) => ({
      descrizione: item.product.descrizione,
      quantita: item.quantita,
      prezzo: lineUnitPrice(item),
    })),
  };
}

// Fase 1: nessuna stampa automatica. Il totale viene mostrato all'operatore,
// che lo batte sulla cassa fiscale autonoma. Le implementazioni RCH/Ditron
// (Fase 2) rispettano la stessa interfaccia senza toccare la logica di vendita.
export class ManualReceiptPrinter implements ReceiptPrinter {
  async printReceipt(receipt: Receipt) {
    return { printed: false, total: receipt.total };
  }
}
```

- [ ] **Step 4: Eseguire i test per verificarne il successo**

Run: `npm test -- src/pos/__tests__/receiptPrinter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pos/receiptPrinter.ts frontend/src/pos/__tests__/receiptPrinter.test.ts
git commit -m "feat: interfaccia ReceiptPrinter e ManualReceiptPrinter (predisposizione stampa fiscale)"
```

---

### Task 4: Estendere lo store (override prezzo, riga manuale)

**Files:**
- Modify: `frontend/src/store.ts`
- Test: `frontend/src/pos/__tests__/store-pos.test.ts`

**Interfaces:**
- Consumes: `cartTotalPos`, `makeManualLine` da `@/src/pos/cart`.
- Produces (nuovi campi/azioni retro-compatibili):
  - `CartItem` esteso con `prezzoOverride?: number | null` e `manuale?: boolean`.
  - `setCartPrice(id: string, prezzo: number): void`
  - `addManualLine(descrizione: string, prezzo: number, quantita: number): void`
  - `cartTotal` (export esistente) ora delega a `cartTotalPos`.

- [ ] **Step 1: Scrivere i test falliti**

`frontend/src/pos/__tests__/store-pos.test.ts`:

```ts
import { useAppStore, cartTotal } from '@/src/store';
import type { Product } from '@/src/store';

function prod(over: Partial<Product> = {}): Product {
  return {
    id: 'P1', codice_prodotto: '', barcode: '', descrizione: 'Vite',
    marca: '', categoria: '', prezzo_acquisto: 0, prezzo_vendita: 10,
    quantita: 100, fornitore: '', foto: '', note: '', soglia_scorta: 0, ...over,
  };
}

beforeEach(() => useAppStore.getState().clearCart());

test('setCartPrice imposta un override, anche 0', () => {
  useAppStore.getState().addToCart(prod(), 2);
  useAppStore.getState().setCartPrice('P1', 0);
  expect(cartTotal(useAppStore.getState().cart)).toBe(0);
});

test('addManualLine aggiunge una riga manuale a prezzo libero', () => {
  useAppStore.getState().addManualLine('Chiodi sfusi', 1.5, 4);
  const cart = useAppStore.getState().cart;
  expect(cart).toHaveLength(1);
  expect(cart[0].manuale).toBe(true);
  expect(cartTotal(cart)).toBe(6);
});
```

- [ ] **Step 2: Eseguire i test per verificarne il fallimento**

Run: `npm test -- src/pos/__tests__/store-pos.test.ts`
Expected: FAIL (`setCartPrice is not a function`)

- [ ] **Step 3: Implementare le modifiche allo store**

In `frontend/src/store.ts`:

1. Estendere il tipo `CartItem`:

```ts
export type CartItem = {
  product: Product;
  quantita: number;
  prezzoOverride?: number | null;
  manuale?: boolean;
};
```

2. Aggiungere gli import in cima (dopo l'import di zustand):

```ts
import { cartTotalPos, makeManualLine } from '@/src/pos/cart';
```

3. Aggiungere alla firma di `State` le nuove azioni:

```ts
  setCartPrice: (id: string, prezzo: number) => void;
  addManualLine: (descrizione: string, prezzo: number, quantita: number) => void;
```

4. Implementarle dentro `create<State>`:

```ts
  setCartPrice: (id, prezzo) =>
    set((s) => ({
      cart: s.cart.map((c) =>
        getProductId(c.product) === id ? { ...c, prezzoOverride: prezzo } : c
      ),
    })),

  addManualLine: (descrizione, prezzo, quantita) =>
    set((s) => ({ cart: [...s.cart, makeManualLine(descrizione, prezzo, quantita)] })),
```

5. Sostituire l'export finale `cartTotal` con la delega al modulo puro:

```ts
export const cartTotal = (cart: CartItem[]) => cartTotalPos(cart);
```

Nota: `cart.ts` importa `getPrezzoFinale` e i tipi da `store.ts`, e `store.ts` importa da `cart.ts`. E un ciclo di soli tipi/funzioni puri risolto a runtime (nessun uso a top-level init): va bene con il bundler Metro e con jest. Se emergesse un problema di import circolare nei test, spostare `getPrezzoFinale`, `Product`, `CartItem` in `frontend/src/pos/cart.ts` e ri-esportarli da `store.ts`.

- [ ] **Step 4: Eseguire i test e il typecheck**

Run: `npm test -- src/pos/__tests__/store-pos.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store.ts frontend/src/pos/__tests__/store-pos.test.ts
git commit -m "feat: store con override prezzo di riga e riga manuale a prezzo libero"
```

---

### Task 5: UI cassa in `vendita.tsx` (prezzo/quantita editabili, riga rapida, gancio stampa)

**Files:**
- Modify: `frontend/app/(tabs)/vendita.tsx`

**Interfaces:**
- Consumes: `setCartPrice`, `addManualLine`, `updateCartQty`, `removeFromCart`, `clearCart`, `cart`, `cartTotal` da `@/src/store`; `lineUnitPrice`, `lineSubtotal`, `buildSalePayload` da `@/src/pos/cart`; `ManualReceiptPrinter`, `buildReceipt` da `@/src/pos/receiptPrinter`; `api.createSale`.
- Produces: schermata cassa completa. Nessun consumatore a valle in questo piano.

- [ ] **Step 1: Prezzo di riga editabile**

Nel `renderItem` del `FlatList`, sostituire la riga prezzo statica (`{fmtEUR(prezzoFinaleProdotto(item.product))} cad.`) con un `TextInput` numerico che scrive l'override:

```tsx
<TextInput
  style={styles.priceInput}
  keyboardType="decimal-pad"
  defaultValue={String(lineUnitPrice(item))}
  onEndEditing={(e) => {
    const v = parseFloat(e.nativeEvent.text.replace(',', '.'));
    setCartPrice(item.product.id, Number.isFinite(v) ? v : 0);
  }}
  testID={`price-input-${item.product.id}`}
/>
```

Aggiungere lo stile `priceInput` (usando SOLO token del tema, es. `borderColor: COLORS.borderStrong`, `color: COLORS.onSurface`, `fontFamily: FONTS.mono`). Rimuovere la dipendenza locale da `prezzoFinaleProdotto` per il prezzo di riga (usare `lineUnitPrice`); mantenere `haPromoProdotto` per il badge PROMO.

- [ ] **Step 2: Subtotale di riga dal modulo puro**

Sostituire `fmtEUR(prezzoFinaleProdotto(item.product) * item.quantita)` con `fmtEUR(lineSubtotal(item))`.

- [ ] **Step 3: Pulsante "Riga rapida"**

Aggiungere in testa alla lista (o nell'header `right`) un `AppButton` "RIGA RAPIDA" che apre un `Modal` con due `TextInput` (descrizione, prezzo) e un `onPress` che chiama `addManualLine(descrizione, prezzo, 1)`. Il prezzo puo essere 0. Usare i token del tema per gli stili.

- [ ] **Step 4: Conferma vendita con payload dal modulo + gancio stampa**

Sostituire il corpo di `completa` con:

```tsx
const completa = async () => {
  const payload = buildSalePayload(cartVendibile);
  if (payload.length === 0 && cartVendibile.length === 0) return;
  setCompleting(true);
  try {
    if (payload.length > 0) {
      await api.createSale(payload);
    }
    const printer = new ManualReceiptPrinter();
    const { total: stampato } = await printer.printReceipt(buildReceipt(cartVendibile));
    clearCart();
    Alert.alert('Vendita completata', `Totale da battere in cassa: ${fmtEUR(stampato)}`);
  } catch (e: any) {
    Alert.alert('Errore', String(e?.message || e));
  } finally {
    setCompleting(false);
  }
};
```

Nota: `cartVendibile` attualmente filtra `quantita > 0` del prodotto; le righe manuali hanno `quantita` prodotto = MAX_SAFE_INTEGER quindi passano il filtro. Verificare che il filtro `cartVendibile` non escluda le righe manuali (lo garantisce il product sintetico).

- [ ] **Step 5: Verifiche**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `node ./scripts/check-theme.mjs`
Expected: "Sentinella a posto"

Verifica manuale sul dispositivo (Metro hot-reload): aggiungere un prodotto da scanner, modificarne il prezzo a 0, aggiungere una riga rapida, completare la vendita e controllare che il magazzino del prodotto scali e la riga manuale non lo tocchi.

- [ ] **Step 6: Commit**

```bash
git add "frontend/app/(tabs)/vendita.tsx"
git commit -m "feat: cassa con prezzo/quantita editabili, riga rapida e gancio stampa"
```

---

## Self-Review

**Spec coverage (sottosistema 1 dello spec):**
- Prezzo/quantita modificabili al banco (incl. 0€) → Task 2 (`lineUnitPrice` con override), Task 4 (`setCartPrice`), Task 5 (Step 1).
- Riga rapida a prezzo libero senza toccare il magazzino → Task 2 (`makeManualLine`, `buildSalePayload` esclude manuali), Task 4 (`addManualLine`), Task 5 (Step 3).
- Scarico magazzino alla conferma (online `createSale`) → Task 5 (Step 4).
- Gancio di stampa predisposto (manuale in Fase 1) → Task 3, Task 5 (Step 4).
- Scan doppio accorpa quantita → gia garantito da `addToCart` esistente (store.ts:85-96); nessuna nuova logica necessaria.
- Scansione fotocamera → gia esistente (`scanner.tsx`), invariata.

Fuori da questo piano (altri sottosistemi, piani separati): etichette QR (PDF), vendite offline-first + sync.

**Placeholder scan:** nessun "TBD"/"gestire errori" generico; ogni step ha codice o comando concreto.

**Type consistency:** `lineUnitPrice`/`lineSubtotal`/`cartTotalPos`/`buildSalePayload`/`makeManualLine` (Task 2) sono usati con le stesse firme in Task 3, 4, 5. `Receipt`/`ReceiptPrinter`/`ManualReceiptPrinter`/`buildReceipt` (Task 3) usati coerentemente in Task 5. `CartItem` esteso (Task 4) coerente con l'uso dei campi `prezzoOverride`/`manuale` in Task 2.
