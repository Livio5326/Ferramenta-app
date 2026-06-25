import csv
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from pymongo import MongoClient


MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "ferramenta"
PRODUCTS_COLLECTION_NAME = "products"
REPORTS_DIR = "import_fatture/report"


def pulisci(valore):
    if valore is None:
        return ""
    return str(valore).strip()


def testo_figlio(elemento, nome):
    trovato = elemento.find(nome)
    if trovato is None or trovato.text is None:
        return ""
    return pulisci(trovato.text)


def trova_testo_xml(root, percorso):
    trovato = root.find(percorso)
    if trovato is None or trovato.text is None:
        return ""
    return pulisci(trovato.text)


def dati_fattura(root):
    numero = trova_testo_xml(root, ".//DatiGeneraliDocumento/Numero")
    data = trova_testo_xml(root, ".//DatiGeneraliDocumento/Data")
    partita_iva = trova_testo_xml(
        root,
        ".//CedentePrestatore/DatiAnagrafici/IdFiscaleIVA/IdCodice"
    )
    denominazione = trova_testo_xml(
        root,
        ".//CedentePrestatore/DatiAnagrafici/Anagrafica/Denominazione"
    )

    return {
        "numero": numero,
        "data": data,
        "partita_iva": partita_iva,
        "denominazione": denominazione,
    }


def trova_ean(dettaglio_linea):
    for codice in dettaglio_linea.findall("CodiceArticolo"):
        tipo = testo_figlio(codice, "CodiceTipo").upper()
        valore = testo_figlio(codice, "CodiceValore")

        if tipo == "EAN" and valore:
            return valore

    return ""


def trova_codice_fornitore(dettaglio_linea):
    for codice in dettaglio_linea.findall("CodiceArticolo"):
        tipo = testo_figlio(codice, "CodiceTipo").upper()
        valore = testo_figlio(codice, "CodiceValore")

        if tipo != "EAN" and valore:
            return valore

    return ""


def genera_non_trovati(percorso_xml):
    file_xml = Path(percorso_xml)

    if not file_xml.exists():
        print(f"ERRORE: file non trovato: {file_xml}")
        return

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    products = db[PRODUCTS_COLLECTION_NAME]

    tree = ET.parse(file_xml)
    root = tree.getroot()

    info_fattura = dati_fattura(root)
    linee = root.findall(".//DettaglioLinee")

    if not linee:
        print("ERRORE: nessuna riga prodotto trovata nel file XML.")
        return

    non_trovati = []

    for dettaglio in linee:
        numero_linea = testo_figlio(dettaglio, "NumeroLinea")
        descrizione = testo_figlio(dettaglio, "Descrizione")
        quantita = testo_figlio(dettaglio, "Quantita")
        prezzo_unitario = testo_figlio(dettaglio, "PrezzoUnitario")
        barcode = trova_ean(dettaglio)
        codice_fornitore = trova_codice_fornitore(dettaglio)

        if not barcode:
            non_trovati.append({
                "linea": numero_linea,
                "barcode": "",
                "codice_fornitore": codice_fornitore,
                "descrizione": descrizione,
                "quantita": quantita,
                "prezzo_unitario": prezzo_unitario,
                "motivo": "EAN mancante",
            })
            continue

        prodotto = products.find_one({"barcode": barcode})

        if not prodotto:
            non_trovati.append({
                "linea": numero_linea,
                "barcode": barcode,
                "codice_fornitore": codice_fornitore,
                "descrizione": descrizione,
                "quantita": quantita,
                "prezzo_unitario": prezzo_unitario,
                "motivo": "barcode non presente nel catalogo",
            })

    report_dir = Path(REPORTS_DIR)
    report_dir.mkdir(parents=True, exist_ok=True)

    numero_pulito = info_fattura["numero"].replace("/", "_").replace(" ", "_")
    data_pulita = info_fattura["data"].replace("/", "_").replace(" ", "_")

    nome_file = f"non_trovati_{numero_pulito}_{data_pulita}.csv"
    percorso_file = report_dir / nome_file

    with open(percorso_file, "w", newline="", encoding="utf-8-sig") as f:
        campi = [
            "linea",
            "barcode",
            "codice_fornitore",
            "descrizione",
            "quantita",
            "prezzo_unitario",
            "motivo",
        ]

        writer = csv.DictWriter(f, fieldnames=campi)
        writer.writeheader()

        for item in non_trovati:
            writer.writerow(item)

    print("CONTROLLO COMPLETATO")
    print(f"Fornitore: {info_fattura['denominazione']}")
    print(f"Numero fattura: {info_fattura['numero']}")
    print(f"Data fattura: {info_fattura['data']}")
    print(f"Righe fattura lette: {len(linee)}")
    print(f"Prodotti non trovati: {len(non_trovati)}")
    print(f"File creato: {percorso_file}")

    if non_trovati:
        print("")
        print("PRODOTTI NON TROVATI:")
        for item in non_trovati:
            print(
                f"Linea {item['linea']} | barcode {item['barcode']} | "
                f"codice {item['codice_fornitore']} | quantità {item['quantita']} | "
                f"{item['descrizione']}"
            )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso corretto:")
        print("python3 scripts/genera_non_trovati_xml.py import_fatture/fattura.xml")
        sys.exit(1)

    genera_non_trovati(sys.argv[1])
