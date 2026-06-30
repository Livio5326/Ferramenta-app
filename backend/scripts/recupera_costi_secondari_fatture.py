from pathlib import Path
import sys
from xml.etree import ElementTree as ET
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

try:
    from import_fatture_service import classifica_costo_secondario_fornitore_intelligente
except Exception:
    from import_fatture_service import classifica_costo_accessorio_intelligente as classifica_costo_secondario_fornitore_intelligente

client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]


def local_name(tag):
    return str(tag).split("}", 1)[-1]


def find_child_text(node, name, default=""):
    for child in list(node):
        if local_name(child.tag) == name:
            return (child.text or "").strip()
    return default


def xml_float(value, default=0.0):
    try:
        return float(str(value or "").replace(",", ".").strip())
    except Exception:
        return default


def trova_codici(dettaglio):
    codice = ""
    codice_fornitore = ""
    barcode = ""

    for node in dettaglio.iter():
        if local_name(node.tag) != "CodiceArticolo":
            continue

        tipo = ""
        valore = ""

        for child in list(node):
            lname = local_name(child.tag)
            if lname == "CodiceTipo":
                tipo = (child.text or "").strip()
            elif lname == "CodiceValore":
                valore = (child.text or "").strip()

        tipo_up = tipo.upper()
        valore = valore.strip()

        if not valore:
            continue

        if tipo_up in ["EAN", "BARCODE", "CODICE EAN", "GTIN"]:
            barcode = valore
        elif not codice_fornitore:
            codice_fornitore = valore

        if not codice:
            codice = valore

    return codice, codice_fornitore, barcode


def estrai_costi_secondari_da_xml(xml_path: Path):
    tree = ET.parse(xml_path)
    root = tree.getroot()

    costi = []

    for dettaglio in root.iter():
        if local_name(dettaglio.tag) != "DettaglioLinea":
            continue

        descrizione = find_child_text(dettaglio, "Descrizione")
        quantita = xml_float(find_child_text(dettaglio, "Quantita"), 0.0)
        prezzo_unitario = xml_float(find_child_text(dettaglio, "PrezzoUnitario"), 0.0)
        prezzo_totale = xml_float(find_child_text(dettaglio, "PrezzoTotale"), 0.0)

        codice, codice_fornitore, barcode = trova_codici(dettaglio)

        tipo = classifica_costo_secondario_fornitore_intelligente(
            descrizione=descrizione,
            codice=codice,
            codice_fornitore=codice_fornitore,
            barcode=barcode,
            quantita=quantita,
            prezzo_totale=prezzo_totale,
        )

        if not tipo:
            continue

        costi.append({
            "tipo": tipo,
            "descrizione": descrizione,
            "importo": round(prezzo_totale, 2),
            "quantita": quantita,
            "prezzo_unitario": prezzo_unitario,
            "codice": codice,
            "codice_fornitore": codice_fornitore,
            "barcode": barcode,
            "origine": "recupero_storico_xml",
        })

    totale = round(sum(float(c.get("importo") or 0) for c in costi), 2)
    return costi, totale


def resolve_file_path(value):
    if not value:
        return None

    p = Path(str(value))

    if p.is_absolute():
        return p

    return BASE_DIR / p


aggiornate = 0
saltate_file_mancante = 0
senza_costi = 0

for fattura in db.invoice_imports.find({}):
    numero = fattura.get("numero") or fattura.get("numero_fattura") or fattura.get("fattura") or "N/D"
    file_value = fattura.get("file")
    xml_path = resolve_file_path(file_value)

    if not xml_path or not xml_path.exists():
        print(f"SKIP file mancante | fattura {numero} | file: {file_value}")
        saltate_file_mancante += 1
        continue

    try:
        costi, totale = estrai_costi_secondari_da_xml(xml_path)
    except Exception as e:
        print(f"ERRORE lettura XML | fattura {numero} | {xml_path} | {e}")
        continue

    db.invoice_imports.update_one(
        {"_id": fattura["_id"]},
        {
            "$set": {
                "costi_secondari_fornitori": costi,
                "totale_costi_secondari_fornitori": totale,

                # Compatibilità temporanea con il vecchio nome, se qualche schermata lo legge ancora.
                "costi_accessori": costi,
                "totale_costi_accessori": totale,
            }
        }
    )

    if costi:
        aggiornate += 1
        print(f"OK fattura {numero} | costi trovati: {len(costi)} | totale: {totale}")
        for c in costi:
            print(f"  - {c['tipo']} | {c['descrizione']} | € {c['importo']}")
    else:
        senza_costi += 1
        print(f"OK fattura {numero} | nessun costo secondario trovato")

print()
print("Riepilogo")
print("Fatture aggiornate con costi:", aggiornate)
print("Fatture senza costi:", senza_costi)
print("Fatture saltate per file mancante:", saltate_file_mancante)
