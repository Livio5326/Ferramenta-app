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
