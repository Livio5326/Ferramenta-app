from pymongo import MongoClient
import re

db = MongoClient("mongodb://localhost:27017")["ferramenta"]
products = db.products

totali = 0
aggiornati = 0
senza_codice = 0

for p in products.find({}):
    totali += 1
    note = (p.get("note") or "").strip()
    codice_attuale = (p.get("codice_prodotto") or "").strip()

    codice = codice_attuale
    nuova_note = note

    m = re.match(r"^Codice fornitore:\s*(.+)$", note, re.IGNORECASE)

    if m:
        codice = m.group(1).strip()
        nuova_note = ""

    if codice:
        products.update_one(
            {"_id": p["_id"]},
            {"$set": {"codice_prodotto": codice, "note": nuova_note}}
        )
        aggiornati += 1
    else:
        senza_codice += 1

print("Prodotti totali:", totali)
print("Prodotti aggiornati con codice_prodotto:", aggiornati)
print("Prodotti senza codice:", senza_codice)
