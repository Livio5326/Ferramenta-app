from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
from pymongo import MongoClient

SCARICATI = Path.home() / "Scaricati"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "ferramenta"

POSSIBILI_BARCODE = {
    "barcode",
    "codiceabarre",
    "codicebarre",
    "ean",
}

POSSIBILI_CODICE_FORNITORE = {
    "codicefornitore",
    "codiceforn",
    "codfornitore",
    "codice",
    "codiceprodotto",
    "modello",
    "sku",
    "articolo",
}

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
}

def normalizza_colonna(nome):
    return str(nome).strip().lower().replace(" ", "").replace("_", "").replace(".", "")

def col_to_index(cell_ref):
    letters = ""
    for ch in cell_ref:
        if ch.isalpha():
            letters += ch
        else:
            break
    index = 0
    for ch in letters:
        index = index * 26 + (ord(ch.upper()) - ord("A") + 1)
    return index - 1

def normalizza_valore(v):
    s = str(v or "").strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s

def read_shared_strings(z):
    shared = []
    if "xl/sharedStrings.xml" not in z.namelist():
        return shared

    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in root.findall("main:si", NS):
        texts = []
        for t in si.findall(".//main:t", NS):
            texts.append(t.text or "")
        shared.append("".join(texts))
    return shared

def read_cell_value(cell, shared):
    cell_type = cell.attrib.get("t")
    value_el = cell.find("main:v", NS)

    if cell_type == "inlineStr":
        text_el = cell.find(".//main:t", NS)
        return text_el.text if text_el is not None else ""

    if value_el is None:
        return ""

    value = value_el.text or ""

    if cell_type == "s":
        try:
            return shared[int(value)]
        except Exception:
            return ""

    return value

def read_xlsx_rows(path):
    with ZipFile(path, "r") as z:
        if "xl/worksheets/sheet1.xml" not in z.namelist():
            raise Exception("sheet1.xml non trovato")

        shared = read_shared_strings(z)
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))

        rows = []
        for row in root.findall(".//main:row", NS):
            values = {}
            max_idx = -1

            for cell in row.findall("main:c", NS):
                ref = cell.attrib.get("r", "")
                idx = col_to_index(ref)
                values[idx] = read_cell_value(cell, shared)
                max_idx = max(max_idx, idx)

            if max_idx >= 0:
                rows.append([values.get(i, "") for i in range(max_idx + 1)])

        return rows

def trova_excel_valido():
    for excel_path in SCARICATI.glob("*.xlsx"):
        try:
            rows = read_xlsx_rows(excel_path)
        except Exception:
            continue

        for header_index, row in enumerate(rows[:20]):
            colonne_norm = {normalizza_colonna(v): i for i, v in enumerate(row)}

            barcode_idx = None
            codice_idx = None

            for nome in POSSIBILI_BARCODE:
                if nome in colonne_norm:
                    barcode_idx = colonne_norm[nome]
                    break

            for nome in POSSIBILI_CODICE_FORNITORE:
                if nome in colonne_norm:
                    codice_idx = colonne_norm[nome]
                    break

            if barcode_idx is not None and codice_idx is not None:
                return excel_path, rows, header_index, barcode_idx, codice_idx, row

    return None, None, None, None, None, None

excel_path, rows, header_index, barcode_idx, codice_idx, header = trova_excel_valido()

if excel_path is None:
    print("ERRORE: non ho trovato un Excel in Scaricati con colonne BARCODE e CODICE FORNITORE.")
    print("Excel presenti:")
    for p in SCARICATI.glob("*.xlsx"):
        print("-", p.name)
    raise SystemExit(1)

print("File Excel usato:", excel_path.name)
print("Colonna barcode:", header[barcode_idx])
print("Colonna codice fornitore:", header[codice_idx])

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
products = db.products

righe_lette = 0
aggiornati = 0
saltati_senza_barcode = 0
saltati_senza_codice = 0
non_trovati = 0

for row in rows[header_index + 1:]:
    righe_lette += 1

    barcode = normalizza_valore(row[barcode_idx] if barcode_idx < len(row) else "")
    codice_fornitore = normalizza_valore(row[codice_idx] if codice_idx < len(row) else "")

    if not barcode:
        saltati_senza_barcode += 1
        continue

    if not codice_fornitore:
        saltati_senza_codice += 1
        continue

    nuova_nota = f"Codice fornitore: {codice_fornitore}"

    result = products.update_one(
        {"barcode": barcode},
        {"$set": {"note": nuova_nota}}
    )

    if result.matched_count:
        aggiornati += 1
    else:
        non_trovati += 1

print("AGGIORNAMENTO COMPLETATO")
print("Righe lette Excel:", righe_lette)
print("Prodotti aggiornati:", aggiornati)
print("Saltati senza barcode:", saltati_senza_barcode)
print("Saltati senza codice fornitore:", saltati_senza_codice)
print("Barcode non trovati nel database:", non_trovati)
PY  
