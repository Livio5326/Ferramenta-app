import os
import uuid
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "ferramenta_db")

excel_path = r"..\frontend\Catalogo_ferramenta_import_app.xlsx"

df = pd.read_excel(excel_path)

def clean_text(value):
    if pd.isna(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()

def clean_number(value, default=0):
    if pd.isna(value):
        return default
    try:
        return float(value)
    except Exception:
        return default

products = []

for _, row in df.iterrows():
    product = {
        "id": clean_text(row.get("ID")) or str(uuid.uuid4()),
        "barcode": clean_text(row.get("Barcode")),
        "codice_fornitore": clean_text(row.get("Codice_Fornitore")),
        "descrizione": clean_text(row.get("Descrizione")),
        "marca": clean_text(row.get("Marca")),
        "categoria": clean_text(row.get("Categoria")),
        "sottocategoria": clean_text(row.get("Sottocategoria")),
        "prezzo_acquisto": clean_number(row.get("Prezzo_Acquisto")),
        "prezzo_vendita": clean_number(row.get("Prezzo_Vendita")),
        "iva": clean_number(row.get("IVA"), 22),
        "quantita": int(clean_number(row.get("Quantita"), 0)),
        "scaffale": clean_text(row.get("Scaffale")),
        "corsia": clean_text(row.get("Corsia")),
        "fornitore": clean_text(row.get("Fornitore")),
        "foto": clean_text(row.get("Foto")),
        "note": clean_text(row.get("Note")),
        "data_aggiornamento": clean_text(row.get("Data_Aggiornamento")),
        "pagina_catalogo": clean_text(row.get("Pagina_Catalogo")),
        "fonte": clean_text(row.get("Fonte")),
    }

    if product["descrizione"]:
        products.append(product)

client = MongoClient(mongo_url)
db = client[db_name]

db.products.delete_many({})
if products:
    db.products.insert_many(products)

print(f"Importati {len(products)} prodotti nel database {db_name}.")
print("Primo prodotto:", products[0]["descrizione"] if products else "nessuno")
