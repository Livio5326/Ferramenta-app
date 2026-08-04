import asyncio

import pytest
from mongomock_motor import AsyncMongoMockClient

import server


def test_shared_invoice_history_round_trip(monkeypatch):
    asyncio.run(_shared_invoice_history_round_trip(monkeypatch))


async def _shared_invoice_history_round_trip(monkeypatch):
    database = AsyncMongoMockClient()["shared_invoice_history_test"]
    monkeypatch.setattr(server, "db", database)

    payload = server.InvoiceHistorySyncRequest(
        invoice={
            "chiave_import": "01234567890|42|2026-08-01",
            "numero": "42",
            "data": "2026-08-01",
            "partita_iva": "01234567890",
            "denominazione": "Fornitore Test",
            "data_import": "2026-08-01T12:00:00+00:00",
            "righe_fattura": 1,
            "righe_fattura_originali": 2,
            "prodotti_aggiornati": 1,
            "righe_saltate": 1,
        },
        products=[
            {
                "linea": "1",
                "barcode": "8000000000001",
                "descrizione": "Prodotto test",
                "quantita": 3,
            }
        ],
        secondary_costs=[
            {"tipo": "Trasporto", "descrizione": "Spese", "importo": 4.5}
        ],
    )

    saved = await server.sync_invoice_history(
        payload,
        current_user={"_id": "user-1", "username": "dario"},
    )
    assert saved["created"] is True
    assert saved["invoice"]["numero"] == "42"
    assert saved["invoice"]["totale_costi_secondari_fornitori"] == 4.5

    exists = await server.invoice_history_exists(payload.invoice["chiave_import"])
    assert exists["exists"] is True

    details = await server.get_shared_invoice_products(
        payload.invoice["chiave_import"]
    )
    assert details["total"] == 1
    assert details["items"][0]["descrizione"] == "Prodotto test"

    history = await server.list_invoice_imports()
    assert history["total"] == 1
    assert history["items"][0]["sincronizzata"] is True


def test_shorter_sync_does_not_erase_invoice_products(monkeypatch):
    asyncio.run(_shorter_sync_does_not_erase_invoice_products(monkeypatch))


async def _shorter_sync_does_not_erase_invoice_products(monkeypatch):
    database = AsyncMongoMockClient()["shared_invoice_merge_test"]
    monkeypatch.setattr(server, "db", database)
    key = "01234567890|43|2026-08-01"

    complete = server.InvoiceHistorySyncRequest(
        invoice={"chiave_import": key, "numero": "43"},
        products=[{"linea": "1"}, {"linea": "2"}],
    )
    shorter = server.InvoiceHistorySyncRequest(
        invoice={"chiave_import": key, "numero": "43"},
        products=[{"linea": "1"}],
    )

    await server.sync_invoice_history(
        complete,
        current_user={"_id": "user-1", "username": "dario"},
    )
    second = await server.sync_invoice_history(
        shorter,
        current_user={"_id": "user-2", "username": "manlio"},
    )

    assert second["created"] is False
    details = await server.get_shared_invoice_products(key)
    assert details["total"] == 2
