import csv
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

from pymongo import MongoClient


MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "ferramenta"
PRODUCTS_COLLECTION_NAME = "products"
IMPORTS_COLLECTION_NAME = "invoice_imports"
REPORTS_DIR = "import_fatture/report"


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

    chiave_import = f"{partita_iva}|{numero}|{data}"

    return {
        "numero": numero,
        "data": data,
        "partita_iva": partita_iva,
        "denominazione": denominazione,
        "chiave_import": chiave_import,
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


def salva_non_trovati_csv(info_fattura, non_trovati):
    if not non_trovati:
        return ""

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
        ]

        writer = csv.DictWriter(f, fieldnames=campi)
        writer.writeheader()

        for item in non_trovati:
            writer.writerow({
                "linea": item.get("linea", ""),
                "barcode": item.get("barcode", ""),
                "codice_fornitore": item.get("codice_fornitore", ""),
                "descrizione": item.get("descrizione", ""),
                "quantita": item.get("quantita", ""),
                "prezzo_unitario": item.get("prezzo_unitario", ""),
            })

    return str(percorso_file)


def salva_report(file_xml, info_fattura, linee, aggiornati, non_trovati, saltati):
    report_dir = Path(REPORTS_DIR)
    report_dir.mkdir(parents=True, exist_ok=True)

    numero_pulito = info_fattura["numero"].replace("/", "_").replace(" ", "_")
    data_pulita = info_fattura["data"].replace("/", "_").replace(" ", "_")

    nome_report = f"report_{numero_pulito}_{data_pulita}.txt"
    percorso_report = report_dir / nome_report

    with open(percorso_report, "w", encoding="utf-8") as report:
        report.write("REPORT IMPORT FATTURA XML\n")
        report.write("=" * 60 + "\n\n")

        report.write(f"Fornitore: {info_fattura['denominazione']}\n")
        report.write(f"Partita IVA: {info_fattura['partita_iva']}\n")
        report.write(f"Numero fattura: {info_fattura['numero']}\n")
        report.write(f"Data fattura: {info_fattura['data']}\n")
        report.write(f"File XML: {file_xml}\n")
        report.write(f"Data import: {datetime.now().isoformat()}\n\n")

        report.write("RISULTATO\n")
        report.write("-" * 60 + "\n")
        report.write(f"Righe fattura lette: {len(linee)}\n")
        report.write(f"Prodotti aggiornati: {aggiornati}\n")
        report.write(f"Barcode non trovati: {len(non_trovati)}\n")
        report.write(f"Righe saltate: {len(saltati)}\n\n")

        if non_trovati:
            report.write("BARCODE NON TROVATI NEL CATALOGO\n")
            report.write("-" * 60 + "\n")
            for item in non_trovati:
                report.write(
                    f"Linea {item['linea']} | barcode {item['barcode']} | "
                    f"quantità {item['quantita']} | {item['descrizione']}\n"
                )
            report.write("\n")

        if saltati:
            report.write("RIGHE SALTATE\n")
            report.write("-" * 60 + "\n")
            for item in saltati:
                report.write(
                    f"Linea {item['linea']} | barcode {item['barcode']} | "
                    f"quantità {item['quantita']} | {item['descrizione']}\n"
                )
            report.write("\n")

    return str(percorso_report)


