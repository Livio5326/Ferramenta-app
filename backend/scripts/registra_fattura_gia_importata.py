import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

from pymongo import MongoClient


MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "ferramenta"
IMPORTS_COLLECTION_NAME = "invoice_imports"


def pulisci(valore):
    if valore is None:
        return ""
    return str(valore).strip()


def trova_testo_xml(root, percorso):
    trovato = root.find(percorso)
    if trovato is None or trovato.text is None:
        return ""
    return pulisci(trovato.text)


def main(percorso_xml):
    file_xml = Path(percorso_xml)

    if not file_xml.exists():
        print(f"ERRORE: file non trovato: {file_xml}")
        return

    tree = ET.parse(file_xml)
    root = tree.getroot()

    numero = trova_testo_xml(root, ".//DatiGeneraliDocumento/Numero")
    data = trova_testo_xml(root, ".//DatiGeneraliDocumento/Data")
    partita_iva = trova_testo_xml(root, ".//CedentePrestatore/DatiAnagrafici/IdFiscaleIVA/IdCodice")
    denominazione = trova_testo_xml(root, ".//CedentePrestatore/DatiAnagrafici/Anagrafica/Denominazione")

    if not numero or not data or not partita_iva:
        print("ERRORE: impossibile leggere numero, data o partita IVA della fattura.")
        return

    chiave_import = f"{partita_iva}|{numero}|{data}"

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    invoice_imports = db[IMPORTS_COLLECTION_NAME]

    gia_importata = invoice_imports.find_one({"chiave_import": chiave_import})

    if gia_importata:
        print("Questa fattura è già registrata nello storico.")
        print("Nessuna modifica fatta.")
        return

    linee = root.findall(".//DettaglioLinee")

    invoice_imports.insert_one({
        "chiave_import": chiave_import,
        "numero": numero,
        "data": data,
        "partita_iva": partita_iva,
        "denominazione": denominazione,
        "file": str(file_xml),
        "data_import": datetime.now().isoformat(),
        "registrata_manualmente": True,
        "nota": "Fattura già importata prima dell'introduzione del blocco anti-doppio import",
        "righe_fattura": len(linee),
    })

    print("Fattura registrata come già importata.")
    print(f"Fornitore: {denominazione}")
    print(f"Partita IVA: {partita_iva}")
    print(f"Numero: {numero}")
    print(f"Data: {data}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso corretto:")
        print("python3 scripts/registra_fattura_gia_importata.py import_fatture/fattura.xml")
        sys.exit(1)

    main(sys.argv[1])

