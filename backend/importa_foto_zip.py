from pathlib import Path
from zipfile import ZipFile
import shutil
import os
from pymongo import MongoClient

ZIP_PATH = Path.home() / "Scaricati" / "foto_prodotti_barcode.zip"
BACKEND_DIR = Path(__file__).parent
UPLOADS_DIR = BACKEND_DIR / "uploads"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "ferramenta")
BASE_URL = "http://192.168.31.209:8001"

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}

if not ZIP_PATH.exists():
    raise FileNotFoundError(f"ZIP non trovato: {ZIP_PATH}")

UPLOADS_DIR.mkdir(exist_ok=True)

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
products = db.products

found_images = 0
updated_products = 0
skipped_no_product = 0
skipped_invalid = 0

with ZipFile(ZIP_PATH, "r") as z:
    for item in z.infolist():
        if item.is_dir():
            continue

        original_name = Path(item.filename).name
        ext = Path(original_name).suffix.lower()

        if ext not in ALLOWED_EXT:
            skipped_invalid += 1
            continue

        barcode = Path(original_name).stem.strip()

        if not barcode:
            skipped_invalid += 1
            continue

        found_images += 1

        output_name = f"{barcode}{ext}"
        output_path = UPLOADS_DIR / output_name

        with z.open(item) as src, open(output_path, "wb") as dst:
            shutil.copyfileobj(src, dst)

        foto_url = f"{BASE_URL}/uploads/{output_name}"

        result = products.update_one(
            {"barcode": barcode},
            {"$set": {"foto": foto_url}}
        )

        if result.matched_count:
            updated_products += 1
        else:
            skipped_no_product += 1

print("IMPORT FOTO COMPLETATO")
print(f"Foto trovate nello ZIP: {found_images}")
print(f"Prodotti aggiornati: {updated_products}")
print(f"Immagini senza prodotto corrispondente: {skipped_no_product}")
print(f"File ignorati/non validi: {skipped_invalid}")
print(f"Cartella uploads: {UPLOADS_DIR}") 