def importa_fattura_xml(percorso_xml):
    file_xml = Path(percorso_xml)

    if not file_xml.exists():
        print(f"ERRORE: file non trovato: {file_xml}")
        return

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    products = db[PRODUCTS_COLLECTION_NAME]
    invoice_imports = db[IMPORTS_COLLECTION_NAME]

    tree = ET.parse(file_xml)
    root = tree.getroot()

    info_fattura = dati_fattura(root)

    if not info_fattura["numero"] or not info_fattura["data"] or not info_fattura["partita_iva"]:
        print("ERRORE: impossibile leggere numero, data o partita IVA della fattura.")
        print("Import bloccato per sicurezza.")
        return

    gia_importata = invoice_imports.find_one({
        "chiave_import": info_fattura["chiave_import"]
    })

    if gia_importata:
        print("ERRORE: questa fattura risulta già importata.")
        print("")
        print(f"Fornitore: {gia_importata.get('denominazione', '')}")
        print(f"Partita IVA: {gia_importata.get('partita_iva', '')}")
        print(f"Numero fattura: {gia_importata.get('numero', '')}")
        print(f"Data fattura: {gia_importata.get('data', '')}")
        print(f"Importata il: {gia_importata.get('data_import', '')}")
        print("")
        print("Operazione annullata. Le quantità NON sono state modificate.")
        return

    print("FATTURA DA IMPORTARE")
    print(f"Fornitore: {info_fattura['denominazione']}")
    print(f"Partita IVA: {info_fattura['partita_iva']}")
    print(f"Numero fattura: {info_fattura['numero']}")
    print(f"Data fattura: {info_fattura['data']}")
    print("")

    linee = root.findall(".//DettaglioLinee")

    if not linee:
        print("ERRORE: nessuna riga prodotto trovata nel file XML.")
        return

    aggiornati = 0
    non_trovati = []
    saltati = []

    for dettaglio in linee:
        numero_linea = testo_figlio(dettaglio, "NumeroLinea")
        descrizione_fattura = testo_figlio(dettaglio, "Descrizione")
        quantita_arrivata = numero_intero(testo_figlio(dettaglio, "Quantita"))
        barcode = trova_ean(dettaglio)
        codice_fornitore = trova_codice_fornitore(dettaglio)

        if barcode == "": barcode = codice_fornitore

        if quantita_arrivata <= 0:
            saltati.append({
                "linea": numero_linea,
                "barcode": barcode,
                "quantita": quantita_arrivata,
                "descrizione": descrizione_fattura,
            })
            continue

        prodotto = products.find_one({
            "$or": [
                {"barcode": barcode},
                {"codice_prodotto": barcode},
                {"codice_prodotto": codice_fornitore},
            ]
        })

        if not prodotto:
            prezzo_acquisto = calcola_prezzo_acquisto_netto_da_riga(dettaglio)

            marca_ricavata = ricava_marca_da_descrizione(descrizione_fattura)
            categoria_ricavata = ricava_categoria_da_descrizione(descrizione_fattura)

            fornitore = info_fattura["denominazione"]

            crea_prodotto(
                products,
                descrizione=descrizione_fattura,
                barcode=barcode,
                codice_prodotto=codice_fornitore or barcode,
                marca=marca_ricavata,
                categoria=categoria_ricavata,
                fornitore=fornitore,
                quantita=0,
                prezzo_acquisto=prezzo_acquisto,
            )

            prodotto = products.find_one({
                "$or": [
                    {"barcode": barcode},
                    {"codice_prodotto": codice_fornitore},
                ]
            })

            if not prodotto:
                non_trovati.append({
                    "linea": numero_linea,
                    "barcode": barcode,
                    "codice_fornitore": codice_fornitore,
                    "quantita": quantita_arrivata,
                    "prezzo_unitario": testo_figlio(dettaglio, "PrezzoUnitario"),
                    "descrizione": descrizione_fattura,
                })
                continue

        quantita_attuale = numero_intero(prodotto.get("quantita", 0))
        nuova_quantita = quantita_attuale + quantita_arrivata

        products.update_one(
            {"_id": prodotto["_id"]},
            {
                "$set": {
                    "quantita": nuova_quantita,
                    "ultimo_carico_fattura": datetime.now().isoformat(),
                }
            }
        )

        aggiornati += 1

        descrizione_catalogo = prodotto.get("descrizione", "Senza descrizione")
        codice_prodotto = prodotto.get("codice_prodotto", "N/D")

        print(
            f"OK | linea {numero_linea} | barcode {barcode} | "
            f"codice {codice_prodotto} | {descrizione_catalogo} | "
            f"quantità {quantita_attuale} -> {nuova_quantita}"
        )
    
    percorso_non_trovati = salva_non_trovati_csv(info_fattura, non_trovati)

    percorso_report = salva_report(
        file_xml=file_xml,
        info_fattura=info_fattura,
        linee=linee,
        aggiornati=aggiornati,
        non_trovati=non_trovati,
        saltati=saltati,
    )

    invoice_imports.insert_one({
        "chiave_import": info_fattura["chiave_import"],
        "numero": info_fattura["numero"],
        "data": info_fattura["data"],
        "partita_iva": info_fattura["partita_iva"],
        "denominazione": info_fattura["denominazione"],
        "file": str(file_xml),
        "report": percorso_report,
        "file_non_trovati": percorso_non_trovati,
        "data_import": datetime.now().isoformat(),
        "righe_fattura": len(linee),
        "prodotti_aggiornati": aggiornati,
        "barcode_non_trovati": len(non_trovati),
        "righe_saltate": len(saltati),
    })

    print("")
    print("RISULTATO IMPORT XML")
    print(f"Righe fattura lette: {len(linee)}")
    print(f"Prodotti aggiornati: {aggiornati}")
    print(f"Barcode non trovati: {len(non_trovati)}")
    print(f"Righe saltate: {len(saltati)}")
    print(f"Report salvato in: {percorso_report}")
    if percorso_non_trovati:
        print(f"File non trovati salvato in: {percorso_non_trovati}")

    if non_trovati:
        print("")
        print("BARCODE NON TROVATI NEL CATALOGO:")
        for item in non_trovati:
            print(
                f"Linea {item['linea']} | barcode {item['barcode']} | "
                f"quantità {item['quantita']} | {item['descrizione']}"
            )

    if saltati:
        print("")
        print("RIGHE SALTATE:")
        for item in saltati:
            print(
                f"Linea {item['linea']} | barcode {item['barcode']} | "
                f"quantità {item['quantita']} | {item['descrizione']}"
            )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso corretto:")
        print("python3 scripts/importa_fattura_xml.py import_fatture/fattura.xml")
        sys.exit(1)

    importa_fattura_xml(sys.argv[1])
