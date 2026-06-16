from pymongo import MongoClient
from bson.json_util import dumps
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import json, re

BASE = Path(__file__).resolve().parent
MAP_PATH = BASE / "stanley_descrizioni_v7_completa.json"
if not MAP_PATH.exists():
    raise FileNotFoundError(f"Mappa non trovata: {MAP_PATH}")

mappa = json.loads(MAP_PATH.read_text(encoding="utf-8"))
client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]
products = db.products

stanley = list(products.find({"marca": {"$regex": "stanley", "$options": "i"}}))
backup = Path.home() / "Scaricati" / ("backup_prima_descrizioni_stanley_v7_" + datetime.now().strftime("%Y%m%d-%H%M") + ".json")
backup.write_text(dumps(stanley, indent=2), encoding="utf-8")
print("Backup creato:", backup)
print("Prodotti Stanley trovati:", len(stanley))
print("Descrizioni in mappa:", len(mappa))

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
    res = products.update_one({"_id": p["_id"]}, {"$set": {"descrizione": nuova}})
    aggiornati += res.modified_count

# Report residui sospetti dopo aggiornamento
sospetti_regex = re.compile(
    r"^(\(?MM\)?|\(?KG\)?|\(?CM\)?|\(?G/K\)?|\d+\s*W$|\d+\s*x\s*18V$|2×\s*18V$|0,75\s*L$|ATTACCO|DOTAZIONE|PESO|DIMENSIONI|COLORE|CONFEZ|CAPACIT|FATMAX$|CONTROL-LOCK$)",
    re.IGNORECASE
)
residui = []
all_stanley = list(products.find({"marca": {"$regex": "stanley", "$options": "i"}}, {"codice_prodotto":1,"barcode":1,"descrizione":1,"categoria":1,"note":1}).sort("codice_prodotto", 1))
for p in all_stanley:
    d = str(p.get("descrizione") or "").strip()
    if not d or len(d) < 8 or sospetti_regex.search(d) or re.fullmatch(r"[0-9x×,.\-\sA-Z°()/]+", d):
        residui.append(p)

dup = defaultdict(list)
for p in all_stanley:
    d = str(p.get("descrizione") or "").strip()
    if d:
        dup[d].append(str(p.get("codice_prodotto") or ""))

report = []
report.append("CORREZIONE DESCRIZIONI STANLEY V7")
report.append("="*80)
report.append(f"Prodotti Stanley trovati: {len(stanley)}")
report.append(f"Descrizioni aggiornate: {aggiornati}")
report.append(f"Già corrette: {gia_ok}")
report.append(f"Senza mappa: {len(senza_mappa)}")
report.append(f"Residui sospetti: {len(residui)}")
report.append("")
report.append("RESIDUI SOSPETTI")
report.append("-"*80)
for p in residui[:400]:
    report.append(f"CODICE: {p.get('codice_prodotto')} | BARCODE: {p.get('barcode')} | CAT: {p.get('categoria')} | DESC: {p.get('descrizione')} | NOTE: {p.get('note')}")
report.append("")
report.append("DUPLICATI BREVI")
report.append("-"*80)
for desc, codici in sorted(dup.items(), key=lambda x: (-len(x[1]), x[0])):
    if len(codici) >= 3 and len(desc) < 45:
        report.append(f"{desc} -> {', '.join(codici[:30])}" + (" ..." if len(codici)>30 else ""))
report_path = Path.home() / "Scaricati" / ("report_descrizioni_stanley_v7_" + datetime.now().strftime("%Y%m%d-%H%M") + ".txt")
report_path.write_text("\n".join(report), encoding="utf-8")
print("Descrizioni aggiornate:", aggiornati)
print("Già corrette:", gia_ok)
print("Senza mappa:", len(senza_mappa))
print("Residui sospetti:", len(residui))
print("Report creato:", report_path)
