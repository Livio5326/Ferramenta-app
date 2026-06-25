from uuid import uuid4

from pymongo import MongoClient


MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "ferramenta"
PRODUCTS_COLLECTION_NAME = "products"


client = MongoClient(MONGO_URL)
db = client[DB_NAME]
products = db[PRODUCTS_COLLECTION_NAME]

query = {
    "$or": [
        {"id": {"$exists": False}},
        {"id": None},
        {"id": ""},
    ]
}

prodotti_senza_id = list(products.find(query))

print(f"Prodotti senza id trovati: {len(prodotti_senza_id)}")

aggiornati = 0

for prodotto in prodotti_senza_id:
    nuovo_id = str(uuid4())

    products.update_one(
        {"_id": prodotto["_id"]},
        {
            "$set": {
                "id": nuovo_id
            }
        }
    )

    aggiornati += 1

    print(
        f"OK | {nuovo_id} | "
        f"{prodotto.get('barcode', '')} | "
        f"{prodotto.get('descrizione', '')}"
    )

print("")
print(f"Prodotti aggiornati: {aggiornati}")
