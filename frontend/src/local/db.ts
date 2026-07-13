import * as SQLite from "expo-sqlite";
import { FORNITORI_STANDARD } from "../fornitoriStandard";

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

try {
  const cols = db.getAllSync<any>("PRAGMA table_info(products)");
  const hasCategoriaStandard = cols.some((c: any) => c.name === "categoria_standard");

  if (!hasCategoriaStandard) {
    db.execSync("ALTER TABLE products ADD COLUMN categoria_standard TEXT");
  }
} catch (e) {
  console.warn("Migrazione categoria_standard fallita:", e);
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

type TipoListaStandard = "categorie" | "fornitori" | "marche";

function rowsToList(rows: any[]) {
  return rows
    .map((r: any) => String(r.value || r.nome || r.marca_standard || "").trim())
    .filter((v: string) => v && v !== "Tutte");
}

function getDistinctProductValues(field: "categoria" | "fornitore" | "marca_standard") {
  const rows = db.getAllSync<any>(`
    SELECT DISTINCT ${field} AS value
    FROM products
    WHERE ${field} IS NOT NULL AND TRIM(${field}) != ''
    ORDER BY ${field} COLLATE NOCASE ASC
  `);

  return rowsToList(rows);
}

export function getLocalStandardLists() {
  try {
    const info = db.getAllSync<any>("PRAGMA table_info(standard_lists)");
    const hasValue = Array.isArray(info) && info.some((c: any) => c.name === "value");

    if (info.length > 0 && !hasValue) {
      db.execSync("DROP TABLE IF EXISTS standard_lists");
    }

    db.execSync(`
      CREATE TABLE IF NOT EXISTS standard_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(tipo, value)
      );
    `);
  } catch (e) {
    console.warn("Creazione standard_lists fallita", e);
  }
  
  try {
    FORNITORI_STANDARD.forEach((nome: string) => {
      const cleaned = String(nome || "").trim();

      if (cleaned) {
        db.runSync(
          "INSERT OR IGNORE INTO standard_lists (tipo, value) VALUES (?, ?)",
          ["fornitori", cleaned]
        );
      }
    });
  } catch (e) {
    console.warn("Import fornitori standard fallito:", e);
  }

  const categorieRows = db.getAllSync<any>(
    "SELECT value FROM standard_lists WHERE tipo = ? ORDER BY value COLLATE NOCASE ASC",
    ["categorie"]
  );

  const fornitoriRows = db.getAllSync<any>(
    "SELECT value FROM standard_lists WHERE tipo = ? ORDER BY value COLLATE NOCASE ASC",
    ["fornitori"]
  );

  const marcheRows = db.getAllSync<any>(
    "SELECT value FROM standard_lists WHERE tipo = ? ORDER BY value COLLATE NOCASE ASC",
    ["marche"]
  );

  const categorie = rowsToList(categorieRows);
  const fornitori = rowsToList(fornitoriRows);
  const marche = rowsToList(marcheRows);
  const mergeListe = (manuali: string[], daProdotti: string[]) => {
    return Array.from(new Set([...(manuali || []), ...(daProdotti || [])]))
      .map((v) => String(v || "").trim())
      .filter((v) => v && v !== "Tutte")
      .sort((a, b) => a.localeCompare(b));
  };
  return {
    categorie: mergeListe(categorie, getDistinctProductValues("categoria")),
    fornitori: mergeListe(fornitori, getDistinctProductValues("fornitore")),
    marche: mergeListe(marche, getDistinctProductValues("marca_standard")),
  }; 

}

export function addLocalStandardListItem(tipo: TipoListaStandard, value: string) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return { items: getLocalStandardLists()[tipo] };

  db.runSync(
    "INSERT OR IGNORE INTO standard_lists (tipo, value) VALUES (?, ?)",
    [tipo, cleaned]
  );

  return { items: getLocalStandardLists()[tipo] };
}

export function updateLocalStandardListItem(tipo: TipoListaStandard, oldValue: string, newValue: string) {
  const oldCleaned = String(oldValue || "").trim();
  const newCleaned = String(newValue || "").trim();

  if (!oldCleaned || !newCleaned) return { items: getLocalStandardLists()[tipo] };

  db.runSync(
    "DELETE FROM standard_lists WHERE tipo = ? AND value = ?",
    [tipo, oldCleaned]
  );

  db.runSync(
    "INSERT OR IGNORE INTO standard_lists (tipo, value) VALUES (?, ?)",
    [tipo, newCleaned]
  );

  return { items: getLocalStandardLists()[tipo] };
}

export function deleteLocalStandardListItem(tipo: TipoListaStandard, value: string) {
  const cleaned = String(value || "").trim();

  if (cleaned) {
    db.runSync(
      "DELETE FROM standard_lists WHERE tipo = ? AND value = ?",
      [tipo, cleaned]
    );
  }

  return { items: getLocalStandardLists()[tipo] };
}

