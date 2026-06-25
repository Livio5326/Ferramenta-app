import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

from pymongo import MongoClient


MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "ferramenta"
COLLECTION_NAME = "products"


def pulisci(valore):
    if valore is None:
        return ""
    return str(valore).strip()


def numero(valore):
    valore = pulisci(valore).replace(",", ".")
    if valore == "":
        return 0

    try:
        return float(valore)
    except ValueError:
        return 0


def testo_figlio(elemento, nome):
    trovato = elemento.find(nome)
    if trovato is None or trovato.text is None:
        return ""
    return pulisci(trovato.text)


def trova_codici_articolo(dettaglio_linea):
    codici = []

    for codice in dettaglio_linea.findall("CodiceArticolo"):
        tipo = testo_figlio(codice, "CodiceTipo").upper()
        valore = testo_figlio(codice, "CodiceValore")

        if valore:
            codici.append({
                "tipo": tipo,
                "valore": valore
            })

    return codici


def scegli_barcode_o_codice(codici):
    tipi_barcode = ["EAN", "BARCODE", "GTIN", "CODICEBARRE", "CODICE_BARRE"]

    for codice in codici:
        if codice["tipo"] in tipi_barcode:
            return codice["valore"], "barcode"

    if codici:
        return codici[0]["valore"], "codice_prodotto"

    return "", ""


def importa_fattura_xml(percorso_xml):
    file_xml = Path(percorso_xml)

    if not file_xml.exists():
        print(f"ERRORE: file non trovato: {file_xml}")
        return

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    products = db[COLLECTION_NAME]

    tree = ET.parse(file_xml)
    root = tree.getroot()

    aggiornati = 0
    non_trovati = []
    saltati = []

    linee = root.findall(".//DettaglioLinee")

    if not linee:
        print("ERRORE: nessuna riga prodotto trovata nel file XML.")
        return

    for dettaglio in linee:
        numero_linea = testo_figlio(dettaglio, "NumeroLinea")
        descrizione = testo_figlio(dettaglio, "Descrizione")
        quantita_arrivata = numero(testo_figlio(dettaglio, "Quantita"))

        codici = trova_codici_articolo(dettaglio)
        valore_codice, tipo_ricerca = scegli_barcode_o_codice(codici)

        if valore_codice == "" or quantita_arrivata <= 0:
            saltati.append({
                "linea": numero_linea,
                "descrizione": descrizione,
                "codice": valore_codice,
                "quantita": quantita_arrivata
            })
            continue

        if tipo_ricerca == "barcode":
            prodotto = products.find_one({"barcode": valore_codice})
        else:
            prodotto = products.find_one({"codice_prodotto": valore_codice})

        if not prodotto:
            non_trovati.append({
                "linea": numero_linea,
                "descrizione": descrizione,
                "codice": valore_codice,
                "tipo": tipo_ricerca,
                "quantita": quantita_arrivata
            })
            continue

        quantita_attuale = int(prodotto.get("quantita", 0) or 0)
        nuova_quantita = quantita_attuale + int(quantita_arrivata)

        products.update_one(
            {"_id": prodotto["_id"]},
            {
                "$set": {
                    "quantita": nuova_quantita,
                    "ultimo_carico_fattura": datetime.now().isoformat()
                }
            }
        )

        aggiornati += 1

        print(
            f"OK | {tipo_ricerca}: {valore_codice} | "
            f"{prodotto.get('descrizione', 'Senza descrizione')} | "
            f"{quantita_attuale} -> {nuova_quantita}"
        )

    print("")
    print("RISULTATO IMPORT XML")
    print(f"Prodotti aggiornati: {aggiornati}")
    print(f"Prodotti non trovati: {len(non_trovati)}")
    print(f"Righe saltate: {len(saltati)}")

    if non_trovati:
        print("")
        print("PRODOTTI NON TROVATI:")
        for item in non_trovati:
            print(
                f"Linea {item['linea']} | {item['tipo']} {item['codice']} | "
                f"Quantità {item['quantita']} | {item['descrizione']}"
            )

    if saltati:
        print("")
        print("RIGHE SALTATE:")
        for item in saltati:
            print(
                f"Linea {item['linea']} | codice {item['codice']} | "
                f"Quantità {item['quantita']} | {item['descrizione']}"
            )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso corretto:")
        print("python3 scripts/importa_fattura_xml.py import_fatture/fattura.xml")
        sys.exit(1)

    importa_fattura_xml(sys.argv[1])

