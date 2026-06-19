import { create } from 'zustand';

export type ClienteItem = {
  id: string;
  descrizione: string;
  marca?: string;
  codice_prodotto?: string;
  barcode?: string;
  foto?: string;
  prezzo: number;
  quantitaCarrello: number;
};

type ClienteState = {
  listaDesideri: ClienteItem[];
  carrello: ClienteItem[];

  aggiungiDesideri: (prodotto: any, quantita?: number) => void;
  aggiungiCarrello: (prodotto: any, quantita?: number) => void;

  rimuoviDesideri: (id: string) => void;
  rimuoviCarrello: (id: string) => void;

  svuotaCarrello: () => void;
};

function getPrezzo(prodotto: any): number {
  const promoAttiva = prodotto?.promo_attiva === true;
  const prezzoPromo = Number(prodotto?.prezzo_promo || 0);
  const prezzoVendita = Number(prodotto?.prezzo_vendita || 0);

  if (promoAttiva && prezzoPromo > 0) {
    return prezzoPromo;
  }

  return prezzoVendita;
}

function normalizzaProdotto(prodotto: any): ClienteItem {
  return {
    id: String(prodotto?.id || prodotto?._id || prodotto?.codice_prodotto || prodotto?.barcode),
    descrizione: String(prodotto?.descrizione || prodotto?.nome || 'Prodotto'),
    marca: prodotto?.marca_standard || prodotto?.marca || '',
    codice_prodotto: prodotto?.codice_prodotto || '',
    barcode: prodotto?.barcode || '',
    foto: prodotto?.foto || '',
    prezzo: getPrezzo(prodotto),
    quantitaCarrello: 1,
  };
}

export const useClienteStore = create<ClienteState>((set) => ({
  listaDesideri: [],
  carrello: [],

aggiungiDesideri: (prodotto, quantita = 1) =>
  set((state) => {
    const qta = Math.max(1, Number(quantita || 1));

    const item = {
      ...normalizzaProdotto(prodotto),
      quantitaCarrello: qta,
    };

    const esisteGia = state.listaDesideri.some((p) => p.id === item.id);

    if (esisteGia) {
      return {
        listaDesideri: state.listaDesideri.map((p) => {
          if (p.id !== item.id) {
            return p;
          }

          return {
            ...p,
            quantitaCarrello: p.quantitaCarrello + qta,
          };
        }),
      };
    }

    return {
      listaDesideri: [...state.listaDesideri, item],
    };
  }), 

aggiungiCarrello: (prodotto, quantita = 1) =>
  set((state) => {
    const qta = Math.max(1, Number(quantita || 1));
    const item = {
      ...normalizzaProdotto(prodotto),
      quantitaCarrello: qta,
    };

    const carrelloAggiornato = state.carrello.map((p) => {
      if (p.id !== item.id) {
        return p;
      }

      return {
        ...p,
        quantitaCarrello: p.quantitaCarrello + qta,
      };
    });

    const esisteGia = state.carrello.some((p) => p.id === item.id);

    return {
      carrello: esisteGia ? carrelloAggiornato : [...state.carrello, item],
    };
  }),

  rimuoviDesideri: (id) =>
    set((state) => ({
      listaDesideri: state.listaDesideri.filter((p) => p.id !== id),
    })),

  rimuoviCarrello: (id) =>
    set((state) => ({
      carrello: state.carrello.filter((p) => p.id !== id),
    })),

  svuotaCarrello: () =>
    set(() => ({
      carrello: [],
    })),
}));