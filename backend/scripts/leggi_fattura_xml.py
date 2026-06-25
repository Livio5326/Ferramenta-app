import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def pulisci(valore):
    if valore is None:
        return ""
    return str(valore).strip()


def trova_testo(elemento, nome):
    trovato = elemento.find(nome)
    if trovato is None or trovato.text is None:
        return ""
    return pulisci(trovato.text)


def leggi_fattura_xml(percorso_xml):
    file_xml = Path(percorso_xml)

    if not file_xml.exists():
        print(f"ERRORE: file non trovato: {file_xml}")
        return

    tree = ET.parse(file_xml)
    root = tree.getroot()

    linee = root.findall(".//DettaglioLinee")

    print(f"Righe prodotto trovate: {len(linee)}")
    print("")

    if not linee:
        print("Nessuna riga prodotto trovata.")
        return

    for dettaglio in linee:
        numero_linea = trova_testo(dettaglio, "NumeroLinea")
        descrizione = trova_testo(dettaglio, "Descrizione")
        quantita = trova_testo(dettaglio, "Quantita")
        prezzo_unitario = trova_testo(dettaglio, "PrezzoUnitario")
        prezzo_totale = trova_testo(dettaglio, "PrezzoTotale")

        print("=" * 60)
        print(f"Linea: {numero_linea}")
        print(f"Descrizione: {descrizione}")
        print(f"Quantità: {quantita}")
        print(f"Prezzo unitario: {prezzo_unitario}")
        print(f"Prezzo totale: {prezzo_totale}")

        codici = dettaglio.findall("CodiceArticolo")

        if not codici:
            print("Codici articolo: NESSUNO")
        else:
            print("Codici articolo:")
            for codice in codici:
                tipo = trova_testo(codice, "CodiceTipo")
                valore = trova_testo(codice, "CodiceValore")
                print(f"  - Tipo: {tipo} | Valore: {valore}")

    print("")
    print("CONTROLLO COMPLETATO. Nessun dato è stato modificato.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso corretto:")
        print("python3 scripts/leggi_fattura_xml.py import_fatture/fattura.xml")
        sys.exit(1)

    leggi_fattura_xml(sys.argv[1])
