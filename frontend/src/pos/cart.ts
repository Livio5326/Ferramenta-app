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

export function sellableLines(cart: CartItem[]): CartItem[] {
  return cart.filter((c) => c.manuale || Number(c.product.quantita ?? 0) > 0);
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
    quantita,
    fornitore: '',
    foto: '',
    note: '',
    soglia_scorta: 0,
  };
  return { product, quantita, prezzoOverride: prezzoUnitario, manuale: true };
}
