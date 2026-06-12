import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "ferramenta_db")

client = MongoClient(mongo_url)
db = client[db_name]

uploads_dir = "uploads"
files = set(os.listdir(uploads_dir))

updated = 0
missing = 0

for product in db.products.find({}):
    barcode = str(product.get("barcode", "")).strip()
    filename = f"{barcode}.jpg"

    if barcode and filename in files:
        db.products.update_one(
            {"id": product["id"]},
            {"$set": {"foto": filename}}
        )
        updated += 1
    else:
        missing += 1

print(f"Foto collegate: {updated}")
print(f"Prodotti senza foto trovata: {missing}")
