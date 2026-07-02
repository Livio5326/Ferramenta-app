from pymongo import MongoClient
import json
from pathlib import Path

client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]

products = list(db.products.find({}))

for p in products:
    p.pop("_id", None)

out = Path("../frontend/assets/offline_products.json")
out.parent.mkdir(parents=True, exist_ok=True)

with open(out, "w", encoding="utf-8") as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print(f"Esportati {len(products)} prodotti in {out}")
