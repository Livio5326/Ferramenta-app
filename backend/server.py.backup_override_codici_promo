from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from fastapi.staticfiles import StaticFiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads") 
from fastapi import UploadFile, File, Form
import csv
import io

api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barcode: str = ""
    codice_prodotto: str = ""
    descrizione: str
    marca: str = ""
    categoria: str = ""
    prezzo_acquisto: float = 0.0
    prezzo_vendita: float = 0.0
    prezzo_promo: Optional[float] = None
    promo_attiva: bool = False
    promo_nome: str = ""
    promo_inizio: str = ""
    promo_fine: str = ""
    ultimo_aggiornamento_promo: str = ""
    quantita: int = 0
    fornitore: str = ""
    foto: str = ""  # url o data:image base64
    note: str = ""
    soglia_scorta: int = 5
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())



def normalizza_marca_standard(raw: str | None) -> str:
    value = (raw or "").strip()
    key = value.upper().strip()

    import re
    normalized = re.sub(r"[^A-Z0-9]+", " ", key).strip()

    BRAND_MAPPING = {
        "STANLEY": "STANLEY",
        "STANLEY FATMAX": "STANLEY",
        "FATMAX": "STANLEY",

        "BLACK": "BLACK+DECKER",
        "BLACK DECKER": "BLACK+DECKER",
        "BLACK AND DECKER": "BLACK+DECKER",
        "BLACK+DECKER": "BLACK+DECKER",
        "BLACK & DECKER": "BLACK+DECKER",
        "BLACK&DECKER": "BLACK+DECKER",
        "BLACK + DECKER": "BLACK+DECKER",
        "B+D": "BLACK+DECKER",
        "BD": "BLACK+DECKER",
        "STANLEY BLACK & DECKER": "BLACK+DECKER",

        "BOSCH": "BOSCH",
        "BOSCH PROFESSIONAL": "BOSCH",
        "MAKITA": "MAKITA",
        "MILWAUKEE": "MILWAUKEE",
        "DEWALT": "DEWALT",
        "METABO": "METABO",
        "HIKOKI": "HIKOKI",
        "HITACHI": "HIKOKI",
        "RYOBI": "RYOBI",
        "EINHELL": "EINHELL",
        "DREMEL": "DREMEL",

        "WERA": "WERA",
        "KNIPEX": "KNIPEX",
        "USAG": "USAG",
        "BETA": "BETA",
        "FACOM": "FACOM",
        "MAURER": "MAURER",
        "PAPILLON": "PAPILLON",
        "AMBROVIT": "AMBROVIT",

        "FISCHER": "FISCHER",
        "PATTEX": "PATTEX",
        "BOSTIK": "BOSTIK",
        "SARATOGA": "SARATOGA",
        "MAPEI": "MAPEI",
        "SIKA": "SIKA",
        "LOCTITE": "LOCTITE",

        "OSRAM": "OSRAM",
        "VIMAR": "VIMAR",
        "BTICINO": "BTICINO",
        "LEGRAND": "LEGRAND",
        "3M": "3M",
        "SINGER": "SINGER SAFETY",
        "SINGER SAFETY": "SINGER SAFETY",
    }

    if key in BRAND_MAPPING:
        return BRAND_MAPPING[key]

    if normalized in BRAND_MAPPING:
        return BRAND_MAPPING[normalized]

    if "BLACK" in normalized and "DECKER" in normalized:
        return "BLACK+DECKER"

    return key if key else "ALTRO"


def applica_marca_standard_al_prodotto(data: dict) -> dict:
    raw_brand = (
        data.get("marca")
        or data.get("brand")
        or data.get("marca_standard")
        or ""
    )

    marca_standard = normalizza_marca_standard(raw_brand)

    # Marca e marca_standard vengono uniformate.
    # Il fornitore resta separato e NON viene modificato.
    data["marca"] = marca_standard
    data["marca_standard"] = marca_standard

    # Non usiamo più marca_originale: nell'app deve uscire sempre la marca standard.
    data.pop("marca_originale", None)

    return data


