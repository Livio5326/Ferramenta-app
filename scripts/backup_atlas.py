"""Backup completo del database Ferramenta su MongoDB Atlas -> file JSON locali.

Esporta ogni collezione in backups/atlas/<timestamp>/<collezione>.json
usando bson.json_util (serializza correttamente ObjectId e date).

Uso MANUALE (interattivo, chiede la password Atlas, non la salva):
    python scripts/backup_atlas.py

Uso AUTOMATICO (Utilita di pianificazione Windows / cron, non interattivo):
    imposta una delle due variabili d'ambiente e lancia lo script:
      - MONGO_URL       = stringa di connessione Atlas completa, oppure
      - ATLAS_PASSWORD  = solo la password dell'utente ferramenta_app

Rotazione: mantiene gli ultimi KEEP_LAST backup, elimina i piu vecchi.

Ripristino di una collezione (esempio):
    mongoimport --uri "<MONGO_URL>" --collection products \
        --file backups/atlas/<timestamp>/products.json --jsonArray
"""

from __future__ import annotations

import getpass
import os
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus

from bson import json_util
from pymongo import MongoClient

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKUP_ROOT = REPO_ROOT / "backups" / "atlas"

ATLAS_HOST = "ferramenta.b5ihzw6.mongodb.net"
ATLAS_USER = "ferramenta_app"
TARGET_DB_NAME = "ferramenta"

KEEP_LAST = 30  # quanti backup conservare


def fail(message: str) -> None:
    print(f"\nERRORE: {message}")
    raise SystemExit(1)


def build_uri() -> str:
    """Priorita: MONGO_URL completa > ATLAS_PASSWORD (env) > getpass interattivo."""
    mongo_url = os.environ.get("MONGO_URL", "").strip()
    if mongo_url and not mongo_url.startswith("mongodb://localhost"):
        return mongo_url

    password = os.environ.get("ATLAS_PASSWORD", "").strip()
    if not password:
        if not sys.stdin or not sys.stdin.isatty():
            fail(
                "Nessuna credenziale. In modalita automatica imposta MONGO_URL "
                "oppure ATLAS_PASSWORD nell'ambiente."
            )
        password = getpass.getpass("Password Atlas di ferramenta_app: ").strip()
    if not password:
        fail("Password vuota.")

    return (
        f"mongodb+srv://{ATLAS_USER}:{quote_plus(password)}@{ATLAS_HOST}/"
        "?retryWrites=true&w=majority&appName=Ferramenta"
    )


def rotate(keep_last: int) -> None:
    if not BACKUP_ROOT.exists():
        return
    backups = sorted(
        (p for p in BACKUP_ROOT.iterdir() if p.is_dir()),
        key=lambda p: p.name,
    )
    for old in backups[:-keep_last] if keep_last > 0 else []:
        for f in old.glob("*.json"):
            f.unlink()
        old.rmdir()
        print(f"Rimosso backup vecchio: {old.name}")


def main() -> None:
    uri = build_uri()

    client = MongoClient(uri, serverSelectionTimeoutMS=20_000)
    try:
        client.admin.command("ping")
    except Exception as exc:
        fail(f"Connessione ad Atlas non riuscita: {exc}")

    db = client[TARGET_DB_NAME]
    collections = sorted(db.list_collection_names())
    if not collections:
        fail(f"Il database '{TARGET_DB_NAME}' non contiene collezioni.")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = BACKUP_ROOT / timestamp
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Backup Ferramenta Atlas -> {out_dir}")
    total_docs = 0
    for name in collections:
        docs = list(db[name].find({}))
        total_docs += len(docs)
        out_file = out_dir / f"{name}.json"
        out_file.write_text(
            json_util.dumps(docs, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"  {name}: {len(docs)} documenti")

    print(f"\nBACKUP COMPLETATO: {len(collections)} collezioni, {total_docs} documenti.")
    client.close()

    rotate(KEEP_LAST)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nOperazione annullata.")
