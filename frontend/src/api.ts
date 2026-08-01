import { Product } from './store';
import * as SecureStore from 'expo-secure-store';
import {
  importInvoiceXmlOffline,
  listInvoiceImportsOffline,
  getPendingInvoiceProductsOffline,
  createPendingInvoiceProductsOffline,
  getInvoiceProductsOffline,
} from "./local/invoiceImporter";
import { getDb } from "./local/db";
import { API_URL } from './config/backend';

const BASE = API_URL;
const TOKEN_KEY = 'ferramenta_auth_token';
const LOGIN_DATE_KEY = 'ferramenta_auth_login_date';
const REQUEST_TIMEOUT_MS = 12_000;

export type AuthUser = {
  id: string;
  username: string;
  nome: string;
  ruolo: 'amministratore' | 'dipendente';
  attivo: boolean;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

function getLocalDate(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function salvaAuthToken(token: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(LOGIN_DATE_KEY, getLocalDate()),
  ]);
}

export async function leggiAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function sessioneAccessoValidaOggi(): Promise<boolean> {
  const loginDate = await SecureStore.getItemAsync(LOGIN_DATE_KEY);

  return loginDate === getLocalDate();
}

export async function eliminaAuthToken(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(LOGIN_DATE_KEY),
  ]);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await leggiAuthToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers || {}) as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(BASE + path, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${res.status}: ${txt}`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Il server non risponde. Controlla la connessione e riprova.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  login: async (username: string, password: string) => {
    const response = await req<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    await salvaAuthToken(response.access_token);
    return response;
  },

  getCurrentUser: () =>
    req<AuthUser>('/auth/me'),

  logout: async () => {
    await eliminaAuthToken();
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return req<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  },

  async updateProfile(
    nome: string,
    username: string,
  ): Promise<AuthUser> {
    return req<AuthUser>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        nome,
        username,
      }),
    });
  },

  listUsers: () =>
    req<AuthUser[]>('/users'),

  createUser: (
    username: string,
    password: string,
    nome: string,
    ruolo: 'amministratore' | 'dipendente'
  ) =>
    req<AuthUser>('/users', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        nome,
        ruolo,
      }),
    }),

  async getUser(id: string): Promise<AuthUser> {
    return req<AuthUser>(`/users/${id}`);
  },

  async updateUser(
    id: string,
    data: {
      username: string;
      nome: string;
      ruolo: string;
      attivo: boolean;
    },
  ): Promise<AuthUser> {
    return req<AuthUser>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    return req<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

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

  bulkImportProducts: (products: any[]) =>
    req<{
      inserted: number;
      updated: number;
    }>('/products/bulk', {
      method: 'POST',
      body: JSON.stringify(products),
    }),
  listStandardBrands: () => req<{ items: string[] }>('/brands/standard'),
  listProductsPage: (params: {
    q?: string;
    search_mode?: string;
    categoria?: string;
    marca_standard?: string;
    sotto_scorta?: boolean;
    vendibile?: boolean;
    da_completare?: boolean;
    prezzo_min?: number;
    prezzo_max?: number;
    limit?: number;
    skip?: number;
  } = {}) => {
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
    return req<{ items: Product[]; total: number; limit: number; skip: number; hasMore: boolean }>('/products/page?' + qs.toString());
  },
  listProductBrands: async () => {
    return req<{ brands: string[]; total: number }>("/products/brands");
  },

  getPendingInvoiceProducts: async (numeroFattura?: string) =>
    getPendingInvoiceProductsOffline(numeroFattura),

  getStandardLists: () =>
    req<{
      categorie: string[];
      fornitori: string[];
      marche: string[];
    }>("/standard-lists"),

  getStandardList: (tipo: "categorie" | "fornitori" | "marche") =>
    req<{ tipo: string; items: string[]; total: number }>(
      `/standard-lists/${tipo}`
    ),

  addStandardListItem: (
    tipo: "categorie" | "fornitori" | "marche",
    value: string
  ) =>
    req<{ tipo: string; items: string[]; total: number }>(
      `/standard-lists/${tipo}/items`,
      {
        method: "POST",
        body: JSON.stringify({ value }),
      }
    ),

  updateStandardListItem: (
    tipo: "categorie" | "fornitori" | "marche",
    old_value: string,
    new_value: string
  ) =>
    req<{ tipo: string; items: string[]; total: number }>(
      `/standard-lists/${tipo}/items`,
      {
        method: "PUT",
        body: JSON.stringify({ old_value, new_value }),
      }
    ),

  deleteStandardListItem: (
    tipo: "categorie" | "fornitori" | "marche",
    value: string
  ) =>
    req<{ tipo: string; items: string[]; total: number }>(
      `/standard-lists/${tipo}/items`,
      {
        method: "DELETE",
        body: JSON.stringify({ value }),
      }
    ),

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
  seed: () => req<{ seeded: boolean; count?: number; existing?: number }>('/seed', { method: 'POST' }),
  previewPromoImport: async (file: { uri: string; name?: string; mimeType?: string }, codeOverrides: Record<string, string> = {}) => {
    const token = await leggiAuthToken();
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name || 'promo.csv',
      type: file.mimeType || 'text/csv',
    } as any);
    form.append('code_overrides', JSON.stringify(codeOverrides));

    const res = await fetch(BASE + '/products/import-promo-prices/preview', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
    const token = await leggiAuthToken();
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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
      riepilogo: {
        promo_nome: string;
        prodotti: number;
        promo_inizio?: string;
        promo_fine?: string;
      }[];
      prodotti: {
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
      }[];
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
      vendite_giorno: number;
      numero_vendite_giorno: number;
      piu_venduti: any[];
      meno_venduti: any[];
      totale_costi_secondari_fornitori: number;
      costi_secondari_fornitori_per_tipo: {
        tipo: string;
        totale: number;
      }[];

    }>('/statistiche'),
  createSale: (items: { product_id: string; descrizione: string; prezzo_vendita: number; quantita: number }[]) =>
    req<{ id: string; totale: number }>('/sales', { method: 'POST', body: JSON.stringify({ items }) }),

  listSalesToday: () =>
    req<{
      id: string;
      total: number;
      created_at: string;
      articoli: number;
      pezzi: number;
      prodotto_titolo: string;
    }[]>('/sales/today'),

  deleteSale: (saleId: string) =>
    req<{
      ok: boolean;
      sale_id: string;
      quantita_ripristinate: number;
    }>(`/sales/${encodeURIComponent(saleId)}`, {
      method: 'DELETE',
    }), 
 
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
  const result = await importInvoiceXmlOffline(file);
  const db = getDb();

  const productsToSync = db.getAllSync<any>(`
    SELECT *
    FROM products
    WHERE COALESCE(da_sincronizzare, 0) = 1
  `);

  if (!productsToSync.length) {
    return result;
  }

  const payload = productsToSync.map((product) => ({
    barcode: String(product.barcode || ""),
    codice_prodotto: String(product.codice_prodotto || ""),
    descrizione: String(product.descrizione || ""),
    marca: String(product.marca || ""),
    categoria: String(product.categoria || "Altro"),
    prezzo_acquisto: Number(product.prezzo_acquisto || 0),
    prezzo_vendita: Number(product.prezzo_vendita || 0),
    prezzo_promo:
      product.prezzo_promo == null
        ? null
        : Number(product.prezzo_promo),
    promo_attiva: Boolean(product.promo_attiva),
    promo_nome: String(product.promo_nome || ""),
    promo_inizio: String(product.promo_inizio || ""),
    promo_fine: String(product.promo_fine || ""),
    quantita: Number(product.quantita || 0),
    fornitore: String(product.fornitore || ""),
    foto: String(product.foto || product.image_url || ""),
    note: String(product.note || ""),
    soglia_scorta: Number(product.soglia_scorta || 5),
  }));

  const syncResult = await api.bulkImportProducts(payload);
  const syncedAt = new Date().toISOString();

  db.withTransactionSync(() => {
    for (const product of productsToSync) {
      db.runSync(
        `
        UPDATE products
        SET da_sincronizzare = 0,
            ultimo_sync = ?
        WHERE id = ?
        `,
        [syncedAt, product.id]
      );
    }
  });

  const synchronized =
    Number(syncResult.inserted || 0) +
    Number(syncResult.updated || 0);

  return {
    ...result,
    ok: true,
    gia_importata: false,
    prodotti_aggiornati: Math.max(
      Number(result?.prodotti_aggiornati || 0),
      synchronized
    ),
    prodotti_sincronizzati: synchronized,
  };
}

export async function listInvoiceImports() {
  return listInvoiceImportsOffline();
}

export async function getMissingInvoiceProducts(_filePath: string) {
  const items = getPendingInvoiceProductsOffline();

  return {
    items,
    total: items.length,
  };
}

export async function createPendingInvoiceProducts(items: any[]) {
  return createPendingInvoiceProductsOffline(items);
}

export async function getInvoiceProducts(
  chiaveImport: string
) {
  return getInvoiceProductsOffline(chiaveImport);
}
