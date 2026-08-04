"""Ferramenta Manager API tests - covers all endpoints under /api."""
import os
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-forge-492.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

TEST_USERNAME = os.environ.get("TEST_USERNAME", "test_suite_admin")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "test_suite_password_123")


@pytest.fixture(scope="session")
def s():
    """Sessione HTTP autenticata: dall'introduzione del middleware globale di
    autenticazione, tutte le rotte /api (tranne login/bootstrap-admin/health)
    richiedono un Bearer token."""
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})

    login = sess.post(
        f"{API}/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )

    if login.status_code != 200:
        # Nessun utente di test presente: prova a diventare il primo admin.
        # Se fallisce (perche' un admin esiste gia'), l'account di test va
        # creato manualmente o le credenziali vanno passate via env var.
        sess.post(
            f"{API}/auth/bootstrap-admin",
            json={
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD,
                "nome": "Test Suite Admin",
            },
        )
        login = sess.post(
            f"{API}/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
        )

    if login.status_code != 200:
        pytest.skip(
            "Impossibile autenticarsi per i test API: imposta le variabili "
            "d'ambiente TEST_USERNAME/TEST_PASSWORD con un account valido "
            f"per {BASE} (login ha risposto {login.status_code})."
        )

    token = login.json()["access_token"]
    sess.headers.update({"Authorization": f"Bearer {token}"})
    return sess


# ---------- Health / seed ----------
def test_root(s):
    # Non esiste una rotta di benvenuto su /api/ (ne' mai esistita nel
    # server attuale): l'equivalente per verificare che l'API sia viva e'
    # /api/health, pubblica e senza autenticazione.
    r = s.get(f"{API}/health")
    assert r.status_code == 200
    d = r.json()
    assert d.get("status") == "ok"
    assert "Ferramenta" in d.get("service", "")


def test_seed_idempotent(s):
    r = s.post(f"{API}/seed")
    assert r.status_code == 200
    data = r.json()
    # Already seeded per context
    assert "seeded" in data
    if data["seeded"]:
        assert data["count"] >= 16
    else:
        assert data["existing"] >= 1


# ---------- List / search / filter ----------
# Il vecchio endpoint piatto GET /products (senza {pid}) e' stato sostituito
# dal catalogo paginato GET /products/page, che risponde con un oggetto
# {"items": [...], "total", "skip", "limit", "hasMore"} invece di una lista.
def test_list_products(s):
    r = s.get(f"{API}/products/page")
    assert r.status_code == 200
    data = r.json()
    items = data["items"]
    assert isinstance(items, list)
    assert len(items) >= 1
    # No _id leak
    for d in items:
        assert "_id" not in d
        assert "id" in d and "descrizione" in d


def test_search_q(s):
    r = s.get(f"{API}/products/page", params={"q": "trapano"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert any("Trapano" in p["descrizione"] or "trapano" in p["descrizione"].lower() for p in items)


def test_filter_categoria(s):
    r = s.get(f"{API}/products/page", params={"categoria": "Elettroutensili"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all(p["categoria"] == "Elettroutensili" for p in items)


def test_filter_marca(s):
    # Il filtro marca ora si chiama marca_standard e confronta la marca
    # standardizzata del prodotto (case-insensitive).
    r = s.get(f"{API}/products/page", params={"marca_standard": "Bosch"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all(p.get("marca_standard", "").lower() == "bosch" for p in items)


def test_filter_sotto_scorta(s):
    # Non esiste piu' un filtro sotto_scorta su /products/page: la lista dei
    # prodotti sotto scorta (fino a 20) e' esposta dentro /statistiche.
    r = s.get(f"{API}/statistiche")
    assert r.status_code == 200
    items = r.json()["sotto_scorta"]
    for p in items:
        assert p["quantita"] <= p["soglia_scorta"]


# ---------- Meta / stats ----------
def test_meta(s):
    r = s.get(f"{API}/meta")
    assert r.status_code == 200
    d = r.json()
    for k in ("categorie", "marche", "fornitori"):
        assert k in d and isinstance(d[k], list)
    assert "Elettroutensili" in d["categorie"]


def test_stats(s):
    # L'endpoint si chiama /statistiche (non /stats).
    r = s.get(f"{API}/statistiche")
    assert r.status_code == 200
    d = r.json()
    for k in ("total_products", "total_pieces", "valore_magazzino",
              "valore_vendita_potenziale", "sotto_scorta_count",
              "sotto_scorta", "categorie", "vendite_totali", "numero_vendite"):
        assert k in d
    assert d["total_products"] >= 1
    assert d["valore_magazzino"] >= 0


# ---------- CRUD ----------
class TestCRUD:
    pid = None
    barcode = "TEST_99900011122"

    def test_create(self, s):
        payload = {
            "barcode": self.barcode,
            "descrizione": "TEST_Avvitatore prova",
            "marca": "TEST_Brand",
            "categoria": "Elettroutensili",
            "prezzo_acquisto": 10.0,
            "prezzo_vendita": 25.0,
            "quantita": 5,
            "fornitore": "TEST_Fornitore",
            "soglia_scorta": 2,
        }
        r = s.post(f"{API}/products", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert d["descrizione"] == payload["descrizione"]
        assert d["quantita"] == 5
        TestCRUD.pid = d["id"]

    def test_get_by_id(self, s):
        assert TestCRUD.pid
        r = s.get(f"{API}/products/{TestCRUD.pid}")
        assert r.status_code == 200
        assert r.json()["id"] == TestCRUD.pid

    def test_get_by_barcode(self, s):
        r = s.get(f"{API}/products/{self.barcode}")
        assert r.status_code == 200
        assert r.json()["barcode"] == self.barcode

    def test_update(self, s):
        r = s.put(f"{API}/products/{TestCRUD.pid}", json={"prezzo_vendita": 30.0, "quantita": 10})
        assert r.status_code == 200
        # Verify persistence
        r2 = s.get(f"{API}/products/{TestCRUD.pid}")
        d = r2.json()
        assert d["prezzo_vendita"] == 30.0
        assert d["quantita"] == 10

    def test_adjust_stock_increase(self, s):
        r = s.post(f"{API}/products/{TestCRUD.pid}/adjust-stock", json={"delta": 5})
        assert r.status_code == 200
        assert r.json()["quantita"] == 15

    def test_adjust_stock_never_negative(self, s):
        r = s.post(f"{API}/products/{TestCRUD.pid}/adjust-stock", json={"delta": -100})
        assert r.status_code == 200
        assert r.json()["quantita"] == 0

    def test_delete(self, s):
        r = s.delete(f"{API}/products/{TestCRUD.pid}")
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Verify gone
        r2 = s.get(f"{API}/products/{TestCRUD.pid}")
        assert r2.status_code == 404
        assert "non trovato" in r2.json()["detail"].lower()


# ---------- 404 / errors ----------
def test_get_missing_404(s):
    r = s.get(f"{API}/products/non-existent-uuid-xyz")
    assert r.status_code == 404
    assert "Prodotto non trovato" in r.json()["detail"]


def test_barcode_missing_404(s):
    r = s.get(f"{API}/products/NOPE_NOPE_NOPE")
    assert r.status_code == 404


def test_update_missing_404(s):
    r = s.put(f"{API}/products/nope-uuid", json={"quantita": 5})
    assert r.status_code == 404


def test_delete_missing_404(s):
    r = s.delete(f"{API}/products/nope-uuid")
    assert r.status_code == 404


def test_adjust_stock_missing_404(s):
    r = s.post(f"{API}/products/nope-uuid/adjust-stock", json={"delta": 1})
    assert r.status_code == 404


# ---------- Bulk ----------
def test_bulk_upsert(s):
    payload = [
        {"barcode": "TEST_BULK_001", "descrizione": "TEST_Bulk product A", "marca": "X",
         "categoria": "TEST_cat", "prezzo_acquisto": 1.0, "prezzo_vendita": 2.0, "quantita": 3},
        {"barcode": "TEST_BULK_002", "descrizione": "TEST_Bulk product B", "marca": "Y",
         "categoria": "TEST_cat", "prezzo_acquisto": 5.0, "prezzo_vendita": 9.0, "quantita": 7},
    ]
    r = s.post(f"{API}/products/bulk", json=payload)
    assert r.status_code == 200
    assert r.json()["inserted"] == 2

    # Upsert (update quantita)
    payload[0]["quantita"] = 99
    r2 = s.post(f"{API}/products/bulk", json=payload)
    assert r2.status_code == 200

    # Verify upsert not duplicated
    r3 = s.get(f"{API}/products/TEST_BULK_001")
    assert r3.status_code == 200
    assert r3.json()["quantita"] == 99

    # Cleanup
    for bc in ("TEST_BULK_001", "TEST_BULK_002"):
        g = s.get(f"{API}/products/{bc}")
        if g.status_code == 200:
            s.delete(f"{API}/products/{g.json()['id']}")


# ---------- Sales ----------
class TestSales:
    pid = None

    def test_create_product_for_sale(self, s):
        r = s.post(f"{API}/products", json={
            "barcode": "TEST_SALE_001",
            "descrizione": "TEST_SaleProduct",
            "prezzo_acquisto": 2.0,
            "prezzo_vendita": 5.0,
            "quantita": 20,
        })
        assert r.status_code == 200
        TestSales.pid = r.json()["id"]

    def test_create_sale_decrements_stock(self, s):
        assert TestSales.pid
        payload = {
            "items": [{
                "product_id": TestSales.pid,
                "descrizione": "TEST_SaleProduct",
                "prezzo_vendita": 5.0,
                "quantita": 3,
            }]
        }
        r = s.post(f"{API}/sales", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["totale"] == 15.0
        assert "_id" not in d
        assert len(d["items"]) == 1

        # Verify stock decrement: 20 - 3 = 17
        r2 = s.get(f"{API}/products/{TestSales.pid}")
        assert r2.json()["quantita"] == 17

    def test_empty_sale_400(self, s):
        r = s.post(f"{API}/sales", json={"items": []})
        assert r.status_code == 400
        assert "vuoto" in r.json()["detail"].lower()

    def test_list_sales(self, s):
        r = s.get(f"{API}/sales")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        for it in items:
            assert "_id" not in it
            assert "totale" in it

    def test_cleanup_sale_product(self, s):
        if TestSales.pid:
            s.delete(f"{API}/products/{TestSales.pid}")
