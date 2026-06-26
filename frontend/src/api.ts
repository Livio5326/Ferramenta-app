import { Product } from './store';

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '') + '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status}: ${txt}`);
  }
  return res.json();
}

export const api = {
  listProducts: (params: { q?: string; search_mode?: string; categoria?: string; marca_standard?: string; sotto_scorta?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.search_mode) qs.set('search_mode', params.search_mode);
    if (params.categoria) qs.set('categoria', params.categoria);
    if (params.marca_standard && params.marca_standard !== 'Tutte') qs.set('marca_standard', params.marca_standard);
    if (params.sotto_scorta) qs.set('sotto_scorta', 'true');
    

    const s = qs.toString();
    return req<Product[]>('/products' + (s ? '?' + s : ''));
  },
  listStandardBrands: () => req<{ items: string[] }>('/brands/standard'),
  listProductsPage: (params: { q?: string; search_mode?: string; categoria?: string; marca_standard?: string; sotto_scorta?: boolean; vendibile?: boolean;
   prezzo_min?: number; prezzo_max?: number; limit?: number; skip?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.search_mode) qs.set('search_mode', params.search_mode);
    if (params.categoria) qs.set('categoria', params.categoria);
    if (params.marca_standard && params.marca_standard !== 'Tutte') qs.set('marca_standard', params.marca_standard);
    if (params.sotto_scorta) qs.set('sotto_scorta', 'true');
    if (params.vendibile) qs.set('vendibile', 'true');
    if (params.da_completare) qs.set('da_completare', 'true');  
    if (params.prezzo_min !== undefined) qs.set('prezzo_min', String(params.prezzo_min));
    if (params.prezzo_max !== undefined) qs.set('prezzo_max', String(params.prezzo_max));
    qs.set('limit', String(params.limit ?? 50));
    qs.set('skip', String(params.skip ?? 0));
    return req<{ items: Product[]; total: number; limit: number; skip: number; has_more: boolean }>('/products/page?' + qs.toString());
  },
  getProduct: (id: string) => req<Product>(`/products/${id}`),
  getByBarcode: (b: string) => req<Product>(`/products/barcode/${encodeURIComponent(b)}`),
  createProduct: (p: Partial<Product>) =>
    req<Product>('/products', { method: 'POST', body: JSON.stringify(p) }),
  updateProduct: (id: string, p: Partial<Product>) =>
    req<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deleteProduct: (id: string) => req<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' }),
  adjustStock: (id: string, delta: number) =>
    req<Product>(`/products/${id}/adjust-stock`, { method: 'POST', body: JSON.stringify({ delta }) }),
  bulkImport: (items: Partial<Product>[]) =>
    req<{ inserted: number }>('/products/bulk', { method: 'POST', body: JSON.stringify(items) }),
  seed: () => req<{ seeded: boolean; count?: number }>('/seed', { method: 'POST' }),
  previewPromoImport: async (file: { uri: string; name?: string; mimeType?: string }, codeOverrides: Record<string, string> = {}) => {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name || 'promo.csv',
      type: file.mimeType || 'text/csv',
    } as any);
    form.append('code_overrides', JSON.stringify(codeOverrides));

    const res = await fetch(BASE + '/products/import-promo-prices/preview', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${res.status}: ${txt}`);
    }

    return res.json();
  },

  confirmPromoImport: async (
    file: { uri: string; name?: string; mimeType?: string },
    promo_nome: string,
    promo_inizio: string,
    promo_fine: string,
    codeOverrides: Record<string, string> = {}
  ) => {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name || 'promo.csv',
      type: file.mimeType || 'text/csv',
    } as any);
    form.append('promo_nome', promo_nome);
    form.append('promo_inizio', promo_inizio);
    form.append('promo_fine', promo_fine);
    form.append('code_overrides', JSON.stringify(codeOverrides));

    const res = await fetch(BASE + '/products/import-promo-prices/confirm', {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${res.status}: ${txt}`);
    }

    return res.json();
  },

  listActivePromos: () =>
    req<{
      totale_prodotti: number;
      riepilogo: Array<{
        promo_nome: string;
        prodotti: number;
        promo_inizio?: string;
        promo_fine?: string;
      }>;
      prodotti: Array<{
        id: string;
        codice_prodotto: string;
        barcode?: string;
        descrizione: string;
        marca?: string;
        marca_standard?: string;
        fornitore?: string;
        prezzo_vendita: number;
        prezzo_promo: number;
        promo_attiva: boolean;
        promo_nome: string;
        promo_inizio?: string;
        promo_fine?: string;
        ultimo_aggiornamento_promo?: string;
      }>;
    }>('/products/promos'),

  activatePromoByName: (promoNome: string) =>
    req<{ ok: boolean; promo_nome: string; attivati: number }>(
      `/products/promos/${encodeURIComponent(promoNome)}/activate`,
      { method: 'POST' }
    ),

  deactivatePromoByName: (promoNome: string) =>
    req<{ ok: boolean; promo_nome: string; disattivati: number }>(
      `/products/promos/${encodeURIComponent(promoNome)}/deactivate`,
      { method: 'POST' }
    ),

  deletePromoByName: (promoNome: string) =>
    req<{ ok: boolean; promo_nome: string; eliminati: number }>(
      `/products/promos/${encodeURIComponent(promoNome)}`,
      { method: 'DELETE' }
    ),

  deactivatePromoPrices: () =>
    req<{ ok: boolean; disattivati: number }>('/products/promo/deactivate', { method: 'POST' }),

  meta: () => req<{ categorie: string[]; marche: string[]; fornitori: string[] }>('/meta'),
  statistiche: () =>
    req<{
      total_products: number;
      total_pieces: number;
      valore_magazzino: number;
      valore_vendita_potenziale: number;
      sotto_scorta_count: number;
      sotto_scorta: Product[];
      categorie: { nome: string; count: number }[];
      vendite_totali: number;
      numero_vendite: number;
    }>('/statistiche'),
  createSale: (items: { product_id: string; descrizione: string; prezzo_vendita: number; quantita: number }[]) =>
    req<{ id: string; totale: number }>('/sales', { method: 'POST', body: JSON.stringify({ items }) }),

  listSearchSynonyms: async () => {
    return req<{ termine: string; sinonimi: string[] }[]>('/search-synonyms');
  },

  saveSearchSynonym: async (payload: { termine: string; sinonimi: string[] }) => {
    return req('/search-synonyms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteSearchSynonym: async (termine: string) => {
    return req(`/search-synonyms/${encodeURIComponent(termine)}`, {
      method: 'DELETE',
    });
  },
};
export async function importInvoiceXml(file: {
  uri: string;
  name: string;
  mimeType?: string;
}) {
  const formData = new FormData();

  formData.append("file", {
    uri: file.uri,
    name: file.name || "fattura.xml",
    type: file.mimeType || "text/xml",
  } as any);

  const res = await fetch(`${BASE}/invoices/import-xml`, {
    method: "POST",
    body: formData,
  });

  const text = await res.text();

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: false, errore: text };
  }

  if (!res.ok) {
    throw new Error(data?.errore || data?.detail || text);
  }

  return data;
}

export async function listInvoiceImports() {
  const res = await fetch(`${BASE}/invoices/imports`);

  const text = await res.text();

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { items: [], total: 0, errore: text };
  }

  if (!res.ok) {
    throw new Error(data?.errore || data?.detail || text);
  }

  return data;
}

export async function getMissingInvoiceProducts(filePath: string) {
  const qs = new URLSearchParams();
  qs.set("file_path", filePath);

  const res = await fetch(`${BASE}/invoices/missing-products?${qs.toString()}`);

  const text = await res.text();

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { items: [], total: 0, errore: text };
  }

  if (!res.ok) {
    throw new Error(data?.errore || data?.detail || text);
  }

  return data;
}

export async function createPendingInvoiceProducts(items: any[]) {
  const res = await fetch(`${BASE}/invoices/pending-products/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  const text = await res.text();

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { ok: false, errore: text };
  }

  if (!res.ok) {
    throw new Error(data?.errore || data?.detail || text);
  }

  return data;
}
