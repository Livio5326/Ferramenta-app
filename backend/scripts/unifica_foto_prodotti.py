from pymongo import MongoClient
from datetime import datetime, timezone

client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]

campi_origine = ["image_url", "immagine", "immagine_url"]

def vuoto(valore):
    return valore is None or str(valore).strip() == ""

prodotti = db.products.find({})

controllati = 0
aggiornati = 0
gia_ok = 0
senza_foto = 0

for p in prodotti:
    controllati += 1

    foto_attuale = p.get("foto")

    if not vuoto(foto_attuale):
        gia_ok += 1
        continue

    nuova_foto = ""

    for campo in campi_origine:
        valore = p.get(campo)
        if not vuoto(valore):
            nuova_foto = str(valore).strip()
            break

    if vuoto(nuova_foto):
        senza_foto += 1
        continue

    db.products.update_one(
        {"_id": p["_id"]},
        {
            "$set": {
                "foto": nuova_foto,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )

    aggiornati += 1

print("Prodotti controllati:", controllati)
print("Prodotti già con foto:", gia_ok)
print("Prodotti aggiornati:", aggiornati)
print("Prodotti ancora senza foto:", senza_foto)
