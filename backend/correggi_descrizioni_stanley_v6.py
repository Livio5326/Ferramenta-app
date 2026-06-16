from pymongo import MongoClient
from bson.json_util import dumps
from pathlib import Path
from datetime import datetime
import json

BASE = Path(__file__).resolve().parent
MAP_PATH = BASE / "stanley_descrizioni_v6_mirate.json"
if not MAP_PATH.exists():
    raise FileNotFoundError(f"Mappa non trovata: {MAP_PATH}")

mappa = json.loads(MAP_PATH.read_text(encoding="utf-8"))
client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]
products = db.products

backup = Path.home() / "Scaricati" / ("backup_prima_descrizioni_stanley_v6_" + datetime.now().strftime("%Y%m%d-%H%M") + ".json")
selezionati = list(products.find({"codice_prodotto": {"$in": list(mappa.keys())}}))
backup.write_text(dumps(selezionati, indent=2), encoding="utf-8")
print("Backup creato:", backup)
print("Prodotti da correggere trovati:", len(selezionati))

aggiornati = 0
non_trovati = []
for codice, nuova_desc in mappa.items():
    res = products.update_many({"codice_prodotto": codice}, {"$set": {"descrizione": nuova_desc}})
    if res.matched_count == 0:
        non_trovati.append(codice)
    else:
        aggiornati += res.modified_count
        print(f"OK {codice} -> {nuova_desc}")

report = Path.home() / "Scaricati" / ("report_descrizioni_stanley_v6_" + datetime.now().strftime("%Y%m%d-%H%M") + ".txt")
righe = [
    "CORREZIONE DESCRIZIONI STANLEY V6",
    f"Record aggiornati: {aggiornati}",
    f"Codici in mappa: {len(mappa)}",
    f"Codici non trovati nel DB: {len(non_trovati)}",
    "",
    "CODICI NON TROVATI:",
] + non_trovati
report.write_text("
".join(righe), encoding="utf-8")
print("Record aggiornati:", aggiornati)
print("Codici non trovati:", len(non_trovati))
print("Report creato:", report)