export type LocalSearchSynonym = {
  termine: string;
  sinonimi: string[];
};

export function initLocalSearchSynonymsTable() {
  const info = db.getAllSync<any>("PRAGMA table_info(search_synonyms)");
  const hasTerm = Array.isArray(info) && info.some((c: any) => c.name === "term");
  const hasValuesJson = Array.isArray(info) && info.some((c: any) => c.name === "values_json");

  if (info.length > 0 && (!hasTerm || !hasValuesJson)) {
    db.execSync("DROP TABLE IF EXISTS search_synonyms");
  }

  db.execSync(`
    CREATE TABLE IF NOT EXISTS search_synonyms (
      term TEXT PRIMARY KEY NOT NULL,
      values_json TEXT NOT NULL
    );
  `);
}

export function listLocalSearchSynonyms(): LocalSearchSynonym[] {
  initLocalSearchSynonymsTable();

  const rows = db.getAllSync<any>(`
    SELECT term, values_json
    FROM search_synonyms
    ORDER BY term COLLATE NOCASE ASC
  `);

  return rows.map((r: any) => {
    let values: string[] = [];

    try {
      values = JSON.parse(r.values_json || "[]");
    } catch {
      values = [];
    }

    return {
      termine: String(r.term || ""),
      sinonimi: Array.isArray(values) ? values : [],
    };
  });
}

export function saveLocalSearchSynonym(term: string, values: string[]) {
  initLocalSearchSynonymsTable();

  const cleanedTerm = String(term || "").trim().toLowerCase();
  const cleanedValues = values
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);

  if (!cleanedTerm || cleanedValues.length === 0) {
    throw new Error("Termine e sinonimi sono obbligatori");
  }

  db.runSync(
    `
    INSERT OR REPLACE INTO search_synonyms (term, values_json)
    VALUES (?, ?)
    `,
    [cleanedTerm, JSON.stringify(cleanedValues)]
  );

  return listLocalSearchSynonyms();
}

export function deleteLocalSearchSynonym(term: string) {
  initLocalSearchSynonymsTable();

  db.runSync(
    "DELETE FROM search_synonyms WHERE term = ?",
    [String(term || "").trim().toLowerCase()]
  );

  return listLocalSearchSynonyms();
}

export function listLocalActivePromos() {
  const rows = db.getAllSync<any>(`
    SELECT
      promo_nome,
      COUNT(*) AS prodotti,
      SUM(
        CASE
          WHEN promo_attiva = 1
            OR promo_attiva = '1'
            OR promo_attiva = 'true'
            OR promo_attiva = 'TRUE'
          THEN 1
          ELSE 0
        END
      ) AS attivi
    FROM products
    WHERE promo_nome IS NOT NULL
      AND TRIM(promo_nome) != ''
    GROUP BY promo_nome
    ORDER BY promo_nome COLLATE NOCASE ASC
  `);

  const riepilogo = rows.map((r: any) => {
    const prodotti = Number(r.prodotti || 0);
    const attivi = Number(r.attivi || 0);

    return {
      promo_nome: String(r.promo_nome || ""),
      prodotti,
      attivi,

      // nomi alternativi, così la pagina non fa la principessa
      prodotti_totali: prodotti,
      prodotti_attivi: attivi,
      totale_prodotti: prodotti,
      totale_attivi: attivi,
      attiva: attivi > 0,
      promo_attiva: attivi > 0,
      stato: attivi > 0 ? "attiva" : "disattivata",
    };
  });

  return {
    totale_prodotti_promo: riepilogo.reduce(
      (sum: number, r: any) => sum + Number(r.prodotti || 0),
      0
    ),
    totale_promo: riepilogo.length,
    riepilogo,
  };
}

export function seedOfflinePromos() {
  let promos: any[] = [];

  try {
    promos = require("../../assets/offline_promos.json");
  } catch (e) {
    console.warn("Nessun file offline_promos.json trovato", e);
    return;
  }

  if (!Array.isArray(promos) || promos.length === 0) {
    console.log("Nessuna promo offline da importare");
    return;
  }

  let aggiornati = 0;

  for (const promo of promos) {
    const id = String(promo.id || "").trim();
    const codice = String(promo.codice_prodotto || "").trim();
    const barcode = String(promo.barcode || "").trim();

    const promoNome = String(promo.promo_nome || "").trim();
    const prezzoPromo = Number(promo.prezzo_promo || 0);
    const promoAttiva =
      promo.promo_attiva === true ||
      promo.promo_attiva === 1 ||
      promo.promo_attiva === "true" ||
      promo.promo_attiva === "1"
        ? 1
        : 0;

    const promoInizio = String(promo.promo_inizio || "").trim();
    const promoFine = String(promo.promo_fine || "").trim();

    if (!promoNome || prezzoPromo <= 0) continue;

    const res = db.runSync(
      `
      UPDATE products
      SET
        promo_nome = ?,
        promo_attiva = ?,
        prezzo_promo = ?,
        promo_inizio = ?,
        promo_fine = ?
      WHERE
        id = ?
        OR codice_prodotto = ?
        OR barcode = ?
      `,
      [
        promoNome,
        promoAttiva,
        prezzoPromo,
        promoInizio,
        promoFine,
        id,
        codice,
        barcode,
      ]
    );

    aggiornati += Number(res.changes || 0);
  }

  console.log("PROMO OFFLINE importate:", aggiornati);
}

