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
