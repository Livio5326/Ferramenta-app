from pathlib import Path
from zipfile import ZipFile
from pymongo import MongoClient
import shutil

ZIP_PATH = Path.home() / "Scaricati" / "foto_prodotti_stanley_2026.zip"
BACKEND_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BACKEND_DIR / "uploads"

UPLOADS_DIR.mkdir(exist_ok=True)

if not ZIP_PATH.exists():
    raise FileNotFoundError(f"Zip non trovato: {ZIP_PATH}")

db = MongoClient("mongodb://localhost:27017")["ferramenta"]
products = db.products

estratte = 0
aggiornati = 0
non_trovati = 0

with ZipFile(ZIP_PATH, "r") as z:
    for name in z.namelist():
        if not name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue

        filename = Path(name).name
        if not filename:
            continue

        barcode = Path(filename).stem.strip()
        dest = UPLOADS_DIR / filename

        with z.open(name) as src, open(dest, "wb") as out:
            shutil.copyfileobj(src, out)

        estratte += 1

        result = products.update_many(
            {"barcode": barcode},
            {"$set": {"foto": filename}}
        )

        if result.matched_count:
            aggiornati += result.modified_count
        else:
            non_trovati += 1

print("Foto estratte:", estratte)
print("Prodotti aggiornati:", aggiornati)
print("Foto senza prodotto trovato:", non_trovati)
print("Cartella foto:", UPLOADS_DIR)
