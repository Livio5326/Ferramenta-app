"""Ricalcola i prezzi di vendita esistenti con backup preventivo."""

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

from pricing import calculate_sale_price


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup-dir", default="../backups")
    args = parser.parse_args()

    backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(backend_dir / ".env")
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    products = list(
        db.products.find(
            {"prezzo_acquisto": {"$gt": 0}},
            {"id": 1, "barcode": 1, "prezzo_acquisto": 1, "prezzo_vendita": 1},
        )
    )

    changes = []
    for product in products:
        purchase = float(product.get("prezzo_acquisto") or 0)
        old_sale = float(product.get("prezzo_vendita") or 0)
        new_sale = calculate_sale_price(purchase)
        if abs(old_sale - new_sale) > 0.001:
            changes.append((product, new_sale))

    print(json.dumps({"esaminati": len(products), "da_aggiornare": len(changes)}))
    if not args.apply or not changes:
        return

    backup_dir = (backend_dir / args.backup_dir).resolve()
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"prezzi_vendita_prima_ricarichi_{timestamp}.json"
    backup = [
        {
            "id": product.get("id"),
            "barcode": product.get("barcode"),
            "prezzo_acquisto": product.get("prezzo_acquisto"),
            "prezzo_vendita": product.get("prezzo_vendita"),
        }
        for product, _ in changes
    ]
    backup_path.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")

    now = datetime.now(timezone.utc).isoformat()
    operations = [
        UpdateOne(
            {"_id": product["_id"]},
            {"$set": {"prezzo_vendita": new_sale, "updated_at": now}},
        )
        for product, new_sale in changes
    ]
    result = db.products.bulk_write(operations, ordered=False)
    print(json.dumps({"aggiornati": result.modified_count, "backup": str(backup_path)}))


if __name__ == "__main__":
    main()
