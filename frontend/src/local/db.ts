import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("ferramenta_offline.db");
const offlineProducts = require("../../assets/offline_products.json");

export function initLocalDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      codice_prodotto TEXT,
      barcode TEXT,
      descrizione TEXT,
      marca TEXT,
      marca_standard TEXT,
      categoria TEXT,
      fornitore TEXT,
      quantita INTEGER DEFAULT 0,
      prezzo_acquisto REAL DEFAULT 0,
      prezzo_vendita REAL DEFAULT 0,
      prezzo_promo REAL,
      promo_attiva INTEGER DEFAULT 0,
      promo_nome TEXT,
      promo_inizio TEXT,
      promo_fine TEXT,
      foto TEXT,
      image_url TEXT,
      note TEXT,
      visibile_cliente INTEGER DEFAULT 0,
      pubblicato_online INTEGER DEFAULT 0,
      da_sincronizzare INTEGER DEFAULT 0,
      ultimo_sync TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL,
      totale REAL DEFAULT 0,
      metodo_pagamento TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT,
      product_id TEXT,
      codice_prodotto TEXT,
      barcode TEXT,
      descrizione TEXT,
      prezzo_vendita REAL DEFAULT 0,
      quantita INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS invoice_imports (
      id TEXT PRIMARY KEY NOT NULL,
      chiave_import TEXT,
      numero TEXT,
      data TEXT,
      partita_iva TEXT,
      denominazione TEXT,
      file TEXT,
      report TEXT,
      data_import TEXT,
      righe_fattura INTEGER DEFAULT 0,
      righe_fattura_originali INTEGER DEFAULT 0,
      costi_secondari_fornitori TEXT,
      totale_costi_secondari_fornitori REAL DEFAULT 0,
      prodotti_aggiornati INTEGER DEFAULT 0,
      barcode_non_trovati INTEGER DEFAULT 0,
      righe_saltate INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pending_invoice_products (
      id TEXT PRIMARY KEY NOT NULL,
      chiave_import TEXT,
      numero_fattura TEXT,
      data_fattura TEXT,
      fornitore TEXT,
      partita_iva TEXT,
      linea TEXT,
      barcode TEXT,
      codice_fornitore TEXT,
      descrizione TEXT,
      quantita INTEGER DEFAULT 0,
      prezzo_unitario REAL DEFAULT 0,
      stato TEXT,
      selected INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS standard_lists (
      tipo TEXT PRIMARY KEY NOT NULL,
      items TEXT
    );

    CREATE TABLE IF NOT EXISTS search_synonyms (
      id TEXT PRIMARY KEY NOT NULL,
      termine TEXT,
      sinonimi TEXT
    );
  `);
  try {
    const cols = db.getAllSync<any>("PRAGMA table_info(products)");
    const hasSogliaScorta = cols.some((c: any) => c.name === "soglia_scorta");
    if (!hasSogliaScorta) {
      db.execSync("ALTER TABLE products ADD COLUMN soglia_scorta INTEGER DEFAULT 5");
    }
  } catch (e) {
    console.warn("Migrazione soglia_scorta fallita", e);
  }
}

export function seedProductsIfEmpty() {
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM products"
  );

  const count = row?.count || 0;

  if (count > 0) {
    console.log("Prodotti offline già presenti:", count);
    return;
  }

  console.log("Import prodotti offline in corso:", offlineProducts.length);

  for (const p of offlineProducts) {
    const id =
      p.id ||
      p._id ||
      p.codice_prodotto ||
      p.barcode ||
      String(Date.now() + Math.random());

    db.runSync(
      `
      INSERT OR REPLACE INTO products (
        id,
        codice_prodotto,
        barcode,
        descrizione,
        marca,
        marca_standard,
        categoria,
        fornitore,
        quantita,
        prezzo_acquisto,
        prezzo_vendita,
        prezzo_promo,
        promo_attiva,
        promo_nome,
        promo_inizio,
        promo_fine,
        foto,
        image_url,
        note,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(id),
        String(p.codice_prodotto || ""),
        String(p.barcode || ""),
        String(p.descrizione || ""),
        String(p.marca || ""),
        String(p.marca_standard || p.marca || ""),
        String(p.categoria || ""),
        String(p.fornitore || ""),
        Number(p.quantita || 0),
        Number(p.prezzo_acquisto || 0),
        Number(p.prezzo_vendita || 0),
        p.prezzo_promo == null ? null : Number(p.prezzo_promo || 0),
        p.promo_attiva ? 1 : 0,
        String(p.promo_nome || ""),
        String(p.promo_inizio || ""),
        String(p.promo_fine || ""),
        String(p.foto || ""),
        String(p.image_url || p.immagine_url || ""),
        String(p.note || ""),
        String(p.created_at || ""),
        String(p.updated_at || ""),
      ]
    );
  }

  const after = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM products"
  );

  console.log("Prodotti offline caricati:", after?.count || 0);
}

