"""Importazione essenziale e testabile delle fatture elettroniche FatturaPA."""

from __future__ import annotations

import re
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _first_element(parent: ET.Element, name: str) -> ET.Element | None:
    return next((node for node in parent.iter() if _local_name(node.tag) == name), None)


def _first_text(parent: ET.Element | None, name: str, default: str = "") -> str:
    if parent is None:
        return default
    node = _first_element(parent, name)
    return str(node.text or "").strip() if node is not None else default


def _decimal(value: str, default: float = 0.0) -> float:
    try:
        return float(str(value).strip().replace(",", "."))
    except (TypeError, ValueError):
        return default


def _integer_quantity(value: str) -> int:
    return max(0, int(round(_decimal(value, 0.0))))


def _normalise_code(value: str) -> str:
    return re.sub(r"\s+", "", str(value or "").strip())


def parse_invoice_xml(content: bytes) -> dict:
    """Legge una FatturaPA con o senza namespace XML."""
    if not content or not content.strip():
        raise ValueError("File XML vuoto")

    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise ValueError(f"XML non valido: {exc}") from exc

    general_document = _first_element(root, "DatiGeneraliDocumento")
    supplier = _first_element(root, "CedentePrestatore")
    supplier_details = _first_element(supplier, "DatiAnagrafici") if supplier is not None else None

    invoice_number = _first_text(general_document, "Numero")
    invoice_date = _first_text(general_document, "Data")
    vat_number = _first_text(supplier_details, "IdCodice")
    supplier_name = (
        _first_text(supplier_details, "Denominazione")
        or " ".join(
            value
            for value in (
                _first_text(supplier_details, "Nome"),
                _first_text(supplier_details, "Cognome"),
            )
            if value
        )
    ).strip()

    missing = [
        label
        for label, value in (
            ("numero", invoice_number),
            ("data", invoice_date),
            ("partita IVA", vat_number),
        )
        if not value
    ]
    if missing:
        raise ValueError(f"Dati obbligatori mancanti: {', '.join(missing)}")

    lines = []
    for detail in (node for node in root.iter() if _local_name(node.tag) == "DettaglioLinee"):
        codes = []
        for code_node in (node for node in detail.iter() if _local_name(node.tag) == "CodiceArticolo"):
            code_type = _first_text(code_node, "CodiceTipo").upper()
            code_value = _normalise_code(_first_text(code_node, "CodiceValore"))
            if code_value:
                codes.append((code_type, code_value))

        barcode = next(
            (value for code_type, value in codes if code_type in {"EAN", "EAN13", "GTIN", "BARCODE"}),
            "",
        )
        product_code = next((value for _, value in codes if value != barcode), "")
        if not product_code and codes:
            product_code = codes[0][1]

        quantity = _integer_quantity(_first_text(detail, "Quantita", "1"))
        unit_price = _decimal(_first_text(detail, "PrezzoUnitario"))
        total_price = _decimal(_first_text(detail, "PrezzoTotale"))
        if quantity > 0 and total_price > 0:
            unit_price = total_price / quantity

        description = _first_text(detail, "Descrizione")
        if not description:
            continue

        lines.append(
            {
                "numero_linea": _first_text(detail, "NumeroLinea"),
                "barcode": barcode,
                "codice_prodotto": product_code,
                "descrizione": description,
                "quantita": quantity,
                "prezzo_unitario": round(unit_price, 4),
                "prezzo_totale": round(total_price, 2),
            }
        )

    if not lines:
        raise ValueError("La fattura non contiene righe prodotto leggibili")

    return {
        "numero_fattura": invoice_number,
        "data_fattura": invoice_date,
        "partita_iva": vat_number,
        "fornitore": supplier_name,
        "righe": lines,
    }


async def import_invoice(db, invoice: dict, filename: str) -> dict:
    """Aggiorna le giacenze trovate e registra separatamente le righe mancanti."""
    invoice_key = {
        "numero_fattura": invoice["numero_fattura"],
        "partita_iva": invoice["partita_iva"],
    }
    if await db.invoice_imports.find_one(invoice_key):
        return {"ok": False, "already_imported": True, **invoice_key}

    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    missing = 0

    for line in invoice["righe"]:
        alternatives = []
        if line["barcode"]:
            alternatives.append({"barcode": line["barcode"]})
        if line["codice_prodotto"]:
            alternatives.append({"codice_prodotto": line["codice_prodotto"]})

        product = await db.products.find_one({"$or": alternatives}) if alternatives else None
        if product:
            await db.products.update_one(
                {"_id": product["_id"]},
                {
                    "$inc": {"quantita": line["quantita"]},
                    "$set": {
                        "prezzo_acquisto": line["prezzo_unitario"],
                        "fornitore": invoice["fornitore"],
                        "updated_at": now,
                    },
                },
            )
            updated += 1
            status = "aggiornato"
        else:
            pending = {
                "id": str(uuid.uuid4()),
                **invoice_key,
                "data_fattura": invoice["data_fattura"],
                "fornitore": invoice["fornitore"],
                **line,
                "stato": "da_creare",
                "created_at": now,
            }
            await db.pending_invoice_products.insert_one(pending)
            missing += 1
            status = "non_trovato"

        line["stato"] = status

    history = {
        "id": str(uuid.uuid4()),
        **invoice_key,
        "data_fattura": invoice["data_fattura"],
        "fornitore": invoice["fornitore"],
        "filename": filename,
        "righe_totali": len(invoice["righe"]),
        "prodotti_aggiornati": updated,
        "prodotti_non_trovati": missing,
        "created_at": now,
    }
    await db.invoice_imports.insert_one(history)

    return {
        "ok": True,
        **history,
        "righe": invoice["righe"],
    }
