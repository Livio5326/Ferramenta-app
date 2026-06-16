from pathlib import Path
from pymongo import MongoClient
import json
from datetime import datetime
from bson.json_util import dumps

BASE = Path(__file__).resolve().parent
MAP_PATH = BASE / "stanley_descrizioni_corrette.json"

if not MAP_PATH.exists():
    raise FileNotFoundError(f"File mappa non trovato: {MAP_PATH}")

mapping = json.loads(MAP_PATH.read_text(encoding="utf-8"))
client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]
products = db.products

backup = Path.home() / "Scaricati" / ("backup_prima_correzione_descrizioni_stanley_" + datetime.now().strftime("%Y%m%d-%H%M") + ".json")
stanley = list(products.find({"marca": {"$regex": "stanley", "$options": "i"}}))
backup.write_text(dumps(stanley, indent=2), encoding="utf-8")

aggiornati = 0
non_trovati_mappa = 0
giusti = 0
esempi = []

for p in stanley:
    barcode = str(p.get("barcode") or "").strip()
    nuova = mapping.get(barcode)
    if not nuova:
        non_trovati_mappa += 1
        continue
    vecchia = str(p.get("descrizione") or "").strip()
    if vecchia == nuova:
        giusti += 1
        continue
    products.update_one({"_id": p["_id"]}, {"$set": {"descrizione": nuova}})
    aggiornati += 1
    if len(esempi) < 20:
        esempi.append((barcode, p.get("codice_prodotto"), vecchia, nuova))

print("Backup creato:", backup)
print("Prodotti Stanley letti:", len(stanley))
print("Descrizioni aggiornate:", aggiornati)
print("Già corrette:", giusti)
print("Senza descrizione corretta nella mappa:", non_trovati_mappa)
print("\nEsempi aggiornati:")
for barcode, codice, vecchia, nuova in esempi:
    print("-", barcode, codice)
    print("  PRIMA:", vecchia)
    print("  DOPO :", nuova)
