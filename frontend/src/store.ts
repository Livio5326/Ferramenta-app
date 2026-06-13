import { create } from 'zustand';

export type Mode = 'gestore' | 'cliente';

export type Product = {
  id: string;
  codice_prodotto: string;
  barcode: string;
  descrizione: string;
  marca: string;
  categoria: string;
  prezzo_acquisto: number;
  prezzo_vendita: number;
  quantita: number;
  fornitore: string;
  foto: string;
  note: string;
  soglia_scorta: number;
  created_at?: string;
  updated_at?: string;
};

export type CartItem = {
  product: Product;
  quantita: number;
};

type State = {
  mode: Mode;
  cart: CartItem[];
  setMode: (m: Mode) => void;
  addToCart: (p: Product, q?: number) => void;
  removeFromCart: (id: string) => void;
  updateCartQty: (id: string, q: number) => void;
  clearCart: () => void;
};

export const useAppStore = create<State>((set) => ({
  mode: 'gestore',
  cart: [],
  setMode: (mode) => set({ mode }),
  addToCart: (product, q = 1) =>
    set((s) => {
      const existing = s.cart.find((c) => c.product.id === product.id);
      if (existing) {
        return {
          cart: s.cart.map((c) =>
            c.product.id === product.id ? { ...c, quantita: c.quantita + q } : c
          ),
        };
      }
      return { cart: [...s.cart, { product, quantita: q }] };
    }),
  removeFromCart: (id) => set((s) => ({ cart: s.cart.filter((c) => c.product.id !== id) })),
  updateCartQty: (id, q) =>
    set((s) => ({
      cart: s.cart
        .map((c) => (c.product.id === id ? { ...c, quantita: Math.max(0, q) } : c))
        .filter((c) => c.quantita > 0),
    })),
  clearCart: () => set({ cart: [] }),
}));

export const cartTotal = (cart: CartItem[]) =>
  cart.reduce((acc, c) => acc + c.product.prezzo_vendita * c.quantita, 0);
