import csv
import sys
from datetime import datetime
from pathlib import Path

from pymongo import MongoClient


MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "ferramenta"
PRODUCTS_COLLECTION_NAME = "products"


MARCA = "STANLEY"
MARCA_STANDARD = "Stanley"
FORNITORE = "Stanley Black & Decker"
CATEGORIA_DEFAULT = "Altro"


def pulisci(valore):
    if valore is None:
        return ""
    return str(valore).strip()


def numero_intero(valore):
    valore = pulisci(valore).replace(",", ".")
    if valore == "":
        return 0

    try:
        return int(float(valore))
    except ValueError:
        return 0


def numero_decimale(valore):
    valore = pulisci(valore).replace(",", ".")
    if valore == "":
        return 0.0

    try:
        return float(valore)
    except ValueError:
        return 0.0


def crea_prodotti(percorso_csv):
    file_csv = Path(percorso_csv)

    if not file_csv.exists():
        print(f"ERRORE: file non trovato: {file_csv}")
        return

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    products = db[PRODUCTS_COLLECTION_NAME]

    creati = 0
    gia_presenti = 0
    saltati = []

    with open(file_csv, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        if not reader.fieldnames:
            print("ERRORE: CSV vuoto o intestazione mancante.")
            return

        for numero_riga, riga in enumerate(reader, start=2):
            barcode = pulisci(riga.get("barcode"))
            codice_fornitore = pulisci(riga.get("codice_fornitore"))
            descrizione = pulisci(riga.get("descrizione"))
            quantita = numero_intero(riga.get("quantita"))
            prezzo_acquisto = numero_decimale(riga.get("prezzo_unitario"))

            if barcode == "" or descrizione == "" or quantita <= 0:
                saltati.append({
                    "riga": numero_riga,
                    "barcode": barcode,
                    "descrizione": descrizione,
                    "quantita": quantita,
                    "motivo": "barcode, descrizione o quantità non validi",
                })
                continue

            esistente = products.find_one({"barcode": barcode})

            if esistente:
                gia_presenti += 1
                print(
                    f"GIÀ PRESENTE | riga {numero_riga} | barcode {barcode} | "
                    f"{esistente.get('descrizione', '')}"
                )
                continue

            nuovo_prodotto = {
                "barcode": barcode,
                "codice_prodotto": codice_fornitore or barcode,
                "descrizione": descrizione,
                "marca": MARCA,
                "marca_standard": MARCA_STANDARD,
                "categoria": CATEGORIA_DEFAULT,
                "quantita": quantita,
                "prezzo_acquisto": prezzo_acquisto,
                "prezzo_vendita": 0,
                "fornitore": FORNITORE,
                "foto": "",
                "note": "Creato da fattura XML - verificare prezzo vendita e categoria",
                "creato_da_fattura": True,
                "data_creazione": datetime.now().isoformat(),
                "ultimo_carico_fattura": datetime.now().isoformat(),
            }

            products.insert_one(nuovo_prodotto)
            creati += 1

            print(
                f"CREATO | riga {numero_riga} | barcode {barcode} | "
                f"codice {codice_fornitore or barcode} | quantità {quantita} | "
                f"prezzo acquisto {prezzo_acquisto} | {descrizione}"
            )

    print("")
    print("RISULTATO CREAZIONE PRODOTTI")
    print(f"Prodotti creati: {creati}")
    print(f"Già presenti: {gia_presenti}")
    print(f"Righe saltate: {len(saltati)}")

    if saltati:
        print("")
        print("RIGHE SALTATE:")
        for item in saltati:
            print(
                f"Riga {item['riga']} | barcode {item['barcode']} | "
                f"quantità {item['quantita']} | {item['motivo']} | "
                f"{item['descrizione']}"
            )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso corretto:")
        print("python3 scripts/crea_prodotti_da_non_trovati.py import_fatture/report/non_trovati_NUMERO_DATA.csv")
        sys.exit(1)

    crea_prodotti(sys.argv[1])
