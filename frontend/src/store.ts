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
  prezzo_promo?: number | null;
  promo_attiva?: boolean;
  promo_nome?: string;
  promo_inizio?: string;
  promo_fine?: string;
  ultimo_aggiornamento_promo?: string;
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
  prezzoOverride?: number | null;
  manuale?: boolean;
};

function getProductId(product: Product): string {
  return String(
    product.id ||
    (product as Product & { _id?: string })._id ||
    product.codice_prodotto ||
    product.barcode ||
    ''
  );
}

export function getPrezzoFinale(product: Product): number {
  const prezzoPromo = Number(product.prezzo_promo || 0);
  if (product.promo_attiva && prezzoPromo > 0) {
    return prezzoPromo;
  }
  return Number(product.prezzo_vendita || 0);
}

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
  mode: 'cliente',
  cart: [],
  setMode: (mode) => set({ mode }),
  
  addToCart: (product, q = 1) =>
    set((s) => {
      const disponibile = Number(product.quantita ?? 0);
      const productId = getProductId(product);

      if (disponibile <= 0 || !productId) {
        return s;
      }

      const normalizedProduct = {
        ...product,
        id: productId,
      };

      const existing = s.cart.find(
        (c) => getProductId(c.product) === productId
      );

      if (existing) {
        return {
          cart: s.cart.map((c) =>
            getProductId(c.product) === productId
              ? {
                  ...c,
                  product: normalizedProduct,
                  quantita: Math.min(disponibile, c.quantita + q),
                }
              : c
          ),
        };
      }

      return {
        cart: [
          ...s.cart,
          {
            product: normalizedProduct,
            quantita: Math.min(disponibile, q),
          },
        ],
      };
    }),

  removeFromCart: (id) =>
    set((s) => ({
      cart: s.cart.filter((c) => getProductId(c.product) !== id),
    })),

  updateCartQty: (id, q) =>
    set((s) => ({
      cart: s.cart
        .map((c) =>
          getProductId(c.product) === id
            ? {
                ...c,
                quantita: Math.min(
                  Number(c.product.quantita ?? 0),
                  Math.max(0, q)
                ),
              }
            : c
        )
        .filter((c) => c.quantita > 0),
    })),  

  clearCart: () => set({ cart: [] }),
}));

export const cartTotal = (cart: CartItem[]) =>
  cart.reduce((acc, c) => acc + getPrezzoFinale(c.product) * c.quantita, 0);