class ProductCreate(BaseModel):
    barcode: str = ""
    codice_prodotto: str = ""
    descrizione: str
    marca: str = ""
    categoria: str = ""
    prezzo_acquisto: float = 0.0
    prezzo_vendita: float = 0.0
    prezzo_promo: Optional[float] = None
    promo_attiva: bool = False
    promo_nome: str = ""
    promo_inizio: str = ""
    promo_fine: str = ""
    ultimo_aggiornamento_promo: str = ""
    quantita: int = 0
    fornitore: str = ""
    foto: str = ""
    note: str = ""
    soglia_scorta: int = 5


class ProductUpdate(BaseModel):
    barcode: Optional[str] = None
    codice_prodotto: Optional[str] = None
    descrizione: Optional[str] = None
    marca: Optional[str] = None
    categoria: Optional[str] = None
    categoria_standard: Optional[str] = None
    prezzo_acquisto: Optional[float] = None
    prezzo_vendita: Optional[float] = None
    prezzo_promo: Optional[float] = None
    promo_attiva: Optional[bool] = None
    promo_nome: Optional[str] = None
    promo_inizio: Optional[str] = None
    promo_fine: Optional[str] = None
    ultimo_aggiornamento_promo: Optional[str] = None
    quantita: Optional[int] = None
    fornitore: Optional[str] = None
    foto: Optional[str] = None
    note: Optional[str] = None
    soglia_scorta: Optional[int] = None


class StockAdjust(BaseModel):
    delta: int


class SaleItem(BaseModel):
    product_id: str
    descrizione: str
    prezzo_vendita: float
    quantita: int


class Sale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[SaleItem]
    totale: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SaleCreate(BaseModel):
    items: List[SaleItem]


# ---------- Helpers ----------
def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id")
    return doc


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Ferramenta Manager API"}


@api_router.get("/products", response_model=List[Product])
async def list_products(
    q: Optional[str] = None,
    categoria: Optional[str] = None,
    marca_standard: Optional[str] = None,
    sotto_scorta: Optional[bool] = None,
):
    query = {}
    if q:
        query["$or"] = [
            {"descrizione": {"$regex": q, "$options": "i"}},
            {"barcode": {"$regex": q, "$options": "i"}},
            {"codice_prodotto": {"$regex": q, "$options": "i"}},
            {"marca": {"$regex": q, "$options": "i"}},
        ]
    if categoria:
        query["categoria_standard"] = categoria
    if marca_standard and marca_standard != "Tutte":
        query["marca_standard"] = marca_standard
    cursor = db.products.find(query, {"_id": 0}).sort("descrizione", 1)
    docs = await cursor.to_list(10000)
    if sotto_scorta:
        docs = [d for d in docs if d.get("quantita", 0) <= d.get("soglia_scorta", 5)]
    return [Product(**d) for d in docs]



