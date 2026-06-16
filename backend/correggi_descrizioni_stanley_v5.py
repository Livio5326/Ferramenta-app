from pymongo import MongoClient
from bson.json_util import dumps
from pathlib import Path
from datetime import datetime
import json, re

BASE = Path(__file__).resolve().parent
MAP_PATH = BASE / "stanley_descrizioni_v5_da_pdf.json"

if not MAP_PATH.exists():
    raise FileNotFoundError(f"Mappa non trovata: {MAP_PATH}")

mappa = json.loads(MAP_PATH.read_text(encoding="utf-8"))
db = MongoClient("mongodb://localhost:27017")["ferramenta"]
products = db.products

backup = Path.home() / "Scaricati" / ("backup_prima_descrizioni_stanley_v5_" + datetime.now().strftime("%Y%m%d-%H%M") + ".json")
stanley = list(products.find({"marca": {"$regex": "stanley", "$options": "i"}}))
backup.write_text(dumps(stanley, indent=2), encoding="utf-8")
print("Backup creato:", backup)
print("Prodotti Stanley trovati:", len(stanley))

aggiornati = 0
gia_ok = 0
senza_mappa = []

for p in stanley:
    codice = str(p.get("codice_prodotto") or "").strip()
    if not codice or codice not in mappa:
        senza_mappa.append((codice, p.get("barcode"), p.get("descrizione")))
        continue
    nuova = str(mappa[codice].get("descrizione") or "").strip()
    if not nuova:
        senza_mappa.append((codice, p.get("barcode"), p.get("descrizione")))
        continue
    attuale = str(p.get("descrizione") or "").strip()
    if attuale == nuova:
        gia_ok += 1
        continue
    products.update_one({"_id": p["_id"]}, {"$set": {"descrizione": nuova}})
    aggiornati += 1

# Report duplicati e residui sospetti dopo aggiornamento
sospetti_pattern = re.compile(r"^(\(?[A-Z/ ]{1,18}\)?|AVVITATORI|ATTACCO|PESO|DOTAZIONE|DIMENSIONI|COLORE|NUMERO|CAPACIT|LUNGHEZZA|LARGHEZZA|\(MM\)|\(KG\)|\(G/K\))", re.I)
report = []
report.append("AGGIORNAMENTO DESCRIZIONI STANLEY V5")
report.append(f"Aggiornati: {aggiornati}")
report.append(f"Già corretti: {gia_ok}")
report.append(f"Senza mappa: {len(senza_mappa)}")
report.append("")
report.append("RESIDUI SOSPETTI")
report.append("-" * 80)
residui = list(products.find({"marca": {"$regex": "stanley", "$options": "i"}}, {"codice_prodotto":1,"barcode":1,"descrizione":1,"categoria":1}).sort("descrizione", 1))
count_residui = 0
for p in residui:
    d = str(p.get("descrizione") or "").strip()
    if sospetti_pattern.search(d) or len(d) < 8:
        count_residui += 1
        report.append(f"CODICE: {p.get('codice_prodotto')} | BARCODE: {p.get('barcode')} | CAT: {p.get('categoria')} | DESC: {d}")
report.append("")
report.append("DUPLICATI DESCRIZIONE")
report.append("-" * 80)
from collections import defaultdict
gruppi = defaultdict(list)
for p in residui:
    d = str(p.get("descrizione") or "").strip()
    if d:
        gruppi[d].append(str(p.get("codice_prodotto") or ""))
for desc, codici in sorted(gruppi.items(), key=lambda x: (-len(x[1]), x[0])):
    if len(codici) > 1:
        report.append(f"{desc} -> {', '.join(codici[:20])}" + (" ..." if len(codici)>20 else ""))

report_path = Path.home() / "Scaricati" / ("report_descrizioni_stanley_v5_" + datetime.now().strftime("%Y%m%d-%H%M") + ".txt")
report_path.write_text("\n".join(report), encoding="utf-8")
print("Descrizioni aggiornate:", aggiornati)
print("Già corrette:", gia_ok)
print("Senza mappa:", len(senza_mappa))
print("Residui sospetti:", count_residui)
print("Report creato:", report_path)
