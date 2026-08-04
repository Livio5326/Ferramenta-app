import csv
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from product_creator import ( crea_prodotto_da_fattura, ricava_marca_da_descrizione, ricava_categoria_da_descrizione )
from pricing import DEFAULT_MARKUPS, calculate_sale_price

REPORTS_DIR = "import_fatture/report"


def normalizza_nome_fornitore(value: str | None) -> str:
    value = str(value or "").upper().strip()

    # Toglie forme societarie e parole inutili.
    parole_da_togliere = [
        "S.R.L.", "SRL", "S.R.L", "S.R.L.S.", "SRLS",
        "S.P.A.", "SPA", "SNC", "S.N.C.", "SAS", "S.A.S.",
        "ITALIA", "NICOLA", "DI", "DEL", "DELLA", "D'", "F.LLI",
        "FRATELLI", "AZIENDA", "COMMERCIALE",
    ]

    for parola in parole_da_togliere:
        value = value.replace(parola, " ")

    value = re.sub(r"[^A-Z0-9]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()

    return value


async def riconduci_fornitore_standard(db, fornitore_xml: str | None) -> str:
    """
    Riconduce il fornitore letto dalla fattura XML a uno dei fornitori standard
    usando parole chiave precise.

    Esempi:
    - DE SANTIS NICOLA S.R.L. -> De Santis
    - SAIT ABRASIVI S.P.A. -> Sait abrasivi
    - STANLEY BLACK + DECKER ITALIA S.R.L. -> Stanley Black+Decker
    """
    fornitore_xml = str(fornitore_xml or "").strip()
    if not fornitore_xml:
        return ""

    xml_norm = normalizza_nome_fornitore(fornitore_xml)

    # Mappa precisa: se nel nome importato compare una parola/frase chiave,
    # assegna direttamente il fornitore standard scelto da noi.
    keyword_map = [
        ("DE SANTIS", "De Santis"),
        ("SANTIS", "De Santis"),

        ("SAIT", "Sait abrasivi"),
        ("SITE", "Sait abrasivi"),  # tolleranza se viene scritto/letto male

        ("STANLEY", "Stanley Black+Decker"),
        ("BLACK DECKER", "Stanley Black+Decker"),
        ("BLACK AND DECKER", "Stanley Black+Decker"),

        ("CAPALDO", "Capaldo"),
        ("DEODATO", "Deodato"),
        ("DFL", "DFL"),
        ("DUEMME", "Duemme"),
        ("Garsport".upper(), "Garsport"),
        ("ITALIANCOLOR", "Italiancolor"),
        ("LIANTONIO", "Liantonio Vernici"),
        ("MADRAs".upper(), "Madras"),
        ("PASQUALE ROMITO", "Pasquale Romito Cataldo"),
        ("ROMITO", "Pasquale Romito Cataldo"),
        ("PROCHIMICA", "Prochimica"),
        ("SARATOGA", "Saratoga"),
        ("TASSANI", "Tassani"),
        ("TECFI", "Tecfi"),
        ("VIGLIETTA", "Viglietta"),
        ("VIRIDEX", "Viridex"),

        ("C C", "C&C"),
        ("C&C", "C&C"),

        ("FRATELLI VITALE", "Fratelli Vitale"),
        ("VITALE", "Fratelli Vitale"),
    ]

    for keyword, standard in keyword_map:
        keyword_norm = normalizza_nome_fornitore(keyword)

        if keyword_norm and keyword_norm in xml_norm:
            return standard

    # Fallback più prudente:
    # controlla se uno dei fornitori standard è contenuto nel nome importato.
    # Lo facciamo dopo le parole chiave, non prima.
    doc = await db.standard_lists.find_one({"tipo": "fornitori"})
    standard_items = doc.get("items") if doc else []
    standard_items = standard_items or []

    for standard in standard_items:
        standard = str(standard or "").strip()
        if not standard:
            continue

        standard_norm = normalizza_nome_fornitore(standard)
        if standard_norm and standard_norm in xml_norm:
            return standard

    # Se non riconosce nulla, usa il nome originale.
    # Così un fornitore nuovo non viene perso.
    return fornitore_xml



def xml_float(value, default=0.0):
    if value is None:
        return default

    try:
        return float(str(value).replace(",", ".").strip())
    except Exception:
        return default


def get_xml_text(parent, tag_name, default=""):
    if parent is None:
        return default

    found = parent.find(f".//{{*}}{tag_name}")
    if found is None or found.text is None:
        return default

    return found.text.strip()




def is_riga_informativa_fattura(descrizione: str | None):
    testo = str(descrizione or "").upper().strip()

    parole = [
        "RIF. ORDINE",
        "RIF ORDINE",
        "RIFERIMENTO ORDINE",
        "ORDINE CL",
        "ORDINE CLIENTE",
        "VS ORDINE",
        "VOSTRO ORDINE",
        "NS ORDINE",
        "NOSTRO ORDINE",
        "DDT",
        "DOCUMENTO DI TRASPORTO",
    ]

    return any(p in testo for p in parole)


def is_riga_da_escludere_dai_prodotti_non_trovati(riga: dict):
    descrizione = str(riga.get("descrizione") or "").strip()
    codice = str(riga.get("codice_prodotto") or riga.get("codice") or "").strip()
    codice_fornitore = str(riga.get("codice_fornitore") or "").strip()
    barcode = str(riga.get("barcode") or "").strip()

    try:
        quantita = float(str(riga.get("quantita") or 0).replace(",", "."))
    except Exception:
        quantita = 0

    try:
        prezzo_unitario = float(str(
            riga.get("prezzo_unitario")
            or riga.get("prezzo_acquisto")
            or 0
        ).replace(",", "."))
    except Exception:
        prezzo_unitario = 0

    try:
        prezzo_totale = float(str(
            riga.get("prezzo_totale")
            or riga.get("totale")
            or 0
        ).replace(",", "."))
    except Exception:
        prezzo_totale = 0

    # Se non c'è totale ma c'è unitario, usa quello.
    if prezzo_totale <= 0 and prezzo_unitario > 0:
        prezzo_totale = prezzo_unitario * (quantita or 1)

    if is_riga_informativa_fattura(descrizione):
        return {
            "escludi": True,
            "tipo": "Riga informativa",
            "descrizione": descrizione,
            "importo": 0,
        }

    tipo_costo = classifica_costo_secondario_fornitore_intelligente(
        descrizione=descrizione,
        codice=codice,
        codice_fornitore=codice_fornitore,
        barcode=barcode,
        quantita=quantita,
        prezzo_totale=prezzo_totale,
    )

    if tipo_costo:
        return {
            "escludi": True,
            "tipo": tipo_costo,
            "descrizione": descrizione,
            "importo": round(prezzo_totale, 2),
        }

    return {
        "escludi": False,
    }


def classifica_costo_secondario_fornitore_intelligente(
    descrizione: str | None,
    codice: str | None = "",
    codice_fornitore: str | None = "",
    barcode: str | None = "",
    quantita: float | int | None = None,
    prezzo_totale: float | int | None = None,
):
    testo = str(descrizione or "").upper().strip()
    codice = str(codice or "").strip()
    codice_fornitore = str(codice_fornitore or "").strip()
    barcode = str(barcode or "").strip()

    try:
        quantita_num = float(str(quantita or 0).replace(",", "."))
    except Exception:
        quantita_num = 0

    try:
        prezzo_totale_num = float(str(prezzo_totale or 0).replace(",", "."))
    except Exception:
        prezzo_totale_num = 0

    if not testo or prezzo_totale_num <= 0:
        return None

    parole_costi = {
        "Spedizione": [
            "TRASPORTO",
            "SPEDIZIONE",
            "SPESE TRASPORTO",
            "SPESE DI TRASPORTO",
            "PORTO",
            "CONSEGNA",
            "CORRIERE",
        ],
        "Imballaggio": [
            "IMBALLO",
            "IMBALLAGGIO",
            "CONTRIBUTO IMBALLO",
            "CONFEZIONAMENTO",
            "PACKAGING",
        ],
        "Incasso / gestione": [
            "INCASSO",
            "CONTRASSEGNO",
            "SPESE BANCARIE",
            "COMMISSIONI",
            "GESTIONE ORDINE",
            "SPESE GESTIONE",
        ],
        "Bollo": [
            "BOLLO",
            "IMPOSTA DI BOLLO",
        ],
        "Altro costo secondario": [
            "SPESE",
            "ADDEBITO",
            "CONTRIBUTO",
        ],
    }

    tipo_trovato = None

    for tipo, parole in parole_costi.items():
        if any(parola in testo for parola in parole):
            tipo_trovato = tipo
            break

    if not tipo_trovato:
        return None

    parole_prodotto = [
        "NASTRO",
        "SCATOLA",
        "CARTONE",
        "CARRELLO",
        "BORSA",
        "VALIGIA",
        "CONTENITORE",
        "CINGHIA",
        "FASCIA",
        "PELLICOLA",
        "ROTOLO",
        "DISCO",
        "LAMA",
        "PUNTA",
        "TRAPANO",
        "AVVITATORE",
        "SEGHETTO",
        "UTENSILE",
        "GUANTI",
        "VERNICE",
        "SILICONE",
        "COLLA",
    ]

    if any(parola in testo for parola in parole_prodotto):
        return None

    punteggio = 0

    punteggio += 2

    if not barcode:
        punteggio += 2

    if not codice and not codice_fornitore:
        punteggio += 2

    if quantita_num in [0, 1]:
        punteggio += 1

    if len(testo.split()) <= 4:
        punteggio += 1

    if barcode or codice or codice_fornitore:
        punteggio -= 3

    if punteggio >= 5:
        return tipo_trovato

    return None


def classifica_costo_secondario_fornitore(descrizione: str | None):
    # Compatibilità con eventuale codice vecchio.
    # La versione vera da usare è classifica_costo_secondario_fornitore_intelligente.
    return classifica_costo_secondario_fornitore_intelligente(descrizione)


def calcola_prezzo_acquisto_netto_da_riga(dettaglio_linea):
    """
    Calcola il prezzo unitario netto da una riga XML fattura.

    Priorità:
    1. PrezzoTotale / Quantita, perché PrezzoTotale è già al netto degli sconti.
    2. PrezzoUnitario applicando eventuali ScontoMaggiorazione.
    """

    quantita = xml_float(get_xml_text(dettaglio_linea, "Quantita"), 1.0)
    prezzo_unitario = xml_float(get_xml_text(dettaglio_linea, "PrezzoUnitario"), 0.0)
    prezzo_totale = xml_float(get_xml_text(dettaglio_linea, "PrezzoTotale"), 0.0)

    if quantita > 0 and prezzo_totale > 0:
        return round(prezzo_totale / quantita, 4)

    prezzo = prezzo_unitario

    for sconto in dettaglio_linea.findall(".//{*}ScontoMaggiorazione"):
        tipo = get_xml_text(sconto, "Tipo").upper()
        percentuale = xml_float(get_xml_text(sconto, "Percentuale"), 0.0)
        importo = xml_float(get_xml_text(sconto, "Importo"), 0.0)

        if tipo == "SC":
            if percentuale:
                prezzo = prezzo * (1 - percentuale / 100)
            elif importo:
                prezzo = prezzo - importo

        elif tipo == "MG":
            if percentuale:
                prezzo = prezzo * (1 + percentuale / 100)
            elif importo:
                prezzo = prezzo + importo

    if prezzo < 0:
        prezzo = 0

    return round(prezzo, 4)


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


async def importa_fattura_xml_da_file(db, percorso_xml):
    file_xml = Path(percorso_xml)

    if not file_xml.exists():
        return {
            "ok": False,
            "errore": f"File non trovato: {file_xml}"
        }

    tree = ET.parse(file_xml)
    root = tree.getroot()

    info_fattura = dati_fattura(root)


    if not info_fattura["numero"] or not info_fattura["data"] or not info_fattura["partita_iva"]:
        return {
            "ok": False,
            "errore": "Impossibile leggere numero, data o partita IVA della fattura"
        }

    gia_importata = await db.invoice_imports.find_one({
        "chiave_import": info_fattura["chiave_import"]
    })

    if gia_importata:
        return {
            "ok": False,
            "gia_importata": True,
            "errore": "Questa fattura risulta già importata",
            "fornitore": gia_importata.get("denominazione", ""),
            "partita_iva": gia_importata.get("partita_iva", ""),
            "numero": gia_importata.get("numero", ""),
            "data": gia_importata.get("data", ""),
            "data_import": gia_importata.get("data_import", ""),
        }

    linee = root.findall(".//DettaglioLinee")

    if not linee:
        return {
            "ok": False,
            "errore": "Nessuna riga prodotto trovata nel file XML"
        }

    aggiornati = 0
    non_trovati = []
    saltati = []
    pricing_doc = await db.app_settings.find_one({"key": "pricing_markups"})
    pricing_markups = {
        **DEFAULT_MARKUPS,
        **((pricing_doc or {}).get("value") or {}),
    }

    for dettaglio in linee:
        numero_linea = testo_figlio(dettaglio, "NumeroLinea")
        descrizione_fattura = testo_figlio(dettaglio, "Descrizione")
        quantita_arrivata = numero_intero(testo_figlio(dettaglio, "Quantita"))
        barcode = trova_ean(dettaglio)

        if not descrizione_fattura:
            saltati.append({
            "linea": numero_linea,
            "barcode": barcode,
            "quantita": quantita_arrivata,
            "descrizione": descrizione_fattura,
            })
            continue

        codice_fornitore = trova_codice_fornitore(dettaglio)
        prezzo_acquisto = calcola_prezzo_acquisto_netto_da_riga(dettaglio)

        if barcode == "":
            barcode = codice_fornitore


        if quantita_arrivata <= 0:
            saltati.append({
            "linea": numero_linea,
            "barcode": barcode,
            "quantita": quantita_arrivata,
            "descrizione": descrizione_fattura,
            })
            continue

        condizioni = [
            {"barcode": barcode},
        ]

        try:
            condizioni.append({"barcode": int(barcode)})
        except Exception:
            pass

        prodotto = await db.products.find_one({"$or": condizioni})

        if not prodotto:
            codice_fornitore = trova_codice_fornitore(dettaglio)
            categoria_ricavata = ricava_categoria_da_descrizione(descrizione_fattura)

            fornitore_originale = info_fattura.get("denominazione", "")
            fornitore = await riconduci_fornitore_standard(db, fornitore_originale) or fornitore_originale

            # Se la descrizione non permette di riconoscere una marca vera
            # (es. linee di vernici, prodotti generici), usiamo il nome del
            # fornitore gia' ricondotto: meglio "Tassani" che "ALTRO".
            marca_ricavata = ricava_marca_da_descrizione(descrizione_fattura) or fornitore

            try:
                await crea_prodotto_da_fattura(
                    db,
                    descrizione=descrizione_fattura,
                    barcode=barcode,
                    codice_prodotto=codice_fornitore or barcode,
                    marca=marca_ricavata,
                    marca_standard=marca_ricavata,
                    categoria=categoria_ricavata,
                    fornitore=fornitore,
                    fornitore_originale=fornitore_originale,
                    quantita=0,
                    prezzo_acquisto=prezzo_acquisto,
                )

                prodotto = await db.products.find_one({
                    "$or": [
                        {"barcode": barcode},
                        {"codice_prodotto": codice_fornitore},
                        {"codice_prodotto": barcode},
                    ]
                })

            except Exception as e:
                print("ERRORE CREAZIONE PRODOTTO:", e, flush=True)
                non_trovati.append({
                    "linea": numero_linea,
                    "barcode": barcode,
                    "codice_fornitore": codice_fornitore,
                    "quantita": quantita_arrivata,
                    "prezzo_unitario_lordo": testo_figlio(dettaglio, "PrezzoUnitario"),
                    "prezzo_unitario": prezzo_acquisto,
                    "descrizione": descrizione_fattura,
                    "errore": str(e),
                })
                continue

        quantita_attuale = numero_intero(prodotto.get("quantita", 0))
        nuova_quantita = quantita_attuale + quantita_arrivata

        await db.products.update_one(
            {"_id": prodotto["_id"]},
            {
                "$set": {
                    "quantita": nuova_quantita,
                    "prezzo_acquisto": prezzo_acquisto,
                    "prezzo_vendita": calculate_sale_price(
                        prezzo_acquisto, pricing_markups
                    ),
                    "ultimo_carico_fattura": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                }
            }
        )

        aggiornati += 1

    percorso_non_trovati = salva_non_trovati_csv(info_fattura, non_trovati)

    percorso_report = salva_report(
        file_xml=file_xml,
        info_fattura=info_fattura,
        linee=linee,
        aggiornati=aggiornati,
        non_trovati=non_trovati,
        saltati=saltati,
    )

    # Salva i prodotti non trovati nel database come prodotti da confermare
    await db.pending_invoice_products.delete_many({
        "chiave_import": info_fattura["chiave_import"]
    })

    if non_trovati:
        pending_items = []

        for item in non_trovati:
            pending_items.append({
            "chiave_import": info_fattura["chiave_import"],
            "numero_fattura": info_fattura["numero"],
            "data_fattura": info_fattura["data"],
            "fornitore": info_fattura["denominazione"],
            "partita_iva": info_fattura["partita_iva"],
            "linea": item.get("linea", ""),
            "barcode": item.get("barcode", ""),
            "codice_fornitore": item.get("codice_fornitore", ""),
            "descrizione": item.get("descrizione", ""),
            "quantita": item.get("quantita", 0),
            "prezzo_unitario": item.get("prezzo_unitario", ""),
            "stato": "da_salvare",
            "selected": True,
            "created_at": datetime.now().isoformat(),
        })

        await db.pending_invoice_products.insert_many(pending_items)

    
    # Separa le righe prodotto dai costi accessori.
    # Esempio: spedizione, imballaggio, bollo, spese incasso.
    righe_fattura_originali = len(linee)
    costi_secondari_fornitori = []
    linee_prodotti = []

    for riga in linee:
        descrizione_riga = str(riga.get("descrizione") or "").strip()
        codice_riga = str(
            riga.get("codice_prodotto")
            or riga.get("codice")
            or ""
        ).strip()
        codice_fornitore_riga = str(riga.get("codice_fornitore") or "").strip()
        barcode_riga = str(riga.get("barcode") or "").strip()

        try:
            quantita_riga = float(str(riga.get("quantita") or 0).replace(",", "."))
        except Exception:
            quantita_riga = 0

        try:
            prezzo_unitario_riga = float(str(riga.get("prezzo_unitario") or 0).replace(",", "."))
        except Exception:
            prezzo_unitario_riga = 0

        importo_riga = round(prezzo_unitario_riga * (quantita_riga or 1), 2)

        tipo_costo = classifica_costo_secondario_fornitore_intelligente(
            descrizione=descrizione_riga,
            codice=codice_riga,
            codice_fornitore=codice_fornitore_riga,
            barcode=barcode_riga,
            quantita=quantita_riga,
            prezzo_totale=importo_riga,
        )

        if tipo_costo:
            costi_secondari_fornitori.append({
                "tipo": tipo_costo,
                "descrizione": descrizione_riga,
                "importo": importo_riga,
                "quantita": quantita_riga,
                "prezzo_unitario": prezzo_unitario_riga,
                "codice": codice_riga,
                "codice_fornitore": codice_fornitore_riga,
                "barcode": barcode_riga,
            })
            continue

        linee_prodotti.append(riga)

    linee = linee_prodotti
    totale_costi_secondari_fornitori = round(sum(float(c.get("importo") or 0) for c in costi_secondari_fornitori), 2)

    

    # Filtra dai prodotti non trovati le righe che NON sono prodotti:
    # riferimenti ordine, spese trasporto, imballo, bollo, incasso, ecc.
    non_trovati_filtrati = []

    for riga in non_trovati:
        controllo = is_riga_da_escludere_dai_prodotti_non_trovati(riga)

        if controllo.get("escludi"):
            tipo = controllo.get("tipo")
            descrizione = controllo.get("descrizione")
            importo = float(controllo.get("importo") or 0)

            if tipo and tipo != "Riga informativa" and importo > 0:
                costi_secondari_fornitori.append({
                    "tipo": tipo,
                    "descrizione": descrizione,
                    "importo": round(importo, 2),
                    "origine": "riga_non_trovata_filtrata",
                })

            saltati.append({
                "descrizione": descrizione,
                "motivo": tipo or "Riga non prodotto",
            })

            continue

        non_trovati_filtrati.append(riga)

    non_trovati = non_trovati_filtrati
    totale_costi_secondari_fornitori = round(
        sum(float(c.get("importo") or 0) for c in costi_secondari_fornitori),
        2
    )

    await db.invoice_imports.insert_one({
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
        "righe_fattura_originali": righe_fattura_originali,
        "costi_secondari_fornitori": costi_secondari_fornitori,
        "totale_costi_secondari_fornitori": totale_costi_secondari_fornitori,
        "prodotti_aggiornati": aggiornati,
        "barcode_non_trovati": len(non_trovati),
        "righe_saltate": len(saltati),
    })

    return {
        "ok": True,
        "fornitore": info_fattura["denominazione"],
        "partita_iva": info_fattura["partita_iva"],
        "numero": info_fattura["numero"],
        "data": info_fattura["data"],
        "righe_fattura": len(linee),
        "righe_fattura_originali": righe_fattura_originali,
        "costi_secondari_fornitori": costi_secondari_fornitori,
        "totale_costi_secondari_fornitori": totale_costi_secondari_fornitori,
        "prodotti_aggiornati": aggiornati,
        "barcode_non_trovati": len(non_trovati),
        "righe_saltate": len(saltati),
        "report": percorso_report,
        "file_non_trovati": percorso_non_trovati,
        "non_trovati": non_trovati[:20],
        "saltati": saltati[:20],
    }



# Compatibilità con vecchio nome usato durante lo sviluppo.
classifica_costo_accessorio_intelligente = classifica_costo_secondario_fornitore_intelligente
classifica_costo_accessorio = classifica_costo_secondario_fornitore