@api_router.get("/products/barcode/{barcode}", response_model=Product)
async def get_by_barcode(barcode: str):
    doc = await db.products.find_one({"barcode": barcode}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return Product(**doc)



@api_router.get("/brands/standard")
async def get_standard_brands():
    brands = await db.products.distinct("marca_standard")
    cleaned = []
    has_altro = False

    for b in brands:
        if not b:
            continue
        if b == "ALTRO":
            has_altro = True
            continue
        cleaned.append(b)

    cleaned = sorted(cleaned)

    if has_altro:
        cleaned.append("ALTRO")

    return {"items": cleaned}


@api_router.get("/products/page")
async def list_products_page(
    q: Optional[str] = None,
    categoria: Optional[str] = None,
    marca_standard: Optional[str] = None,
    sotto_scorta: Optional[bool] = None,
    vendibile: Optional[bool] = None,
    limit: int = 50,
    skip: int = 0,
):
    # Limiti di sicurezza: evitiamo richieste enormi dal frontend
    if limit < 1:
        limit = 50
    if limit > 200:
        limit = 200
    if skip < 0:
        skip = 0

    query = {}

    if q:
        query["$or"] = [
            {"descrizione": {"$regex": q, "$options": "i"}},
            {"barcode": {"$regex": q, "$options": "i"}},
            {"codice_prodotto": {"$regex": q, "$options": "i"}},
            {"marca": {"$regex": q, "$options": "i"}},
        ]

    if categoria:
        query["categoria_standard"] = categoria

    if marca_standard:
        query["$or"] = [
        {"marca_standard": marca_standard},
        {"marca": marca_standard},
    ]

    if sotto_scorta:
        query["$expr"] = {
            "$lte": [
                {"$ifNull": ["$quantita", 0]},
                {"$ifNull": ["$soglia_scorta", 5]},
            ]
        }

    if vendibile:
        query["quantita"] = {"$gt": 0}

    total = await db.products.count_documents(query)

    cursor = (
        db.products
        .find(query, {"_id": 0})
        .sort("descrizione", 1)
        .skip(skip)
        .limit(limit)
    )

    docs = await cursor.to_list(limit)
    items = [Product(**d).dict() for d in docs]

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "skip": skip,
        "has_more": skip + len(items) < total,
    }





# -------- Import prezzi promozionali --------

def _normalizza_nome_colonna(value):
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


def _valore_da_riga(row, possibili_nomi):
    normalizzata = {
        _normalizza_nome_colonna(k): v
        for k, v in row.items()
    }
    for nome in possibili_nomi:
        key = _normalizza_nome_colonna(nome)
        if key in normalizzata:
            return normalizzata[key]
    return None


def _pulisci_testo(value):
    if value is None:
        return ""
    return str(value).strip()


def _parse_prezzo(value):
    if value is None:
        return None

    if isinstance(value, (int, float)):
        prezzo = float(value)
        return prezzo if prezzo > 0 else None

    s = str(value).strip()
    if not s:
        return None

    s = s.replace("€", "").replace(" ", "")

    # Formato italiano: 1.234,56
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", ".")

    pulito = ""
    for ch in s:
        if ch.isdigit() or ch in [".", "-"]:
            pulito += ch

    try:
        prezzo = float(pulito)
        return prezzo if prezzo > 0 else None
    except Exception:
        return None


def _leggi_file_promo_sync(filename, content):
    nome = (filename or "").lower()

    if nome.endswith(".csv"):
        try:
            testo = content.decode("utf-8-sig")
        except Exception:
            testo = content.decode("latin-1")

        sample = testo[:2048]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";,")
            delimiter = dialect.delimiter
        except Exception:
            delimiter = ";"

        reader = csv.DictReader(io.StringIO(testo), delimiter=delimiter)
        return [dict(r) for r in reader]

    if nome.endswith(".xlsx"):
        try:
            from openpyxl import load_workbook
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Per leggere file Excel serve openpyxl installato nel backend"
            )

        wb = load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        headers = [_pulisci_testo(h) for h in rows[0]]
        result = []

        for values in rows[1:]:
            row = {}
            for i, header in enumerate(headers):
                if header:
                    row[header] = values[i] if i < len(values) else None
            result.append(row)

        return result

    raise HTTPException(
        status_code=400,
        detail="Formato file non supportato. Usa CSV o XLSX"
    )


