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
    quantita: int = 0
    fornitore: str = ""
    foto: str = ""  # url o data:image base64
    note: str = ""
    soglia_scorta: int = 5
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProductCreate(BaseModel):
    barcode: str = ""
    codice_prodotto: str = ""
    descrizione: str
    marca: str = ""
    categoria: str = ""
    prezzo_acquisto: float = 0.0
    prezzo_vendita: float = 0.0
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
    marca: Optional[str] = None,
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
    if marca:
        query["marca"] = marca
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


@api_router.get("/products/{pid}", response_model=Product)
async def get_product(pid: str):
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return Product(**doc)


@api_router.post("/products", response_model=Product)
async def create_product(input: ProductCreate):
    prod = Product(**input.dict())
    await db.products.insert_one(prod.dict())
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
            await db.products.insert_one(prod.dict())
        inserted += 1
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


@api_router.get("/stats")
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
