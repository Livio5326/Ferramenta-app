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

test('updateCartQty consente di aumentare la quantita di una riga manuale oltre 1', () => {
  useAppStore.getState().addManualLine('Chiodi sfusi', 2, 1);
  const id = useAppStore.getState().cart[0].product.id;
  useAppStore.getState().updateCartQty(id, 5);
  const cart = useAppStore.getState().cart;
  expect(cart).toHaveLength(1);
  expect(cart[0].quantita).toBe(5);
  expect(cartTotal(cart)).toBe(10);
});
