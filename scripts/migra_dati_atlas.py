"""Copia il database locale su Atlas senza salvare la password."""

from __future__ import annotations

import getpass
import sys
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import dotenv_values
from pymongo import MongoClient


REPO_ROOT = Path(__file__).resolve().parents[1]
LOCAL_ENV = REPO_ROOT / "backend" / ".env"
ATLAS_HOST = "ferramenta.b5ihzw6.mongodb.net"
ATLAS_USER = "ferramenta_app"
TARGET_DB_NAME = "ferramenta"
BATCH_SIZE = 500
EXCLUDED_COLLECTIONS = {
    "app_migrations",
    "invoice_imports",
    "pending_invoice_products",
    "products",
    "sales",
}


def fail(message: str) -> None:
    print(f"\nERRORE: {message}")
    raise SystemExit(1)


def main() -> None:
    config = dotenv_values(LOCAL_ENV)
    local_uri = config.get("MONGO_URL")
    local_db_name = config.get("DB_NAME")
    if not local_uri or not local_db_name:
        fail("backend/.env non contiene MONGO_URL e DB_NAME locali.")

    print("Migrazione dati Ferramenta -> MongoDB Atlas")
    print("La password non verra mostrata ne salvata.")
    password = getpass.getpass("Password Atlas di ferramenta_app: ")
    if not password:
        fail("Password vuota.")

    atlas_uri = (
        f"mongodb+srv://{ATLAS_USER}:{quote_plus(password)}@{ATLAS_HOST}/"
        "?retryWrites=true&w=majority&appName=Ferramenta"
    )

    source_client = MongoClient(local_uri, serverSelectionTimeoutMS=10_000)
    target_client = MongoClient(atlas_uri, serverSelectionTimeoutMS=20_000)

    try:
        source_client.admin.command("ping")
        target_client.admin.command("ping")
    except Exception as exc:
        fail(f"Connessione non riuscita: {exc}")

    source_db = source_client[local_db_name]
    target_db = target_client[TARGET_DB_NAME]
    all_source_collections = sorted(source_db.list_collection_names())
    source_collections = [
        name for name in all_source_collections if name not in EXCLUDED_COLLECTIONS
    ]
    target_collections = sorted(target_db.list_collection_names())

    if not all_source_collections:
        fail("Il database locale non contiene collezioni.")
    if not source_collections:
        fail("Non ci sono collezioni da copiare dopo le esclusioni.")
    if target_collections:
        fail(
            "Il database Atlas 'ferramenta' contiene gia dati: "
            + ", ".join(target_collections)
        )

    excluded_counts = {
        name: source_db[name].count_documents({})
        for name in sorted(EXCLUDED_COLLECTIONS.intersection(all_source_collections))
    }
    for collection_name, count in excluded_counts.items():
        print(f"Escludo {collection_name}: {count} documenti non verranno trasferiti.")

    expected_counts: dict[str, int] = {}
    for collection_name in source_collections:
        source_collection = source_db[collection_name]
        target_collection = target_db[collection_name]
        expected = source_collection.count_documents({})
        expected_counts[collection_name] = expected
        print(f"Copio {collection_name}: {expected} documenti...")

        batch = []
        for document in source_collection.find({}):
            batch.append(document)
            if len(batch) >= BATCH_SIZE:
                target_collection.insert_many(batch, ordered=True)
                batch = []
        if batch:
            target_collection.insert_many(batch, ordered=True)

        for index in source_collection.list_indexes():
            if index.get("name") == "_id_":
                continue
            keys = list(index["key"].items())
            options = {
                key: value
                for key, value in index.items()
                if key not in {"v", "key", "ns"}
            }
            target_collection.create_index(keys, **options)

    errors = []
    for collection_name, expected in expected_counts.items():
        actual = target_db[collection_name].count_documents({})
        print(f"Verifica {collection_name}: {actual}/{expected}")
        if actual != expected:
            errors.append(f"{collection_name}: {actual}/{expected}")

    if errors:
        fail("Conteggi non corrispondenti: " + ", ".join(errors))

    print("\nMIGRAZIONE COMPLETATA E VERIFICATA.")
    print(f"Collezioni copiate: {len(source_collections)}")
    print(f"Documenti copiati: {sum(expected_counts.values())}")
    print(f"Collezioni escluse: {', '.join(sorted(excluded_counts)) or 'nessuna'}")

    source_client.close()
    target_client.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nOperazione annullata.")
