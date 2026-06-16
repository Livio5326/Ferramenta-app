from pymongo import MongoClient
from bson.json_util import dumps
from pathlib import Path
from datetime import datetime
import json

BASE_DIR = Path(__file__).resolve().parent
MAP_PATH = BASE_DIR / "stanley_descrizioni_pdf_migliorate.json"

if not MAP_PATH.exists():
    raise FileNotFoundError(f"File mappa non trovato: {MAP_PATH}")

mappa = json.loads(MAP_PATH.read_text(encoding="utf-8"))

client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]
products = db.products

query_stanley = {"marca": {"$regex": "stanley", "$options": "i"}}
stanley = list(products.find(query_stanley))

backup_path = Path.home() / "Scaricati" / ("backup_stanley_prima_correzione_descrizioni_" + datetime.now().strftime("%Y%m%d-%H%M") + ".json")
backup_path.write_text(dumps(stanley, indent=2), encoding="utf-8")

aggiornati = 0
gia_ok = 0
senza_mappa = []
esempi = []

for p in stanley:
    barcode = str(p.get("barcode") or "").strip()
    codice = str(p.get("codice_prodotto") or "").strip()
    descrizione_attuale = str(p.get("descrizione") or "").strip()

    descrizione_corretta = mappa.get(barcode)

    if not descrizione_corretta:
        senza_mappa.append((barcode, codice, descrizione_attuale, p.get("categoria")))
        continue

    descrizione_corretta = str(descrizione_corretta).strip()

    if descrizione_attuale == descrizione_corretta:
        gia_ok += 1
        continue

    products.update_one(
        {"_id": p["_id"]},
        {"$set": {"descrizione": descrizione_corretta}}
    )
    aggiornati += 1

    if len(esempi) < 20:
        esempi.append((barcode, codice, descrizione_attuale, descrizione_corretta))

print("Backup creato:", backup_path)
print("Prodotti Stanley nel database:", len(stanley))
print("Descrizioni aggiornate:", aggiornati)
print("Descrizioni gia corrette:", gia_ok)
print("Prodotti senza mappa PDF:", len(senza_mappa))

if esempi:
    print("\nESEMPI AGGIORNATI")
    print("-" * 80)
    for barcode, codice, vecchia, nuova in esempi:
        print("BARCODE:", barcode)
        print("CODICE:", codice)
        print("PRIMA:", vecchia)
        print("DOPO :", nuova)
        print("-" * 80)

if senza_mappa:
    report_path = Path.home() / "Scaricati" / ("stanley_senza_mappa_descrizione_" + datetime.now().strftime("%Y%m%d-%H%M") + ".txt")
    righe = []
    for barcode, codice, descrizione, categoria in senza_mappa[:300]:
        righe.append(f"BARCODE: {barcode}")
        righe.append(f"CODICE: {codice}")
        righe.append(f"DESCRIZIONE ATTUALE: {descrizione}")
        righe.append(f"CATEGORIA: {categoria}")
        righe.append("-" * 80)
    report_path.write_text("\n".join(righe), encoding="utf-8")
    print("Report prodotti senza mappa creato:", report_path)
