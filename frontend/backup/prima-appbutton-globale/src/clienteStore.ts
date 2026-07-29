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

export type RichiestaOrdineCliente = {
  id: string;
  prodottoId: string;
  descrizione: string;
  marca?: string;
  codice_prodotto?: string;
  barcode?: string;
  foto?: string;
  prezzo: number;
  quantitaRichiesta: number;
  stato: 'nuova' | 'vista' | 'ordinata' | 'annullata';
  creataIl: string;
};

type ClienteState = {
  listaDesideri: ClienteItem[];
  carrello: ClienteItem[];
  richiesteOrdine: RichiestaOrdineCliente[];

  aggiungiDesideri: (prodotto: any, quantita?: number) => void;
  aggiungiCarrello: (prodotto: any, quantita?: number) => void;
  richiediOrdine: (prodotto: any, quantita?: number) => void;

  rimuoviDesideri: (id: string) => void;
  rimuoviCarrello: (id: string) => void;
  
  aggiornaQuantitaCarrello: (id: string, quantita: number) => void;
  aggiornaQuantitaDesideri: (id: string, quantita: number) => void;

  svuotaCarrello: () => void;
};

function getPrezzo(prodotto: any): number {
  const promoAttiva = prodotto?.promo_attiva === true;
  const prezzoPromo = Number(prodotto?.prezzo_promo || 0);
  const prezzoVendita = Number(prodotto?.prezzo_vendita || 0);
  const prezzoNormale = Number(prodotto?.prezzo || 0);
  if (promoAttiva && prezzoPromo > 0) {
    return prezzoPromo;
  }

  if (prezzoVendita > 0) {
  return prezzoVendita;
}

return prezzoNormale;
}

function normalizzaProdotto(prodotto: any): ClienteItem {
  return {
    id: String(
      prodotto?.id ||
        prodotto?._id ||
        prodotto?.codice_prodotto ||
        prodotto?.barcode ||
        Date.now()
    ),
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
  richiesteOrdine: [],

  aggiungiDesideri: (prodotto: any, quantita = 1) =>
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

  aggiungiCarrello: (prodotto: any, quantita = 1) =>
    set((state) => {
      const qta = Math.max(1, Number(quantita || 1));

      const item = {
        ...normalizzaProdotto(prodotto),
        quantitaCarrello: qta,
      };

      const esisteGia = state.carrello.some((p) => p.id === item.id);

      if (esisteGia) {
        return {
          carrello: state.carrello.map((p) => {
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
        carrello: [...state.carrello, item],
      };
    }),

  richiediOrdine: (prodotto: any, quantita = 1) =>
    set((state) => {
      const qta = Math.max(1, Number(quantita || 1));
      const item = normalizzaProdotto(prodotto);

      const richiesta: RichiestaOrdineCliente = {
        id: `${item.id}-${Date.now()}`,
        prodottoId: item.id,
        descrizione: item.descrizione,
        marca: item.marca,
        codice_prodotto: item.codice_prodotto,
        barcode: item.barcode,
        foto: item.foto,
        prezzo: item.prezzo,
        quantitaRichiesta: qta,
        stato: 'nuova',
        creataIl: new Date().toISOString(),
      };

      return {
        richiesteOrdine: [richiesta, ...state.richiesteOrdine],
      };
    }),

  rimuoviDesideri: (id: string) =>
    set((state) => ({
      listaDesideri: state.listaDesideri.filter((p) => p.id !== id),
    })),

  rimuoviCarrello: (id: string) =>
    set((state) => ({
      carrello: state.carrello.filter((p) => p.id !== id),
    })),

  svuotaCarrello: () =>
    set(() => ({
      carrello: [],
    })),aggiornaQuantitaCarrello: (id, quantita) => {
  const nuovaQuantita = Math.max(1, Number(quantita || 1));

  set((state) => ({
    carrello: state.carrello.map((item) =>
      item.id === id
        ? { ...item, quantitaCarrello: nuovaQuantita }
        : item
    ),
  }));
},

aggiornaQuantitaDesideri: (id, quantita) => {
  const nuovaQuantita = Math.max(1, Number(quantita || 1));

  set((state) => ({
    listaDesideri: state.listaDesideri.map((item) =>
      item.id === id
        ? { ...item, quantitaCarrello: nuovaQuantita }
        : item
    ),
  }));
},


}));