async def _crea_anteprima_promo(rows):
    risultati = []
    letti = 0
    trovati = 0
    aggiornabili = 0
    non_trovati = 0
    prezzo_non_valido = 0

    for index, row in enumerate(rows, start=2):
        letti += 1

        codice = _pulisci_testo(_valore_da_riga(row, [
            "codice_prodotto",
            "codice prodotto",
            "codice",
            "codice_articolo",
            "codice articolo",
            "sku"
        ]))

        barcode = _pulisci_testo(_valore_da_riga(row, [
            "barcode",
            "ean",
            "ean13",
            "codice_barre",
            "codice barre"
        ]))

        descrizione_file = _pulisci_testo(_valore_da_riga(row, [
            "descrizione",
            "description",
            "nome",
            "prodotto"
        ]))

        prezzo = _parse_prezzo(_valore_da_riga(row, [
            "prezzo_promo",
            "prezzo promo",
            "prezzo_promozionale",
            "prezzo promozionale",
            "promo",
            "prezzo",
            "prezzo_netto",
            "prezzo netto"
        ]))

        prodotto = None
        match_usato = ""

        if codice:
            prodotto = await db.products.find_one({"codice_prodotto": codice}, {"_id": 0})
            if prodotto:
                match_usato = "codice_prodotto"

        if not prodotto and barcode:
            prodotto = await db.products.find_one({"barcode": barcode}, {"_id": 0})
            if prodotto:
                match_usato = "barcode"

        stato = "aggiornabile"

        if prezzo is None:
            prezzo_non_valido += 1
            stato = "prezzo_non_valido"
        elif not prodotto:
            non_trovati += 1
            stato = "non_trovato"
        else:
            trovati += 1
            aggiornabili += 1

        risultati.append({
            "riga": index,
            "codice_prodotto": codice,
            "barcode": barcode,
            "descrizione_file": descrizione_file,
            "prezzo_promo": prezzo,
            "stato": stato,
            "match_usato": match_usato,
            "product_id": prodotto.get("id") if prodotto else None,
            "descrizione_db": prodotto.get("descrizione") if prodotto else "",
            "prezzo_vendita_attuale": prodotto.get("prezzo_vendita") if prodotto else None
        })

    return {
        "prodotti_letti": letti,
        "prodotti_trovati": trovati,
        "prodotti_aggiornabili": aggiornabili,
        "prodotti_non_trovati": non_trovati,
        "prezzo_mancante_o_non_valido": prezzo_non_valido,
        "righe": risultati
    }


@api_router.post("/products/import-promo-prices/preview")
async def preview_import_promo_prices(file: UploadFile = File(...)):
    content = await file.read()
    rows = _leggi_file_promo_sync(file.filename, content)
    return await _crea_anteprima_promo(rows)


@api_router.post("/products/import-promo-prices/confirm")
async def confirm_import_promo_prices(
    file: UploadFile = File(...),
    promo_nome: str = Form(...),
    promo_inizio: str = Form(""),
    promo_fine: str = Form("")
):
    content = await file.read()
    rows = _leggi_file_promo_sync(file.filename, content)
    anteprima = await _crea_anteprima_promo(rows)

    aggiornati = 0
    now = datetime.now(timezone.utc).isoformat()

    for r in anteprima["righe"]:
        if r["stato"] != "aggiornabile":
            continue

        product_id = r.get("product_id")
        prezzo_promo = r.get("prezzo_promo")

        if not product_id or prezzo_promo is None:
            continue

        await db.products.update_one(
            {"id": product_id},
            {"$set": {
                "prezzo_promo": prezzo_promo,
                "promo_attiva": True,
                "promo_nome": promo_nome,
                "promo_inizio": promo_inizio,
                "promo_fine": promo_fine,
                "ultimo_aggiornamento_promo": now,
                "updated_at": now
            }}
        )
        aggiornati += 1

    return {
        "ok": True,
        "aggiornati": aggiornati,
        "anteprima": anteprima
    }


@api_router.post("/products/promo/deactivate")
async def deactivate_promo_prices():
    now = datetime.now(timezone.utc).isoformat()
    res = await db.products.update_many(
        {"promo_attiva": True},
        {"$set": {
            "promo_attiva": False,
            "ultimo_aggiornamento_promo": now,
            "updated_at": now
        }}
    )
    return {
        "ok": True,
        "disattivati": res.modified_count
    }



@api_router.get("/products/{pid}", response_model=Product)
async def get_product(pid: str):
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return Product(**doc)


