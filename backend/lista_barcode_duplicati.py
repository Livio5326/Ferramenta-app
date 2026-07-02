from pymongo import MongoClient
from collections import defaultdict

client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]

gruppi = defaultdict(list)

for p in db.products.find({}):
    barcode = str(p.get("barcode") or "").strip()
    if barcode and barcode.upper() not in ["N/D", "ND", "-"]:
        gruppi[barcode].append(p)

for barcode, prodotti in gruppi.items():
    if len(prodotti) > 1:
        print("\nBARCODE DUPLICATO:", barcode)
        for p in prodotti:
            print({
                "id": p.get("id"),
                "codice_prodotto": p.get("codice_prodotto"),
                "descrizione": p.get("descrizione"),
                "quantita": p.get("quantita"),
                "prezzo_vendita": p.get("prezzo_vendita"),
                "fornitore": p.get("fornitore"),
            })

