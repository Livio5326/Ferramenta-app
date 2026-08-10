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