@api_router.post("/products", response_model=Product)
async def create_product(input: ProductCreate):
    prod = Product(**input.dict())
    data = applica_marca_standard_al_prodotto(prod.dict())
    await db.products.insert_one(data)
    return prod


@api_router.put("/products/{pid}", response_model=Product)
async def update_product(pid: str, input: ProductUpdate):
    updates = {k: v for k, v in input.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.products.update_one({"id": pid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    return Product(**doc)


@api_router.delete("/products/{pid}")
async def delete_product(pid: str):
    res = await db.products.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return {"ok": True}


@api_router.post("/products/{pid}/adjust-stock", response_model=Product)
async def adjust_stock(pid: str, body: StockAdjust):
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    new_qty = max(0, int(doc.get("quantita", 0)) + body.delta)
    await db.products.update_one(
        {"id": pid},
        {"$set": {"quantita": new_qty, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    doc["quantita"] = new_qty
    return Product(**doc)



def calcola_categoria_standard_import(data: dict) -> str:
    """Assegna categoria_standard in modo stabile durante l'import Excel."""
    import re

    def up(v):
        return str(v or "").strip().upper()

    categoria = up(data.get("categoria"))
    descrizione = up(data.get("descrizione"))
    codice = up(data.get("codice_prodotto") or data.get("codice") or "")
    marca = up(data.get("marca") or data.get("fornitore") or "")
    testo = f"{categoria} {descrizione} {codice} {marca}"

    # Auto
    if (
        re.search(r"^(ASI|BDCINF)", codice)
        or "PNEUMATIC" in testo
        or "POMPA A PEDALE" in testo
        or "SOLLEVATORE" in testo
        or "COLONNETTE" in testo
    ):
        return "Auto"

    # Portautensili
    if (
        "PORTAUTENSILI" in categoria
        or re.search(r"^(WM|BEZ|BDCWBK|FME790)", codice)
        or "BANCO DA LAVORO" in testo
        or "CAVALLETTO" in testo
        or "SUPPORTO" in testo
        or "CARRELLO" in testo
    ):
        return "Portautensili"

    # Accessori
    if "BATTERIE E CARICABATTERIE" in categoria:
        return "Accessori"

    if "ACCESSORI" in categoria:
        return "Accessori"

    # Giardinaggio
    if "GIARDINO" in categoria or "GAMMA GIARDINO" in categoria:
        return "Giardinaggio"

    # Casa
    if "CURA DELLA CASA" in categoria:
        return "Casa"

    # Gesso/cartongesso Stanley: per ora li trattiamo come utensili manuali
    if "GESSO RIVESTITO" in categoria:
        return "Utensili manuali"

    # Utensileria
    if "UTENSILERIA MANUALE" in categoria or "UTENSILERIA MECCANICA" in categoria:
        return "Utensili manuali"

    # Misura
    if "STRUMENTI DI MISURA" in categoria or "STRUMENTAZIONE ELETTRONICA" in categoria:
        if any(x in testo for x in ["SEGHETTO", "SEGACCIO", "LAMA", "SPATOLA", "TRUSCHINO", "POMPA"]):
            return "Utensili manuali"
        return "Strumenti di misura"

    # Elettroutensili Stanley già separati
    if "ELETTROUTENSILI A BATTERIA" in categoria:
        return "Utensili a batteria"

    if "ELETTROUTENSILI A FILO" in categoria:
        return "Utensili a filo"

    # Black+Decker e futuri cataloghi generici con categoria "ELETTROUTENSILI"
    if "ELETTROUTENSILI" in categoria:
        if (
            "AVVITATORE" in testo
            or "SVITAVVITA" in testo
            or "IMPULSI" in testo
            or "SOLO CORPO" in testo
            or "BATTERIA" in testo
            or "18V" in testo
            or "20V" in testo
            or "12V" in testo
            or "V20" in testo
            or "CORDLESS" in testo
            or "RICARICA" in testo
            or "RICARICABILE" in testo
            or "LITIO" in testo
            or "LI-ION" in testo
            or re.search(r"^(BDC|BCD|BDCD|BDCH|BCRT|BCS|BCN|SFMC|FMC)", codice)
        ):
            return "Utensili a batteria"

        if (
            "GIFTSET" in testo
            or "KIT ACCESSORI" in testo
            or "SET ACCESSORI" in testo
            or "ACCESSORI" in testo
            or re.search(r"^A", codice)
        ):
            return "Accessori"

        return "Utensili a filo"

    # Categorie future semplici
    if "VERNIC" in categoria:
        return "Vernici"
    if "IDRAUL" in categoria:
        return "Idraulica"
    if "ELETTRIC" in categoria:
        return "Elettrico"
    if "ANTINFORTUNISTICA" in categoria or "SICUREZZA" in categoria:
        return "Antinfortunistica"
    if "FISSAGGIO" in categoria:
        return "Fissaggio"

    return "Altro"

@api_router.post("/products/bulk")
async def bulk_import(products: List[ProductCreate]):
    inserted = 0
    for p in products:
        data = p.dict()
        data["categoria_standard"] = calcola_categoria_standard_import(data)
        prod = Product(**data)
        # upsert per barcode se presente, altrimenti per descrizione
        key = {"barcode": prod.barcode} if prod.barcode else {"descrizione": prod.descrizione}
        existing = await db.products.find_one(key, {"_id": 0})
        if existing:
            await db.products.update_one(
                {"id": existing["id"]},
                {"$set": {**prod.dict(), "id": existing["id"]}},
            )
        else:
            data = applica_marca_standard_al_prodotto(prod.dict())
    await db.products.insert_one(data)
    return {"inserted": inserted}


@api_router.post("/seed")
async def seed_demo():
    """Carica dati demo se DB vuoto."""
    count = await db.products.count_documents({})
    if count > 0:
        return {"seeded": False, "existing": count}
    demo = [
        {"barcode": "8001234500011", "descrizione": "Trapano avvitatore 18V", "marca": "Makita", "categoria": "Elettroutensili", "prezzo_acquisto": 89.0, "prezzo_vendita": 149.0, "quantita": 12, "fornitore": "Makita Italia", "foto": "https://images.unsplash.com/photo-1645651964715-d200ce0939cc?w=400", "note": "Con 2 batterie", "soglia_scorta": 3},
        {"barcode": "8001234500028", "descrizione": "Set chiavi combinate 6-22mm", "marca": "Beta", "categoria": "Utensili Manuali", "prezzo_acquisto": 45.0, "prezzo_vendita": 79.0, "quantita": 8, "fornitore": "Beta Utensili", "foto": "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400", "note": "12 pezzi", "soglia_scorta": 2},
        {"barcode": "8001234500035", "descrizione": "Viti TSP 4x40 (conf. 200pz)", "marca": "Fischer", "categoria": "Viti e Bulloni", "prezzo_acquisto": 6.5, "prezzo_vendita": 12.9, "quantita": 50, "fornitore": "Fischer", "foto": "https://images.unsplash.com/photo-1609010697446-11f2155278f0?w=400", "note": "", "soglia_scorta": 10},
        {"barcode": "8001234500042", "descrizione": "Tassello Fischer SX 8x40", "marca": "Fischer", "categoria": "Viti e Bulloni", "prezzo_acquisto": 0.15, "prezzo_vendita": 0.35, "quantita": 480, "fornitore": "Fischer", "foto": "", "note": "Vendita al pezzo", "soglia_scorta": 50},
        {"barcode": "8001234500059", "descrizione": "Martello carpentiere 500g", "marca": "Stanley", "categoria": "Utensili Manuali", "prezzo_acquisto": 12.0, "prezzo_vendita": 22.5, "quantita": 6, "fornitore": "Stanley Black & Decker", "foto": "https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?w=400", "note": "", "soglia_scorta": 2},
        {"barcode": "8001234500066", "descrizione": "Sega circolare 1400W", "marca": "Bosch", "categoria": "Elettroutensili", "prezzo_acquisto": 110.0, "prezzo_vendita": 189.0, "quantita": 2, "fornitore": "Bosch Professional", "foto": "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400", "note": "Lama 190mm", "soglia_scorta": 2},
        {"barcode": "8001234500073", "descrizione": "Metro a nastro 5m", "marca": "Stanley", "categoria": "Misurazione", "prezzo_acquisto": 4.5, "prezzo_vendita": 9.9, "quantita": 25, "fornitore": "Stanley Black & Decker", "foto": "", "note": "", "soglia_scorta": 5},
        {"barcode": "8001234500080", "descrizione": "Livella alluminio 60cm", "marca": "Stabila", "categoria": "Misurazione", "prezzo_acquisto": 18.0, "prezzo_vendita": 34.0, "quantita": 4, "fornitore": "Stabila", "foto": "", "note": "", "soglia_scorta": 2},
        {"barcode": "8001234500097", "descrizione": "Cacciavite a stella PH2", "marca": "Wera", "categoria": "Utensili Manuali", "prezzo_acquisto": 3.0, "prezzo_vendita": 7.5, "quantita": 30, "fornitore": "Wera", "foto": "", "note": "", "soglia_scorta": 5},
        {"barcode": "8001234500103", "descrizione": "Guanti da lavoro nitrile", "marca": "Singer", "categoria": "Sicurezza", "prezzo_acquisto": 2.0, "prezzo_vendita": 5.5, "quantita": 60, "fornitore": "Singer Safety", "foto": "", "note": "Taglia L", "soglia_scorta": 10},
        {"barcode": "8001234500110", "descrizione": "Occhiali protettivi", "marca": "3M", "categoria": "Sicurezza", "prezzo_acquisto": 4.0, "prezzo_vendita": 8.9, "quantita": 18, "fornitore": "3M", "foto": "", "note": "", "soglia_scorta": 5},
        {"barcode": "8001234500127", "descrizione": "Pinza universale 200mm", "marca": "Knipex", "categoria": "Utensili Manuali", "prezzo_acquisto": 14.0, "prezzo_vendita": 28.0, "quantita": 5, "fornitore": "Knipex", "foto": "", "note": "", "soglia_scorta": 2},
        {"barcode": "8001234500134", "descrizione": "Punte HSS set 19pz", "marca": "Bosch", "categoria": "Accessori Trapano", "prezzo_acquisto": 22.0, "prezzo_vendita": 42.0, "quantita": 7, "fornitore": "Bosch Professional", "foto": "", "note": "1-10mm", "soglia_scorta": 2},
        {"barcode": "8001234500141", "descrizione": "Nastro isolante nero 19mm", "marca": "3M", "categoria": "Elettricità", "prezzo_acquisto": 1.5, "prezzo_vendita": 3.5, "quantita": 90, "fornitore": "3M", "foto": "", "note": "20m", "soglia_scorta": 10},
        {"barcode": "8001234500158", "descrizione": "Lampada LED da lavoro 30W", "marca": "Osram", "categoria": "Elettricità", "prezzo_acquisto": 28.0, "prezzo_vendita": 49.0, "quantita": 3, "fornitore": "Osram", "foto": "", "note": "Ricaricabile", "soglia_scorta": 2},
        {"barcode": "8001234500165", "descrizione": "Silicone trasparente 280ml", "marca": "Mapei", "categoria": "Chimica edile", "prezzo_acquisto": 3.0, "prezzo_vendita": 7.9, "quantita": 22, "fornitore": "Mapei", "foto": "", "note": "", "soglia_scorta": 5},
    ]
    docs = [Product(**d).dict() for d in demo]
    docs = [applica_marca_standard_al_prodotto(doc) for doc in docs]
    await db.products.insert_many(docs)
    return {"seeded": True, "count": len(docs)}


@api_router.delete("/products")
async def delete_all():
    res = await db.products.delete_many({})
    return {"deleted": res.deleted_count}


@api_router.get("/meta")
async def meta():
    cats = await db.products.distinct("categoria")
    marche = await db.products.distinct("marca")
    fornitori = await db.products.distinct("fornitore")
    return {
        "categorie": sorted([c for c in cats if c]),
        "marche": sorted([m for m in marche if m]),
        "fornitori": sorted([f for f in fornitori if f]),
    }


@api_router.get("/statistiche")
async def stats():
    docs = await db.products.find({}, {"_id": 0}).to_list(5000)
    total_products = len(docs)
    total_pieces = sum(int(d.get("quantita", 0)) for d in docs)
    valore_magazzino = sum(
        float(d.get("prezzo_acquisto", 0)) * int(d.get("quantita", 0)) for d in docs
    )
    valore_vendita = sum(
        float(d.get("prezzo_vendita", 0)) * int(d.get("quantita", 0)) for d in docs
    )
    sotto_scorta = [
        d for d in docs if int(d.get("quantita", 0)) <= int(d.get("soglia_scorta", 5))
    ]
    # categorie counts
    cat_counts = {}
    for d in docs:
        c = d.get("categoria") or "Senza categoria"
        cat_counts[c] = cat_counts.get(c, 0) + 1
    # sales
    sales_docs = await db.sales.find({}, {"_id": 0}).to_list(10000)
    totale_vendite = sum(float(s.get("totale", 0)) for s in sales_docs)
    return {
        "total_products": total_products,
        "total_pieces": total_pieces,
        "valore_magazzino": round(valore_magazzino, 2),
        "valore_vendita_potenziale": round(valore_vendita, 2),
        "sotto_scorta_count": len(sotto_scorta),
        "sotto_scorta": [Product(**d).dict() for d in sotto_scorta[:20]],
        "categorie": [{"nome": k, "count": v} for k, v in sorted(cat_counts.items(), key=lambda x: -x[1])],
        "vendite_totali": round(totale_vendite, 2),
        "numero_vendite": len(sales_docs),
    }

@api_router.get("/stats/best-sellers")
async def best_sellers(limit: int = 20):
    # Legge le vendite e calcola i prodotti più venduti.
    # Non modifica prodotti, quantità, prezzi o immagini.

    pipeline = [
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.product_id",
                "quantita_venduta": {"$sum": "$items.quantita"},
                "totale_venduto": {
                    "$sum": {
                        "$multiply": ["$items.prezzo_vendita", "$items.quantita"]
                    }
                },
            }
        },
        {"$sort": {"quantita_venduta": -1}},
        {"$limit": limit},
    ]

    venduti = await db.sales.aggregate(pipeline).to_list(limit)

    if not venduti:
        return []

    product_ids = [v["_id"] for v in venduti]

    prodotti = await db.products.find(
        {"id": {"$in": product_ids}},
        {"_id": 0}
    ).to_list(length=limit)

    prodotti_by_id = {p.get("id"): p for p in prodotti}

    risultato = []

    for v in venduti:
        product_id = v["_id"]
        prodotto = prodotti_by_id.get(product_id)

        if not prodotto:
            continue

        prodotto["quantita_venduta"] = int(v.get("quantita_venduta", 0))
        prodotto["totale_venduto"] = round(float(v.get("totale_venduto", 0)), 2)

        risultato.append(prodotto)

    return risultato

@api_router.post("/sales", response_model=Sale)
async def create_sale(input: SaleCreate):
    if not input.items:
        raise HTTPException(status_code=400, detail="Carrello vuoto")
    totale = sum(it.prezzo_vendita * it.quantita for it in input.items)
    sale = Sale(items=input.items, totale=round(totale, 2))
    await db.sales.insert_one(sale.dict())
    # decrementa stock
    for it in input.items:
        await db.products.update_one(
            {"id": it.product_id},
            {"$inc": {"quantita": -it.quantita}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    return sale


@api_router.get("/sales", response_model=List[Sale])
async def list_sales(limit: int = 50):
    docs = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [Sale(**d) for d in docs]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