export function getDb() {
  return db;
}

export function listLocalProductsPage({
  page = 1,
  limit = 50,
  skip,
  q = "",
  search = "",
  search_mode = "",
  categoria = "",
  marca_standard = "",
  sotto_scorta,
  vendibile,
  da_completare,
  prezzo_min,
  prezzo_max,
}: {
  page?: number;
  limit?: number;
  skip?: number;
  q?: string;
  search?: string;
  search_mode?: string;
  categoria?: string;
  marca_standard?: string;
  sotto_scorta?: boolean;
  vendibile?: boolean;
  da_completare?: boolean;
  prezzo_min?: number;
  prezzo_max?: number;
}) {
  const offset = typeof skip === "number" ? skip : (page - 1) * limit;


  const testoRicerca = String(q || search || "").trim();
  const categoriaPulita = String(categoria || "").trim();

  const where: string[] = [];
  const params: any[] = [];

  if (testoRicerca) {
    where.push(`
      (
        descrizione LIKE ?
        OR codice_prodotto LIKE ?
        OR barcode LIKE ?
        OR marca LIKE ?
        OR fornitore LIKE ?
      )
    `);

    const valore = `%${testoRicerca}%`;
    params.push(valore, valore, valore, valore, valore);
  }

  if (categoriaPulita && categoriaPulita.toLowerCase() !== "tutti") {
    where.push("categoria = ?");
    params.push(categoriaPulita);
  }

  const marcaPulita = String(marca_standard || "").trim();

  if (marcaPulita && marcaPulita.toLowerCase() !== "tutte") {
    where.push("(marca_standard = ? OR marca = ?)");
    params.push(marcaPulita, marcaPulita);
  }

  if (vendibile === true) {
    where.push("COALESCE(quantita, 0) > 0");
  }

  if (sotto_scorta === true) {
    where.push("COALESCE(quantita, 0) <= COALESCE(soglia_scorta, 0)");
  }

  if (da_completare === true) {
    where.push("(COALESCE(prezzo_vendita, 0) <= 0 OR codice_prodotto IS NULL OR codice_prodotto = '')");
  }

  if (typeof prezzo_min === "number") {
    where.push("COALESCE(prezzo_vendita, 0) >= ?");
    params.push(prezzo_min);
  }

  if (typeof prezzo_max === "number") {
    where.push("COALESCE(prezzo_vendita, 0) <= ?");
    params.push(prezzo_max);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const items = db.getAllSync(
    `
    SELECT *
    FROM products
    ${whereSql}
    ORDER BY descrizione ASC
    LIMIT ?
    OFFSET ?
    `,
    [...params, limit, offset]
  );

  const totalRow = db.getFirstSync<{ total: number }>(
    `
    SELECT COUNT(*) as total
    FROM products
    ${whereSql}
    `,
    params
  );

  return {
    items,
    total: totalRow?.total || 0,
    page,
    limit,
    hasMore: offset + items.length < (totalRow?.total || 0),
  };
}


export function getLocalProductById(id: string) {
  return db.getFirstSync(
    `
    SELECT *
    FROM products
    WHERE id = ?
       OR codice_prodotto = ?
       OR barcode = ?
    LIMIT 1
    `,
    [id, id, id]
  );
}

export function listLocalCategories() {
  const rows = db.getAllSync<{ categoria: string }>(`
    SELECT DISTINCT categoria
    FROM products
    WHERE categoria IS NOT NULL AND categoria != ''
    ORDER BY categoria ASC
  `);

  return rows.map((r) => r.categoria).filter(Boolean);
}

export function listLocalBrands() {
  const rows = db.getAllSync<{ marca: string }>(`
    SELECT DISTINCT COALESCE(NULLIF(marca_standard, ''), marca) as marca
    FROM products
    WHERE COALESCE(NULLIF(marca_standard, ''), marca) IS NOT NULL
      AND COALESCE(NULLIF(marca_standard, ''), marca) != ''
    ORDER BY marca ASC
  `);

  return rows.map((r) => r.marca).filter(Boolean);
}

export function createLocalSale(items: any[]) {
  const saleId = `SALE-${Date.now()}`;
  const createdAt = new Date().toISOString();

  const total = items.reduce((sum, item) => {
    const prezzo = Number(item.prezzo_vendita || 0);
    const quantita = Number(item.quantita || 0);
    return sum + prezzo * quantita;
  }, 0);

  db.withTransactionSync(() => {
    db.runSync(
      `
      INSERT INTO sales (id, total, created_at)
      VALUES (?, ?, ?)
      `,
      [saleId, total, createdAt]
    );

    for (const item of items) {
      const productId = String(item.product_id || "");
      const descrizione = String(item.descrizione || "");
      const prezzoVendita = Number(item.prezzo_vendita || 0);
      const quantita = Number(item.quantita || 0);

      db.runSync(
        `
        INSERT INTO sale_items (
          sale_id,
          product_id,
          descrizione,
          prezzo_vendita,
          quantita
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [saleId, productId, descrizione, prezzoVendita, quantita]
      );

      db.runSync(
        `
        UPDATE products
        SET quantita = MAX(COALESCE(quantita, 0) - ?, 0),
            updated_at = ?
        WHERE id = ?
           OR codice_prodotto = ?
           OR barcode = ?
        `,
        [quantita, createdAt, productId, productId, productId]
      );
    }
  });

  return {
    ok: true,
    id: saleId,
    total,
    items,
  };
}


export function adjustLocalStock(id: string, delta: number) {
  const now = new Date().toISOString();

  const current = getLocalProductById(id);
  if (!current) {
    throw new Error("Prodotto non trovato");
  }

  db.runSync(
    `
    UPDATE products
    SET quantita = MAX(COALESCE(quantita, 0) + ?, 0),
        updated_at = ?
    WHERE id = ?
       OR codice_prodotto = ?
       OR barcode = ?
    `,
    [delta, now, id, id, id]
  );

  return getLocalProductById(id);
}

export function deleteLocalProduct(id: string) {
  db.runSync(
    `
    DELETE FROM products
    WHERE id = ?
       OR codice_prodotto = ?
       OR barcode = ?
    `,
    [id, id, id]
  );

  return { ok: true };
}

export function createLocalProduct(payload: any) {
  const now = new Date().toISOString();
  const id =
    String(payload.id || payload.codice_prodotto || payload.barcode || `P-${Date.now()}`);

  db.runSync(
    `
    INSERT INTO products (
      id,
      barcode,
      codice_prodotto,
      descrizione,
      marca,
      marca_standard,
      categoria,
      categoria_standard,
      prezzo_acquisto,
      prezzo_vendita,
      quantita,
      fornitore,
      foto,
      note,
      soglia_scorta,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      String(payload.barcode || ""),
      String(payload.codice_prodotto || ""),
      String(payload.descrizione || ""),
      String(payload.marca || ""),
      String(payload.marca_standard || payload.marca || ""),
      String(payload.categoria || ""),
      String(payload.categoria_standard || payload.categoria || ""),
      Number(payload.prezzo_acquisto || 0),
      Number(payload.prezzo_vendita || 0),
      Number(payload.quantita || 0),
      String(payload.fornitore || ""),
      String(payload.foto || ""),
      String(payload.note || ""),
      Number(payload.soglia_scorta || 5),
      now,
      now,
    ]
  );

  return getLocalProductById(id);
}

export function updateLocalProduct(id: string, payload: any) {
  const now = new Date().toISOString();

  db.runSync(
    `
    UPDATE products
    SET barcode = ?,
        codice_prodotto = ?,
        descrizione = ?,
        marca = ?,
        marca_standard = ?,
        categoria = ?,
        categoria_standard = ?,
        prezzo_acquisto = ?,
        prezzo_vendita = ?,
        quantita = ?,
        fornitore = ?,
        foto = ?,
        note = ?,
        soglia_scorta = ?,
        updated_at = ?
    WHERE id = ?
       OR codice_prodotto = ?
       OR barcode = ?
    `,
    [
      String(payload.barcode || ""),
      String(payload.codice_prodotto || ""),
      String(payload.descrizione || ""),
      String(payload.marca || ""),
      String(payload.marca_standard || payload.marca || ""),
      String(payload.categoria || ""),
      String(payload.categoria_standard || payload.categoria || ""),
      Number(payload.prezzo_acquisto || 0),
      Number(payload.prezzo_vendita || 0),
      Number(payload.quantita || 0),
      String(payload.fornitore || ""),
      String(payload.foto || ""),
      String(payload.note || ""),
      Number(payload.soglia_scorta || 5),
      now,
      id,
      id,
      id,
    ]
  );

  return getLocalProductById(id);
}
