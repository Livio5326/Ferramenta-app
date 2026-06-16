from pymongo import MongoClient
from bson.json_util import dumps
from pathlib import Path
from datetime import datetime
import json
import re

BASE = Path(__file__).resolve().parent
MAP_FILE = BASE / "stanley_correzioni_descrizioni_v4.json"
BACKUP_DIR = Path.home() / "Scaricati"

client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]
products = db.products

maps = json.loads(MAP_FILE.read_text(encoding="utf-8"))
by_code = {str(k).strip().upper(): str(v).strip() for k, v in maps.get("by_codice_prodotto", {}).items()}
by_barcode = {str(k).strip(): str(v).strip() for k, v in maps.get("by_barcode", {}).items()}

stanley = list(products.find({"marca": {"$regex": "stanley", "$options": "i"}}))
backup = BACKUP_DIR / ("backup_prima_correzione_stanley_descrizioni_v4_" + datetime.now().strftime("%Y%m%d-%H%M") + ".json")
backup.write_text(dumps(stanley, indent=2), encoding="utf-8")

aggiornati = 0
gia_ok = 0
senza_mappa = 0
aggiornati_dettaglio = []

for p in stanley:
    codice = str(p.get("codice_prodotto") or "").strip().upper()
    barcode = str(p.get("barcode") or "").strip()
    nuova = by_code.get(codice) or by_barcode.get(barcode)

    if not nuova:
        senza_mappa += 1
        continue

    attuale = str(p.get("descrizione") or "").strip()
    if attuale == nuova:
        gia_ok += 1
        continue

    products.update_one({"_id": p["_id"]}, {"$set": {"descrizione": nuova}})
    aggiornati += 1
    aggiornati_dettaglio.append((codice, barcode, attuale, nuova))

# Controllo residui sospetti: titoli tecnici, unità di misura o descrizioni troppo generiche
sospetto_re = re.compile(
    r"^(\(|\d|[A-Z0-9,./°\-\s]+\)?\s*€?$)|PESO|DOTAZIONE|COLORE|DENTI/POLL|ATTACCO|DIMENSIONI|NR BOLLE|G/K|MM\)|KG\)|CM\)|AVVITATORI$|ALTRI ELETTROUTENSILI|ALTRE FRESE|ACCESSORI PER|ABRASIVI DA|ABRASIVI PER|A MAGLIA DA",
    re.I,
)
residui = []
for p in products.find({"marca": {"$regex": "stanley", "$options": "i"}}, {"codice_prodotto":1, "barcode":1, "descrizione":1, "categoria":1}).limit(10000):
    d = str(p.get("descrizione") or "").strip()
    if d and sospetto_re.search(d):
        residui.append(p)

report = BACKUP_DIR / ("report_residui_descrizioni_stanley_v4_" + datetime.now().strftime("%Y%m%d-%H%M") + ".txt")
with report.open("w", encoding="utf-8") as f:
    f.write(f"Backup creato: {backup}\n")
    f.write(f"Prodotti Stanley letti: {len(stanley)}\n")
    f.write(f"Descrizioni aggiornate: {aggiornati}\n")
    f.write(f"Gia corrette: {gia_ok}\n")
    f.write(f"Senza mappa in questa patch: {senza_mappa}\n")
    f.write(f"Residui sospetti trovati: {len(residui)}\n\n")

    f.write("AGGIORNATI\n")
    f.write("=" * 80 + "\n")
    for codice, barcode, vecchia, nuova in aggiornati_dettaglio[:500]:
        f.write(f"CODICE: {codice} | BARCODE: {barcode}\n")
        f.write(f"DA: {vecchia}\n")
        f.write(f"A : {nuova}\n")
        f.write("-" * 80 + "\n")

    f.write("\nRESIDUI SOSPETTI\n")
    f.write("=" * 80 + "\n")
    for p in residui[:500]:
        f.write(f"CODICE: {p.get('codice_prodotto')} | BARCODE: {p.get('barcode')} | DESC: {p.get('descrizione')} | CAT: {p.get('categoria')}\n")

print("Backup creato:", backup)
print("Prodotti Stanley letti:", len(stanley))
print("Descrizioni aggiornate:", aggiornati)
print("Gia corrette:", gia_ok)
print("Senza mappa in questa patch:", senza_mappa)
print("Report residui:", report)
print("Residui sospetti trovati:", len(residui))