export function setLocalPromoActive(promoNome: string, active: boolean) {
  const nome = String(promoNome || "").trim();
  if (!nome) return { modificati: 0 };

  const res = db.runSync(
    `
    UPDATE products
    SET promo_attiva = ?
    WHERE promo_nome = ?
    `,
    [active ? 1 : 0, nome]
  );

  return {
    modificati: Number(res.changes || 0),
  };
}

export function deleteLocalPromoByName(promoNome: string) {
  const nome = String(promoNome || "").trim();
  if (!nome) return { eliminati: 0 };

  const res = db.runSync(
    `
    UPDATE products
    SET
      promo_nome = '',
      promo_attiva = 0,
      prezzo_promo = NULL,
      promo_inizio = '',
      promo_fine = ''
    WHERE promo_nome = ?
    `,
    [nome]
  );

  return {
    eliminati: Number(res.changes || 0),
  };
}

export function deactivateAllLocalPromos() {
  const res = db.runSync(
    `
    UPDATE products
    SET promo_attiva = 0
    WHERE promo_nome IS NOT NULL
      AND TRIM(promo_nome) != ''
    `
  );

  return {
    disattivati: Number(res.changes || 0),
  };
}

export function findLocalProductForPromo(codiceProdotto?: string, barcode?: string) {
  const codice = String(codiceProdotto || "").trim();
  const bar = String(barcode || "").trim();

  if (codice) {
    const byCode = db.getFirstSync<any>(
      `
      SELECT id, descrizione, codice_prodotto, barcode, prezzo_vendita
      FROM products
      WHERE codice_prodotto = ?
      LIMIT 1
      `,
      [codice]
    );

    if (byCode) return byCode;
  }

  if (bar) {
    const byBarcode = db.getFirstSync<any>(
      `
      SELECT id, descrizione, codice_prodotto, barcode, prezzo_vendita
      FROM products
      WHERE barcode = ?
      LIMIT 1
      `,
      [bar]
    );

    if (byBarcode) return byBarcode;
  }

  return null;
}

export function confirmLocalPromoImport(
  promoNome: string,
  promoInizio: string,
  promoFine: string,
  righe: any[]
) {
  const nome = String(promoNome || "").trim();
  const inizio = String(promoInizio || "").trim();
  const fine = String(promoFine || "").trim();

  if (!nome) throw new Error("Nome promozione mancante");

  let aggiornati = 0;
  let saltati = 0;

  for (const r of righe || []) {
    const productId = String(r.product_id || "").trim();
    const prezzoPromo = Number(r.prezzo_promo || 0);

    if (!productId || prezzoPromo <= 0 || r.status !== "trovato") {
      saltati += 1;
      continue;
    }

    const res = db.runSync(
      `
      UPDATE products
      SET
        prezzo_promo = ?,
        promo_attiva = 1,
        promo_nome = ?,
        promo_inizio = ?,
        promo_fine = ?
      WHERE id = ?
      `,
      [prezzoPromo, nome, inizio, fine, productId]
    );

    aggiornati += Number(res.changes || 0);
  }

  return {
    aggiornati,
    saltati,
    anteprima: {
      prodotti_aggiornabili: aggiornati,
      righe,
    },
  };
}

export function createLocalProductFromPromo(payload: any) {
  const id =
    payload.id ||
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  db.runSync(
    `
    INSERT INTO products (
      id,
      codice_prodotto,
      barcode,
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
      prezzo_promo,
      promo_attiva,
      promo_nome,
      promo_inizio,
      promo_fine
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      String(payload.codice_prodotto || ""),
      String(payload.barcode || ""),
      String(payload.descrizione || ""),
      String(payload.marca || ""),
      String(payload.marca_standard || payload.marca || ""),
      String(payload.categoria || "Altro"),
      String(payload.categoria_standard || payload.categoria || "Altro"),
      Number(payload.prezzo_acquisto || 0),
      Number(payload.prezzo_vendita || 0),
      Number(payload.quantita || 0),
      String(payload.fornitore || ""),
      String(payload.foto || ""),
      String(payload.note || ""),
      Number(payload.soglia_scorta || 5),
      Number(payload.prezzo_promo || 0),
      payload.promo_attiva ? 1 : 0,
      String(payload.promo_nome || ""),
      String(payload.promo_inizio || ""),
      String(payload.promo_fine || ""),
    ]
  );

  return {
    id,
  };
}
