import * as FileSystem from "expo-file-system/legacy";
import { XMLParser } from "fast-xml-parser";
import { getDb, getPricingMarkupsOffline } from "./db";
import { calculateSalePrice } from "../pricing";

type InvoiceFile = {
  uri: string;
  name?: string;
  mimeType?: string;
};

type InvoiceInfo = {
  numero: string;
  data: string;
  partitaIva: string;
  denominazione: string;
  chiaveImport: string;
};

type InvoiceLine = {
  linea: string;
  barcode: string;
  codiceFornitore: string;
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  prezzoTotale: number;
};

type SecondaryCost = {
  tipo: string;
  descrizione: string;
  importo: number;
  quantita?: number;
  prezzo_unitario?: number;
  codice_fornitore?: string;
  barcode?: string;
};

function arrayOf<T = any>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function clean(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "object" && value !== null) {
    const objectValue = value as Record<string, unknown>;

    if ("#text" in objectValue) {
      return clean(objectValue["#text"]);
    }
  }

  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const cleaned = clean(value).replace(",", ".");

  if (!cleaned) return fallback;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value: unknown): number {
  return Math.trunc(toNumber(value, 0));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function getNested(source: any, path: string[]): any {
  let current = source;

  for (const key of path) {
    if (current == null) return undefined;
    current = current[key];
  }

  return current;
}

function findFirstByKey(source: any, key: string): any {
  if (source == null || typeof source !== "object") {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }

  for (const value of Object.values(source)) {
    if (value && typeof value === "object") {
      const found = findFirstByKey(value, key);

      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}

function findAllByKey(source: any, key: string, result: any[] = []): any[] {
  if (source == null || typeof source !== "object") {
    return result;
  }

  if (Object.prototype.hasOwnProperty.call(source, key)) {
    result.push(...arrayOf(source[key]));
  }

  for (const value of Object.values(source)) {
    if (value && typeof value === "object") {
      findAllByKey(value, key, result);
    }
  }

  return result;
}

function getInvoiceInfo(parsed: any): InvoiceInfo {
  const numero = clean(
    getNested(parsed, [
      "FatturaElettronica",
      "FatturaElettronicaBody",
      "DatiGenerali",
      "DatiGeneraliDocumento",
      "Numero",
    ]) || findFirstByKey(parsed, "Numero")
  );

  const data = clean(
    getNested(parsed, [
      "FatturaElettronica",
      "FatturaElettronicaBody",
      "DatiGenerali",
      "DatiGeneraliDocumento",
      "Data",
    ]) || findFirstByKey(parsed, "Data")
  );

  const cedente =
    findFirstByKey(parsed, "CedentePrestatore") || {};

  const partitaIva = clean(
    getNested(cedente, [
      "DatiAnagrafici",
      "IdFiscaleIVA",
      "IdCodice",
    ])
  );

  const anagrafica =
    getNested(cedente, ["DatiAnagrafici", "Anagrafica"]) || {};

  const denominazione =
    clean(anagrafica.Denominazione) ||
    [
      clean(anagrafica.Nome),
      clean(anagrafica.Cognome),
    ]
      .filter(Boolean)
      .join(" ");

  return {
    numero,
    data,
    partitaIva,
    denominazione,
    chiaveImport: `${partitaIva}|${numero}|${data}`,
  };
}

function getArticleCodes(line: any): {
  barcode: string;
  codiceFornitore: string;
} {
  const codes = arrayOf(line?.CodiceArticolo);

  let barcode = "";
  let codiceFornitore = "";

  for (const code of codes) {
    const tipo = clean(code?.CodiceTipo).toUpperCase();
    const valore = clean(code?.CodiceValore);

    if (!valore) continue;

    if (tipo === "EAN" && !barcode) {
      barcode = valore;
    } else if (tipo !== "EAN" && !codiceFornitore) {
      codiceFornitore = valore;
    }
  }

  return {
    barcode,
    codiceFornitore,
  };
}

function calculateNetPurchasePrice(line: any): number {
  const quantita = toNumber(line?.Quantita, 1);
  const prezzoUnitario = toNumber(line?.PrezzoUnitario, 0);
  const prezzoTotale = toNumber(line?.PrezzoTotale, 0);

  if (quantita > 0 && prezzoTotale > 0) {
    return round(prezzoTotale / quantita, 4);
  }

  let prezzo = prezzoUnitario;
  const discounts = arrayOf(line?.ScontoMaggiorazione);

  for (const discount of discounts) {
    const tipo = clean(discount?.Tipo).toUpperCase();
    const percentuale = toNumber(discount?.Percentuale, 0);
    const importo = toNumber(discount?.Importo, 0);

    if (tipo === "SC") {
      if (percentuale) {
        prezzo *= 1 - percentuale / 100;
      } else if (importo) {
        prezzo -= importo;
      }
    }

    if (tipo === "MG") {
      if (percentuale) {
        prezzo *= 1 + percentuale / 100;
      } else if (importo) {
        prezzo += importo;
      }
    }
  }

  return round(Math.max(prezzo, 0), 4);
}

function parseInvoiceLine(line: any): InvoiceLine {
  const { barcode, codiceFornitore } = getArticleCodes(line);

  const quantita = toInteger(line?.Quantita);
  const prezzoUnitario = calculateNetPurchasePrice(line);

  const prezzoTotale =
    toNumber(line?.PrezzoTotale, 0) ||
    prezzoUnitario * (quantita || 1);

  return {
    linea: clean(line?.NumeroLinea),
    barcode,
    codiceFornitore,
    descrizione: clean(line?.Descrizione),
    quantita,
    prezzoUnitario,
    prezzoTotale: round(prezzoTotale, 2),
  };
}

function isInformativeLine(description: string): boolean {
  const text = clean(description).toUpperCase();

  const words = [
    "RIF. ORDINE",
    "RIF ORDINE",
    "RIFERIMENTO ORDINE",
    "ORDINE CL",
    "ORDINE CLIENTE",
    "VS ORDINE",
    "VOSTRO ORDINE",
    "NS ORDINE",
    "NOSTRO ORDINE",
    "DDT",
    "DOCUMENTO DI TRASPORTO",
  ];

  return words.some((word) => text.includes(word));
}

function classifySecondaryCost(line: InvoiceLine): string | null {
  const text = clean(line.descrizione).toUpperCase();

  if (!text) {
    return null;
  }

  const isSupplierReference =
    /\bNS\.?\s*RIF(?:\.|ERIMENTO)?\b/.test(text) ||
    /\bNOSTRO\s+RIF(?:\.|ERIMENTO)?\b/.test(text);

  if (isSupplierReference) {
    return "Riferimento fornitore";
  }

  if (line.prezzoTotale <= 0) {
    return null;
  }

  const costWords: Record<string, string[]> = {
    Spedizione: [
      "TRASPORTO",
      "SPEDIZIONE",
      "SPESE TRASPORTO",
      "SPESE DI TRASPORTO",
      "PORTO",
      "CONSEGNA",
      "CORRIERE",
    ],
    Imballaggio: [
      "IMBALLO",
      "IMBALLAGGIO",
      "CONTRIBUTO IMBALLO",
      "CONFEZIONAMENTO",
      "PACKAGING",
    ],
    "Incasso / gestione": [
      "INCASSO",
      "CONTRASSEGNO",
      "SPESE BANCARIE",
      "COMMISSIONI",
      "GESTIONE ORDINE",
      "SPESE GESTIONE",
    ],
    Bollo: [
      "BOLLO",
      "IMPOSTA DI BOLLO",
    ],
    "Altro costo secondario": [
      "SPESE",
      "ADDEBITO",
      "CONTRIBUTO",
    ],
  };

  let foundType: string | null = null;

  for (const [type, words] of Object.entries(costWords)) {
    if (words.some((word) => text.includes(word))) {
      foundType = type;
      break;
    }
  }

  if (!foundType) {
    return null;
  }

  const productWords = [
    "NASTRO",
    "SCATOLA",
    "CARTONE",
    "CARRELLO",
    "BORSA",
    "VALIGIA",
    "CONTENITORE",
    "CINGHIA",
    "FASCIA",
    "PELLICOLA",
    "ROTOLO",
    "DISCO",
    "LAMA",
    "PUNTA",
    "TRAPANO",
    "AVVITATORE",
    "SEGHETTO",
    "UTENSILE",
    "GUANTI",
    "VERNICE",
    "SILICONE",
    "COLLA",
  ];

  if (productWords.some((word) => text.includes(word))) {
    return null;
  }

  let score = 2;

  if (!line.barcode) score += 2;
  if (!line.codiceFornitore) score += 2;
  if (line.quantita === 0 || line.quantita === 1) score += 1;
  if (text.split(/\s+/).length <= 4) score += 1;

  if (line.barcode || line.codiceFornitore) {
    score -= 3;
  }

  return score >= 5 ? foundType : null;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function getInvoiceIdentityOffline(
  file: InvoiceFile
): Promise<InvoiceInfo> {
  const xml = await FileSystem.readAsStringAsync(file.uri);

  if (!xml.trim()) {
    throw new Error("Il file XML è vuoto");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });

  let parsed: any;

  try {
    parsed = parser.parse(xml);
  } catch (error) {
    throw new Error(
      `File XML non valido: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const info = getInvoiceInfo(parsed);

  if (!info.numero || !info.data || !info.partitaIva) {
    throw new Error(
      "Impossibile leggere numero, data o partita IVA della fattura"
    );
  }

  return info;
}

export async function importInvoiceXmlOffline(file: InvoiceFile) {
  const db = getDb();

  const xml = await FileSystem.readAsStringAsync(file.uri);

  if (!xml.trim()) {
    throw new Error("Il file XML è vuoto");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });

  let parsed: any;

  try {
    parsed = parser.parse(xml);
  } catch (error) {
    throw new Error(
      `File XML non valido: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const info = getInvoiceInfo(parsed);

  if (!info.numero || !info.data || !info.partitaIva) {
    throw new Error(
      "Impossibile leggere numero, data o partita IVA della fattura"
    );
  }

const repairId = "repair_saratoga_incomplete_import_v1";
const saratogaKey = "00719730152|V1-28643|2026-07-09";

db.execSync(`
  CREATE TABLE IF NOT EXISTS local_migrations (
    id TEXT PRIMARY KEY NOT NULL,
    executed_at TEXT NOT NULL
  );
`);

const repairDone = db.getFirstSync<any>(
  "SELECT id FROM local_migrations WHERE id = ? LIMIT 1",
  [repairId]
);

if (!repairDone) {
  const oldPending = db.getAllSync<any>(
    `
    SELECT barcode, codice_fornitore
    FROM pending_invoice_products
    WHERE chiave_import = ?
      AND stato IN ('creato', 'gia_presente')
    `,
    [saratogaKey]
  );

  db.withTransactionSync(() => {
    for (const item of oldPending) {
      const barcode = String(item?.barcode || "").trim();
      const codice = String(item?.codice_fornitore || "").trim();

      db.runSync(
        `
        DELETE FROM products
        WHERE (? != '' AND TRIM(CAST(barcode AS TEXT)) = ?)
           OR (? != '' AND TRIM(CAST(codice_prodotto AS TEXT)) = ?)
        `,
        [barcode, barcode, codice, codice]
      );
    }

    db.runSync(
      "DELETE FROM pending_invoice_products WHERE chiave_import = ?",
      [saratogaKey]
    );

    db.runSync(
      "DELETE FROM invoice_imports WHERE chiave_import = ?",
      [saratogaKey]
    );

    db.runSync(
      "INSERT INTO local_migrations (id, executed_at) VALUES (?, ?)",
      [repairId, new Date().toISOString()]
    );
  });
}

  const alreadyImported = db.getFirstSync<any>(
    `
    SELECT *
    FROM invoice_imports
    WHERE chiave_import = ?
    LIMIT 1
    `,
    [info.chiaveImport]
  );

  if (alreadyImported) {
  const pending = getPendingInvoiceProductsOffline(info.numero);

  if (pending.length > 0) {
    const creation = createPendingInvoiceProductsOffline(pending);
    const remaining = getPendingInvoiceProductsOffline(info.numero);
    const processed = creation.creati + creation.gia_presenti;

    db.runSync(
      `
      UPDATE invoice_imports
      SET prodotti_aggiornati =
            COALESCE(prodotti_aggiornati, 0) + ?,
          barcode_non_trovati = ?
      WHERE chiave_import = ?
      `,
      [processed, remaining.length, info.chiaveImport]
    );

    return {
      ok: true,
      offline: true,
      fornitore: alreadyImported.denominazione || "",
      partita_iva: alreadyImported.partita_iva || "",
      numero: alreadyImported.numero || "",
      data: alreadyImported.data || "",
      prodotti_aggiornati: processed,
      prodotti_creati: creation.creati,
      barcode_non_trovati: remaining.length,
      righe_saltate: Number(alreadyImported.righe_saltate || 0),
      report: "",
      file_non_trovati: "",
      non_trovati: remaining,
    };
  }

  return {
    ok: false,
    gia_importata: true,
    errore: "Questa fattura risulta già importata",
    fornitore: alreadyImported.denominazione || "",
    partita_iva: alreadyImported.partita_iva || "",
    numero: alreadyImported.numero || "",
    data: alreadyImported.data || "",
    data_import: alreadyImported.data_import || "",
  };
}

  const rawLines = findAllByKey(parsed, "DettaglioLinee");

  if (!rawLines.length) {
    throw new Error("Nessuna riga prodotto trovata nel file XML");
  }

  const parsedLines = rawLines.map(parseInvoiceLine);

  const productLines: InvoiceLine[] = [];
  const secondaryCosts: SecondaryCost[] = [];
  const skipped: any[] = [];

  for (const line of parsedLines) {
    if (!line.descrizione) {
      skipped.push({
        linea: line.linea,
        barcode: line.barcode,
        quantita: line.quantita,
        descrizione: line.descrizione,
        motivo: "Descrizione mancante",
      });
      continue;
    }

    if (isInformativeLine(line.descrizione)) {
      skipped.push({
        linea: line.linea,
        barcode: line.barcode,
        quantita: line.quantita,
        descrizione: line.descrizione,
        motivo: "Riga informativa",
      });
      continue;
    }

    const costType = classifySecondaryCost(line);

    if (costType) {
      secondaryCosts.push({
        tipo: costType,
        descrizione: line.descrizione,
        importo: round(line.prezzoTotale, 2),
        quantita: line.quantita,
        prezzo_unitario: line.prezzoUnitario,
        codice_fornitore: line.codiceFornitore,
        barcode: line.barcode,
      });
      continue;
    }

    productLines.push(line);
  }

  let updated = 0;
  const missing: InvoiceLine[] = [];
  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    for (const line of productLines) {
  if (line.quantita <= 0) {
    skipped.push({
      linea: line.linea,
      barcode: line.barcode,
      quantita: line.quantita,
      descrizione: line.descrizione,
      motivo: "Quantità non valida",
    });
    continue;
  }

  const barcode = String(line.barcode || "").trim();
  const codiceProdotto = String(line.codiceFornitore || "").trim();

  if (!barcode && !codiceProdotto) {
    missing.push(line);
    continue;
  }

  let product: any = null;

  if (barcode) {
    product = db.getFirstSync<any>(
      `
      SELECT id, quantita
      FROM products
      WHERE TRIM(CAST(barcode AS TEXT)) = ?
      LIMIT 1
      `,
      [barcode]
    );
  }

  if (!product && codiceProdotto) {
    product = db.getFirstSync<any>(
      `
      SELECT id, quantita
      FROM products
      WHERE TRIM(CAST(codice_prodotto AS TEXT)) = ?
      LIMIT 1
      `,
      [codiceProdotto]
    );
  }

  if (product) {
    db.runSync(
      `
      UPDATE products
      SET quantita = COALESCE(quantita, 0) + ?,
          prezzo_acquisto =
            CASE WHEN ? > 0 THEN ? ELSE prezzo_acquisto END,
          prezzo_vendita =
            CASE WHEN ? > 0 THEN ? ELSE prezzo_vendita END,
          updated_at = ?,
          da_sincronizzare = 1
      WHERE id = ?
      `,
      [
        line.quantita,
        line.prezzoUnitario,
        line.prezzoUnitario,
        line.prezzoUnitario,
        calculateSalePrice(line.prezzoUnitario, getPricingMarkupsOffline()),
        now,
        product.id,
      ]
    );
  } else {
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
        fornitore,
        quantita,
        prezzo_acquisto,
        prezzo_vendita,
        soglia_scorta,
        da_sincronizzare,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        createId("PRODUCT"),
        codiceProdotto,
        barcode,
        line.descrizione,
        "",
        "",
        "Altro",
        "Altro",
        info.denominazione,
        line.quantita,
        line.prezzoUnitario,
        calculateSalePrice(line.prezzoUnitario, getPricingMarkupsOffline()),
        5,
        1,
        now,
        now,
      ]
    );
  }

  updated += 1;
}

    db.runSync(
      `
      DELETE FROM pending_invoice_products
      WHERE chiave_import = ?
      `,
      [info.chiaveImport]
    );

    for (const line of missing) {
      db.runSync(
        `
        INSERT INTO pending_invoice_products (
          id,
          chiave_import,
          numero_fattura,
          data_fattura,
          fornitore,
          partita_iva,
          linea,
          barcode,
          codice_fornitore,
          descrizione,
          quantita,
          prezzo_unitario,
          stato,
          selected,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          createId("PENDING"),
          info.chiaveImport,
          info.numero,
          info.data,
          info.denominazione,
          info.partitaIva,
          line.linea,
          line.barcode,
          line.codiceFornitore,
          line.descrizione,
          line.quantita,
          line.prezzoUnitario,
          "da_salvare",
          1,
          now,
          now,
        ]
      );
    }

    const totalSecondaryCosts = round(
      secondaryCosts.reduce(
        (sum, cost) => sum + Number(cost.importo || 0),
        0
      ),
      2
    );

    const report = JSON.stringify({
      fornitore: info.denominazione,
      partita_iva: info.partitaIva,
      numero: info.numero,
      data: info.data,
      file: file.name || file.uri,
      data_import: now,
      righe_fattura: productLines.length,
      righe_fattura_originali: rawLines.length,
      prodotti_letti: productLines.map((line) => ({
        linea: line.linea,
        barcode: line.barcode,
        codice_fornitore: line.codiceFornitore,
        descrizione: line.descrizione,
        quantita: line.quantita,
        prezzo_unitario: line.prezzoUnitario,
        prezzo_totale: line.prezzoTotale,
      })),
      prodotti_aggiornati: updated,
      barcode_non_trovati: missing.length,
      righe_saltate: skipped.length,
      costi_secondari_fornitori: secondaryCosts,
      totale_costi_secondari_fornitori: totalSecondaryCosts,
      non_trovati: missing,
      saltati: skipped,
    });

    db.runSync(
      `
      INSERT INTO invoice_imports (
        id,
        chiave_import,
        numero,
        data,
        partita_iva,
        denominazione,
        file,
        report,
        data_import,
        righe_fattura,
        righe_fattura_originali,
        costi_secondari_fornitori,
        totale_costi_secondari_fornitori,
        prodotti_aggiornati,
        barcode_non_trovati,
        righe_saltate
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        createId("INVOICE"),
        info.chiaveImport,
        info.numero,
        info.data,
        info.partitaIva,
        info.denominazione,
        file.uri,
        report,
        now,
        productLines.length,
        rawLines.length,
        JSON.stringify(secondaryCosts),
        totalSecondaryCosts,
        updated,
        missing.length,
        skipped.length,
      ]
    );
  });

  const totalSecondaryCosts = round(
    secondaryCosts.reduce(
      (sum, cost) => sum + Number(cost.importo || 0),
      0
    ),
    2
  );

  return {
    ok: true,
    offline: true,
    fornitore: info.denominazione,
    partita_iva: info.partitaIva,
    numero: info.numero,
    data: info.data,
    righe_fattura: productLines.length,
    righe_fattura_originali: rawLines.length,
    costi_secondari_fornitori: secondaryCosts,
    totale_costi_secondari_fornitori: totalSecondaryCosts,
    prodotti_aggiornati: updated,
    barcode_non_trovati: missing.length,
    righe_saltate: skipped.length,
    report: "",
    file_non_trovati: "",
    non_trovati: missing.slice(0, 20).map((line) => ({
      linea: line.linea,
      barcode: line.barcode,
      codice_fornitore: line.codiceFornitore,
      descrizione: line.descrizione,
      quantita: line.quantita,
      prezzo_unitario: line.prezzoUnitario,
    })),
    saltati: skipped.slice(0, 20),
  };
}

export function listInvoiceImportsOffline() {
  const db = getDb();

  const items = db.getAllSync<any>(`
    SELECT *
    FROM invoice_imports
    ORDER BY data_import DESC
  `);

  return {
    items: items.map((item) => ({
      ...item,
      costi_secondari_fornitori: (() => {
        try {
          return JSON.parse(item.costi_secondari_fornitori || "[]");
        } catch {
          return [];
        }
      })(),
    })),
    total: items.length,
  };
}

export async function getInvoiceProductsOffline(
  chiaveImport: string
) {
  const db = getDb();

  const invoice = db.getFirstSync<any>(
    `
    SELECT *
    FROM invoice_imports
    WHERE chiave_import = ?
    LIMIT 1
    `,
    [chiaveImport]
  );

  if (!invoice) {
    throw new Error("Fattura non trovata nello storico");
  }

  let reportData: any = {};

  try {
    reportData = JSON.parse(invoice.report || "{}");
  } catch {
    reportData = {};
  }

  if (Array.isArray(reportData.prodotti_letti)) {
    let secondaryCosts: SecondaryCost[] = Array.isArray(
      reportData.costi_secondari_fornitori
    )
      ? [...reportData.costi_secondari_fornitori]
      : [];

    if (secondaryCosts.length === 0) {
      try {
        const storedCosts = JSON.parse(
          invoice.costi_secondari_fornitori || "[]"
        );
        secondaryCosts = Array.isArray(storedCosts) ? storedCosts : [];
      } catch {
        secondaryCosts = [];
      }
    }

    const products: any[] = [];
    let reportChanged = false;

    for (const product of reportData.prodotti_letti) {
      const line: InvoiceLine = {
        linea: clean(product?.linea),
        barcode: clean(product?.barcode),
        codiceFornitore: clean(product?.codice_fornitore),
        descrizione: clean(product?.descrizione),
        quantita: toInteger(product?.quantita),
        prezzoUnitario: toNumber(product?.prezzo_unitario, 0),
        prezzoTotale: toNumber(product?.prezzo_totale, 0),
      };
      const secondaryType = classifySecondaryCost(line);

      if (!secondaryType) {
        products.push(product);
        continue;
      }

      reportChanged = true;

      const alreadyStored = secondaryCosts.some(
        (cost) =>
          clean(cost.tipo) === secondaryType &&
          clean(cost.descrizione) === line.descrizione
      );

      if (!alreadyStored) {
        secondaryCosts.push({
          tipo: secondaryType,
          descrizione: line.descrizione,
          importo: round(line.prezzoTotale, 2),
          quantita: line.quantita,
          prezzo_unitario: line.prezzoUnitario,
          codice_fornitore: line.codiceFornitore,
          barcode: line.barcode,
        });
      }
    }

    if (reportChanged) {
      const totalSecondaryCosts = round(
        secondaryCosts.reduce(
          (sum, cost) => sum + Number(cost.importo || 0),
          0
        ),
        2
      );

      reportData.prodotti_letti = products;
      reportData.costi_secondari_fornitori = secondaryCosts;
      reportData.totale_costi_secondari_fornitori = totalSecondaryCosts;

      db.runSync(
        `
        UPDATE invoice_imports
        SET report = ?,
            costi_secondari_fornitori = ?,
            totale_costi_secondari_fornitori = ?
        WHERE chiave_import = ?
        `,
        [
          JSON.stringify(reportData),
          JSON.stringify(secondaryCosts),
          totalSecondaryCosts,
          chiaveImport,
        ]
      );
    }

    return products;
  }

  if (!invoice.file) {
    throw new Error(
      "Il file XML associato alla fattura non è più disponibile"
    );
  }

  const xml = await FileSystem.readAsStringAsync(invoice.file);

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(xml);
  const rawLines = findAllByKey(parsed, "DettaglioLinee");
  const parsedLines = rawLines.map(parseInvoiceLine);

  const products = parsedLines.filter((line) => {
    if (!line.descrizione) return false;
    if (isInformativeLine(line.descrizione)) return false;
    if (classifySecondaryCost(line)) return false;
    return true;
  });

  const items = products.map((line) => ({
    linea: line.linea,
    barcode: line.barcode,
    codice_fornitore: line.codiceFornitore,
    descrizione: line.descrizione,
    quantita: line.quantita,
    prezzo_unitario: line.prezzoUnitario,
    prezzo_totale: line.prezzoTotale,
  }));

  reportData.prodotti_letti = items;

  db.runSync(
    `
    UPDATE invoice_imports
    SET report = ?
    WHERE chiave_import = ?
    `,
    [JSON.stringify(reportData), chiaveImport]
  );

  return items;
}

export function getPendingInvoiceProductsOffline(
  numeroFattura?: string
) {
  const db = getDb();

  const items = numeroFattura
    ? db.getAllSync<any>(
        `
        SELECT *
        FROM pending_invoice_products
        WHERE numero_fattura = ?
          AND stato != 'creato'
        ORDER BY CAST(linea AS INTEGER), created_at
        `,
        [numeroFattura]
      )
    : db.getAllSync<any>(`
        SELECT *
        FROM pending_invoice_products
        WHERE stato != 'creato'
        ORDER BY created_at DESC
      `);

  return items.map((item) => ({
    ...item,
    selected: Number(item.selected ?? 1) === 1,
  }));
}

export function createPendingInvoiceProductsOffline(items: any[]) {
  const db = getDb();

  let creati = 0;
  let gia_presenti = 0;
  let saltati = 0;

  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    for (const item of items) {
      const descrizione = String(item?.descrizione || "").trim();
      const barcode = String(item?.barcode || "").trim();
      const codiceProdotto = String(
        item?.codice_fornitore || item?.codice_prodotto || ""
      ).trim();

      const quantita = Math.max(
        0,
        Math.trunc(Number(item?.quantita || 0))
      );

      const prezzoAcquisto = Math.max(
        0,
        Number(item?.prezzo_unitario || 0)
      );

      if (!descrizione) {
        saltati += 1;
        continue;
      }

      let existing: any = null;

      if (barcode) {
        existing = db.getFirstSync<any>(
          `
          SELECT id
          FROM products
          WHERE TRIM(CAST(barcode AS TEXT)) = ?
          LIMIT 1
          `,
          [barcode]
        );
      }

      if (!existing && codiceProdotto) {
        existing = db.getFirstSync<any>(
          `
          SELECT id
          FROM products
          WHERE TRIM(CAST(codice_prodotto AS TEXT)) = ?
          LIMIT 1
          `,
          [codiceProdotto]
        );
      }

      if (existing) {
  db.runSync(
    `
    UPDATE products
    SET quantita = COALESCE(quantita, 0) + ?,
        prezzo_acquisto =
          CASE WHEN ? > 0 THEN ? ELSE prezzo_acquisto END,
        prezzo_vendita =
          CASE WHEN ? > 0 THEN ? ELSE prezzo_vendita END,
        updated_at = ?,
        da_sincronizzare = 1
    WHERE id = ?
    `,
    [
      quantita,
      prezzoAcquisto,
      prezzoAcquisto,
      prezzoAcquisto,
      calculateSalePrice(prezzoAcquisto, getPricingMarkupsOffline()),
      now,
      existing.id,
    ]
  );

  gia_presenti += 1;

  if (item?.id) {
    db.runSync(
      `
      UPDATE pending_invoice_products
      SET stato = 'creato',
          selected = 0,
          updated_at = ?
      WHERE id = ?
      `,
      [now, String(item.id)]
    );
  }

  continue;
}

      const productId = createId("PRODUCT");

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
          fornitore,
          quantita,
          prezzo_acquisto,
          prezzo_vendita,
          soglia_scorta,
          da_sincronizzare,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          productId,
          codiceProdotto,
          barcode,
          descrizione,
          "",
          "",
          "Altro",
          "Altro",
          String(item?.fornitore || ""),
          quantita,
          prezzoAcquisto,
          calculateSalePrice(prezzoAcquisto, getPricingMarkupsOffline()),
          5,
          1,
          now,
          now,
        ]
      );

      if (item?.id) {
        db.runSync(
          `
          UPDATE pending_invoice_products
          SET stato = 'creato',
              selected = 0,
              updated_at = ?
          WHERE id = ?
          `,
          [now, String(item.id)]
        );
      }

      creati += 1;
    }
  });

  return {
    ok: true,
    creati,
    created: creati,
    gia_presenti,
    saltati,
  };
}
