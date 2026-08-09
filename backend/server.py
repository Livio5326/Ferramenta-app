import re
from fastapi import FastAPI, APIRouter, HTTPException, Body, UploadFile, File, Depends, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
import json
from datetime import datetime, timezone, date
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from import_fatture_service import (
    importa_fattura_xml_da_file,
    normalizza_nome_fornitore,
    riconduci_fornitore_standard,
    FORNITORI_SOLO_VERNICI,
)
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import timedelta
from bson import ObjectId
from pymongo import UpdateOne, ReturnDocument
from product_creator import ( crea_prodotto_da_fattura, ricava_marca_da_descrizione, ricava_categoria_da_descrizione )
from pricing import DEFAULT_MARKUPS, calculate_sale_price

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
if mongo_url.startswith("mongomock://"):
    try:
        from mongomock_motor import AsyncMongoMockClient
    except ImportError as exc:
        raise RuntimeError(
            "MONGO_URL usa mongomock, ma mongomock-motor non e installato"
        ) from exc
    client = AsyncMongoMockClient()
else:
    client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads") 
from fastapi import UploadFile, File, Form
import csv
import io
from bson import ObjectId

api_router = APIRouter(prefix="/api")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 30
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:19006",
    ).split(",")
    if origin.strip()
]

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET non configurata nell'ambiente del backend")


# ---------- Models ----------

class UserCreate(BaseModel):
    username: str
    password: str
    nome: str = ""
    ruolo: str = "dipendente"

class UserUpdate(BaseModel):
    username: str
    nome: str
    ruolo: str
    attivo: bool

class UserLogin(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    username: str
    nome: str = ""
    ruolo: str
    attivo: bool = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class InvoiceHistorySyncRequest(BaseModel):
    invoice: Dict[str, Any]
    products: List[Dict[str, Any]] = Field(default_factory=list)
    secondary_costs: List[Dict[str, Any]] = Field(default_factory=list)
    pending_products: List[Dict[str, Any]] = Field(default_factory=list)

def normalizza_username(username: str) -> str:
    return str(username or "").strip().lower()


def object_id_utente(user_id: str) -> ObjectId:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="ID utente non valido")
    return ObjectId(user_id)


def crea_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verifica_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def crea_access_token(user_id: str, username: str, ruolo: str) -> str:
    scadenza = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)

    payload = {
        "sub": user_id,
        "username": username,
        "ruolo": ruolo,
        "exp": scadenza,
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def serializza_utente(user: dict) -> dict:
    return {
        "id": str(user.get("_id")),
        "username": str(user.get("username", "")),
        "nome": str(user.get("nome", "")),
        "ruolo": str(user.get("ruolo", "dipendente")),
        "attivo": bool(user.get("attivo", True)),
    }


async def get_current_user(
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Autenticazione richiesta",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = payload.get("sub")

        if not user_id or not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=401,
                detail="Token non valido",
            )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Token non valido o scaduto",
        )

    user = await db.users.find_one({"_id": object_id_utente(user_id)})

    if not user or not user.get("attivo", True):
        raise HTTPException(
            status_code=401,
            detail="Utente non disponibile",
        )

    return user


@app.middleware("http")
async def require_api_authentication(request: Request, call_next):
    """Protegge tutte le API, eccetto gli endpoint necessari per accedere."""
    public_paths = {
        "/api/auth/login",
        "/api/auth/bootstrap-admin",
        "/api/health",
    }

    if (
        request.url.path.startswith("/api")
        and request.url.path not in public_paths
        and request.method != "OPTIONS"
    ):
        try:
            await get_current_user(request.headers.get("authorization"))
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers=exc.headers,
            )

    return await call_next(request)


async def require_admin(
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("ruolo") != "amministratore":
        raise HTTPException(
            status_code=403,
            detail="Permesso riservato all'amministratore",
        )

    return current_user


@api_router.get("/health")
async def health_check():
    try:
        await client.admin.command("ping")
    except Exception as exc:
        logging.error("MongoDB non disponibile durante health check: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database MongoDB non disponibile",
        ) from exc

    return {
        "status": "ok",
        "service": "Ferramenta Manager API",
        "database": "connected",
    }

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

async def carica_sinonimi_ricerca_db() -> dict:
    """
    Carica i sinonimi ricerca salvati nel database.
    Collection: search_synonyms
    Documento esempio:
    {
      "termine": "flex",
      "sinonimi": ["flessibile", "smerigliatrice"]
    }
    """
    sinonimi = {}

    try:
        docs = await db.search_synonyms.find({}).to_list(1000)
    except Exception:
        return sinonimi

    for d in docs:
        termine = str(d.get("termine", "")).strip().lower()
        lista = d.get("sinonimi", [])

        if not termine:
            continue

        if isinstance(lista, str):
            lista = [x.strip() for x in lista.split(",") if x.strip()]

        puliti = []
        for s in lista:
            s_norm = str(s).strip().lower()
            if s_norm and s_norm not in puliti:
                puliti.append(s_norm)

        if puliti:
            sinonimi[termine] = puliti

    return sinonimi


def applica_modalita_ricerca(query: dict, q: str | None, search_mode: str | None = "descrizione", sinonimi_extra: dict | None = None) -> dict:
    """
    Ricerca catalogo migliorata.

    - descrizione: parole in ordine libero + sinonimi base + sinonimi salvati nel DB
    - codice: cerca solo nel codice prodotto
    - barcode: cerca solo nel codice a barre, anche se salvato come testo o numero
    """
    if not q or not str(q).strip():
        return query

    testo = str(q).strip()
    mode = (search_mode or "descrizione").strip().lower()

    if mode == "codice":
        query["codice_prodotto"] = {"$regex": re.escape(testo), "$options": "i"}
        return query

    if mode == "barcode":
        solo_numeri = re.sub(r"\\D+", "", testo)

        condizioni_barcode = [
            {"barcode": testo},
            {"barcode": {"$regex": re.escape(testo), "$options": "i"}},
        ]

        if solo_numeri and solo_numeri != testo:
            condizioni_barcode.append({"barcode": solo_numeri})
            condizioni_barcode.append({"barcode": {"$regex": re.escape(solo_numeri), "$options": "i"}})

        if solo_numeri:
            try:
                condizioni_barcode.append({"barcode": int(solo_numeri)})
            except Exception:
                pass

        query["$or"] = condizioni_barcode
        return query

    sinonimi = {
        "flessibile": ["smerigliatrice", "smeriglio", "mola", "angolare"],
        "smerigliatrice": ["flessibile", "smeriglio", "mola", "angolare"],
        "mola": ["flessibile", "smerigliatrice", "smeriglio", "disco"],
        "trapano": ["avvitatore", "percussione", "elettroutensile"],
        "avvitatore": ["trapano", "batteria", "elettroutensile"],
        "tassello": ["tasselli", "fissaggio", "ancorante"],
        "tasselli": ["tassello", "fissaggio", "ancorante"],
        "vite": ["viti", "fissaggio"],
        "viti": ["vite", "fissaggio"],
        "bullone": ["bulloni", "dado", "dadi", "fissaggio"],
        "bulloni": ["bullone", "dado", "dadi", "fissaggio"],
        "dado": ["dadi", "bullone", "bulloni", "fissaggio"],
        "dadi": ["dado", "bullone", "bulloni", "fissaggio"],
        "silicone": ["sigillante", "mastice", "adesivo"],
        "sigillante": ["silicone", "mastice", "adesivo"],
        "colla": ["adesivo", "mastice", "sigillante"],
        "adesivo": ["colla", "mastice", "sigillante"],
        "metro": ["flessometro", "misura", "misuratore"],
        "flessometro": ["metro", "misura", "misuratore"],
        "livella": ["bolla", "misura"],
        "bolla": ["livella", "misura"],
        "chiave": ["chiavi", "utensile"],
        "chiavi": ["chiave", "utensile"],
        "pinza": ["pinze", "tenaglia", "utensile"],
        "pinze": ["pinza", "tenaglia", "utensile"],
        "martello": ["mazzetta", "mazza", "utensile"],
        "pittura": ["vernice", "vernici", "smalto"],
        "vernice": ["pittura", "vernici", "smalto"],
        "vernici": ["vernice", "pittura", "smalto"],
        "smalto": ["vernice", "vernici", "pittura"],
        "guanto": ["guanti", "antinfortunistica", "protezione"],
        "guanti": ["guanto", "antinfortunistica", "protezione"],
        "scarpa": ["scarpe", "antinfortunistica", "protezione"],
        "scarpe": ["scarpa", "antinfortunistica", "protezione"],
        "occhiale": ["occhiali", "protezione", "antinfortunistica"],
        "occhiali": ["occhiale", "protezione", "antinfortunistica"],
        "decespugliatore": ["giardino", "taglio", "verde"],
        "tagliaerba": ["giardino", "verde", "tosaerba"],
        "tosaerba": ["tagliaerba", "giardino", "verde"],
        "irrigazione": ["giardino", "tubo", "raccordo"],
        "tubo": ["irrigazione", "raccordo", "giardino"],
        "raccordo": ["raccordi", "tubo", "irrigazione", "idraulica"],
        "raccordi": ["raccordo", "tubo", "irrigazione", "idraulica"],
    }

    # Aggiunge/integra sinonimi salvati nel database
    if sinonimi_extra:
        for termine, lista in sinonimi_extra.items():
            termine_norm = str(termine).strip().lower()
            if not termine_norm:
                continue

            sinonimi.setdefault(termine_norm, [])

            for s in lista:
                s_norm = str(s).strip().lower()
                if s_norm and s_norm not in sinonimi[termine_norm]:
                    sinonimi[termine_norm].append(s_norm)

    parole_originali = [p.strip().lower() for p in testo.split() if p.strip()]

    if not parole_originali:
        return query

    condizioni = []

    for parola in parole_originali:
        gruppo = [parola]

        if parola in sinonimi:
            gruppo.extend(sinonimi[parola])

        gruppo_pulito = []
        for g in gruppo:
            if g and g not in gruppo_pulito:
                gruppo_pulito.append(g)

        alternative = []

        for termine in gruppo_pulito:
            termine_regex = re.escape(termine)
            alternative.extend([
                {"descrizione": {"$regex": termine_regex, "$options": "i"}},
                {"marca": {"$regex": termine_regex, "$options": "i"}},
                {"marca_standard": {"$regex": termine_regex, "$options": "i"}},
                {"codice_prodotto": {"$regex": termine_regex, "$options": "i"}},
                {"categoria": {"$regex": termine_regex, "$options": "i"}},
                {"categoria_standard": {"$regex": termine_regex, "$options": "i"}},
            ])

        condizioni.append({"$or": alternative})

    query["$and"] = query.get("$and", []) + condizioni

    return query


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


async def _crea_anteprima_promo(rows, code_overrides=None):
    risultati = []
    letti = 0
    code_overrides = code_overrides or {}
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

        codice_originale = codice
        codice_override = ""
        if codice and isinstance(code_overrides, dict):
            codice_override = str(code_overrides.get(codice, "") or "").strip()
            if codice_override:
                codice = codice_override

        prodotto = None
        match_usato = ""

        if codice:
            prodotto = await db.products.find_one({"codice_prodotto": codice}, {"_id": 0})
            if prodotto:
                match_usato = "codice_prodotto_override" if codice_override else "codice_prodotto"

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
            "codice_prodotto": codice_originale,
            "codice_usato": codice,
            "codice_override": codice_override,
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


# ---------- Auth e utenti ----------

@api_router.post("/auth/bootstrap-admin", response_model=TokenResponse)
async def bootstrap_admin(data: UserCreate):
    utenti_presenti = await db.users.count_documents({})

    if utenti_presenti > 0:
        raise HTTPException(
            status_code=403,
            detail="Amministratore iniziale già configurato",
        )

    username = normalizza_username(data.username)
    nome = data.nome.strip()

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Lo username deve contenere almeno 3 caratteri",
        )

    if len(data.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="La password deve contenere almeno 6 caratteri",
        )

    user = {
        "username": username,
        "nome": nome,
        "password_hash": crea_password_hash(data.password),
        "ruolo": "amministratore",
        "attivo": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id

    token = crea_access_token(
        str(result.inserted_id),
        username,
        "amministratore",
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serializza_utente(user),
    }

@api_router.post("/auth/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    if not verifica_password(
        data.current_password,
        current_user.get("password_hash", ""),
    ):
        raise HTTPException(
            status_code=400,
            detail="Password attuale non corretta",
        )

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="La nuova password deve contenere almeno 8 caratteri",
        )

    nuovo_hash = crea_password_hash(data.new_password)

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "password_hash": nuovo_hash,
            }
        },
    )

    return {"message": "Password aggiornata con successo"}

class ProfileUpdateRequest(BaseModel):
    nome: str
    username: str


@api_router.put("/auth/profile", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    username = normalizza_username(data.username)
    nome = data.nome.strip()

    existing = await db.users.find_one({
        "username": username,
        "_id": {"$ne": current_user["_id"]},
    })

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Username già esistente",
        )

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "nome": nome,
                "username": username,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    user = await db.users.find_one({"_id": current_user["_id"]})
    return serializza_utente(user)


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    username = normalizza_username(data.username)

    user = await db.users.find_one({"username": username})

    if not user or not verifica_password(
        data.password,
        user.get("password_hash", ""),
    ):
        raise HTTPException(
            status_code=401,
            detail="Username o password errati",
        )

    if not user.get("attivo", True):
        raise HTTPException(
            status_code=403,
            detail="Utente disattivato",
        )

    token = crea_access_token(
        str(user["_id"]),
        user["username"],
        user.get("ruolo", "dipendente"),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serializza_utente(user),
    }


@api_router.get("/auth/me", response_model=UserResponse)
async def auth_me(
    current_user: dict = Depends(get_current_user),
):
    return serializza_utente(current_user)


@api_router.get("/users", response_model=List[UserResponse])
async def list_users(
    _: dict = Depends(require_admin),
):
    users = await db.users.find({}).sort("username", 1).to_list(length=None)
    return [serializza_utente(user) for user in users]


@api_router.post("/users", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    _: dict = Depends(require_admin),
):
    username = normalizza_username(data.username)
    nome = data.nome.strip()
    ruolo = data.ruolo.strip().lower()

    if len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Lo username deve contenere almeno 3 caratteri",
        )

    if len(data.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="La password deve contenere almeno 6 caratteri",
        )

    if ruolo not in {"amministratore", "dipendente"}:
        raise HTTPException(
            status_code=400,
            detail="Ruolo non valido",
        )

    existing = await db.users.find_one({"username": username})

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Username già esistente",
        )

    user = {
        "username": username,
        "nome": nome,
        "password_hash": crea_password_hash(data.password),
        "ruolo": ruolo,
        "attivo": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id

    return serializza_utente(user)

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    _: dict = Depends(require_admin),
):
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Utente non trovato",
        )

    return serializza_utente(user)


@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    _: dict = Depends(require_admin),
):
    username = normalizza_username(data.username)
    nome = data.nome.strip()
    ruolo = data.ruolo.strip().lower()

    if ruolo not in {"amministratore", "dipendente"}:
        raise HTTPException(
            status_code=400,
            detail="Ruolo non valido",
        )

    existing = await db.users.find_one(
        {
            "username": username,
            "_id": {"$ne": object_id_utente(user_id)},
        }
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Username già esistente",
        )

    await db.users.update_one(
        {"_id": object_id_utente(user_id)},
        {
            "$set": {
                "username": username,
                "nome": nome,
                "ruolo": ruolo,
                "attivo": data.attivo,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    user = await db.users.find_one({"_id": object_id_utente(user_id)})

    return serializza_utente(user)

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
):
    if str(current_user["_id"]) == user_id:
        raise HTTPException(
            status_code=400,
            detail="Non puoi eliminare il tuo account.",
        )

    user = await db.users.find_one({"_id": object_id_utente(user_id)})

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Utente non trovato",
        )

    await db.users.delete_one({"_id": object_id_utente(user_id)})

    return {"message": "Utente eliminato"}

@api_router.post("/products/import-promo-prices/preview")
async def preview_import_promo_prices(
    file: UploadFile = File(...),
    code_overrides: str = Form("{}"),
):
    content = await file.read()
    rows = _leggi_file_promo_sync(file.filename, content)

    try:
        overrides = json.loads(code_overrides or "{}")
        if not isinstance(overrides, dict):
            overrides = {}
    except Exception:
        overrides = {}

    return await _crea_anteprima_promo(rows, overrides)


@api_router.post("/products/import-promo-prices/confirm")
async def confirm_import_promo_prices(
    file: UploadFile = File(...),
    promo_nome: str = Form(...),
    promo_inizio: str = Form(""),
    promo_fine: str = Form(""),
    code_overrides: str = Form("{}"),
):
    content = await file.read()
    rows = _leggi_file_promo_sync(file.filename, content)

    try:
        overrides = json.loads(code_overrides or "{}")
        if not isinstance(overrides, dict):
            overrides = {}
    except Exception:
        overrides = {}

    anteprima = await _crea_anteprima_promo(rows, overrides)

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


@api_router.get("/products/promos")
async def list_promo_prices():
    docs = await db.products.find(
        {
            "prezzo_promo": {"$ne": None},
            "promo_nome": {"$ne": ""}
        },
        {"_id": 0}
    ).sort("promo_nome", 1).to_list(10000)

    prodotti = []
    riepilogo = {}

    for d in docs:
        prezzo_promo = d.get("prezzo_promo")
        if prezzo_promo is None:
            continue

        promo_nome = d.get("promo_nome") or "Promozione senza nome"
        promo_attiva = bool(d.get("promo_attiva", False))

        prodotti.append({
            "id": d.get("id"),
            "codice_prodotto": d.get("codice_prodotto", ""),
            "barcode": d.get("barcode", ""),
            "descrizione": d.get("descrizione", ""),
            "marca": d.get("marca", ""),
            "marca_standard": d.get("marca_standard", ""),
            "fornitore": d.get("fornitore", ""),
            "prezzo_vendita": d.get("prezzo_vendita", 0),
            "prezzo_promo": prezzo_promo,
            "promo_attiva": promo_attiva,
            "promo_nome": promo_nome,
            "promo_inizio": d.get("promo_inizio", ""),
            "promo_fine": d.get("promo_fine", ""),
            "ultimo_aggiornamento_promo": d.get("ultimo_aggiornamento_promo", ""),
        })

        if promo_nome not in riepilogo:
            riepilogo[promo_nome] = {
                "promo_nome": promo_nome,
                "prodotti": 0,
                "prodotti_attivi": 0,
                "attiva": False,
                "promo_inizio": d.get("promo_inizio", ""),
                "promo_fine": d.get("promo_fine", ""),
            }

        riepilogo[promo_nome]["prodotti"] += 1
        if promo_attiva:
            riepilogo[promo_nome]["prodotti_attivi"] += 1
            riepilogo[promo_nome]["attiva"] = True

    return {
        "totale_prodotti": len(prodotti),
        "riepilogo": list(riepilogo.values()),
        "prodotti": prodotti,
    }


@api_router.post("/products/promos/{promo_nome}/activate")
async def activate_single_promo(promo_nome: str):
    now = datetime.now(timezone.utc).isoformat()
    res = await db.products.update_many(
        {"promo_nome": promo_nome, "prezzo_promo": {"$ne": None}},
        {"$set": {
            "promo_attiva": True,
            "ultimo_aggiornamento_promo": now,
            "updated_at": now,
        }}
    )

    return {
        "ok": True,
        "promo_nome": promo_nome,
        "attivati": res.modified_count,
    }


@api_router.post("/products/promos/{promo_nome}/deactivate")
async def deactivate_single_promo(promo_nome: str):
    now = datetime.now(timezone.utc).isoformat()
    res = await db.products.update_many(
        {"promo_nome": promo_nome},
        {"$set": {
            "promo_attiva": False,
            "ultimo_aggiornamento_promo": now,
            "updated_at": now,
        }}
    )

    return {
        "ok": True,
        "promo_nome": promo_nome,
        "disattivati": res.modified_count,
    }


@api_router.delete("/products/promos/{promo_nome}")
async def delete_single_promo(promo_nome: str):
    now = datetime.now(timezone.utc).isoformat()
    res = await db.products.update_many(
        {"promo_nome": promo_nome},
        {"$set": {
            "prezzo_promo": None,
            "promo_attiva": False,
            "promo_nome": "",
            "promo_inizio": "",
            "promo_fine": "",
            "ultimo_aggiornamento_promo": now,
            "updated_at": now,
        }}
    )

    return {
        "ok": True,
        "promo_nome": promo_nome,
        "eliminati": res.modified_count,
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




@api_router.get("/products/standard-brands")
async def get_standard_brands():
    """
    Restituisce l'elenco delle marche standard presenti nei prodotti.
    Deve stare prima di /products/{pid}, altrimenti FastAPI interpreta
    standard-brands come ID prodotto.
    """
    brands = await db.products.distinct("marca_standard")

    clean = []
    for b in brands:
        if b is None:
            continue
        nome = str(b).strip()
        if nome:
            clean.append(nome)

    return sorted(list(set(clean)), key=lambda x: x.lower())



@api_router.get("/brands/standard")
async def get_standard_brands():
    """
    Elenco marche standard per i filtri catalogo.
    """
    brands = await db.products.distinct("marca_standard")

    clean = []
    for b in brands:
        if b is None:
            continue
        nome = str(b).strip()
        if nome:
            clean.append(nome)

    return sorted(list(set(clean)), key=lambda x: x.lower())


@api_router.get("/products/brands")
async def get_product_brands():
    brands_set = set()

    cursor = db.products.find(
        {},
        {
            "marca": 1,
            "marca_standard": 1,
        }
    )

    async for p in cursor:
        marca_standard = str(p.get("marca_standard") or "").strip()
        marca = str(p.get("marca") or "").strip()

        if marca_standard and marca_standard.lower() not in ["da classificare", "nessuna", "null", "undefined"]:
            brands_set.add(marca_standard)

        if marca and marca.lower() not in ["da classificare", "nessuna", "null", "undefined"]:
            brands_set.add(marca)

    brands = sorted(brands_set, key=lambda x: x.lower())

    return {
        "brands": brands,
        "total": len(brands),
    }


@api_router.get("/products/page")
async def get_products_page(
    q: str | None = None,
    search_mode: str | None = "descrizione",
    categoria: str | None = None,
    marca_standard: str | None = None,
    da_completare: bool = False,
    disponibile: bool | None = None,
    prezzo_min: Optional[float] = None,
    prezzo_max: Optional[float] = None,
    limit: int = 30,
    skip: int = 0,
):
    """
    Catalogo paginato usato dal frontend.
    """
    query = {}
    and_filters = []

    if categoria:
        and_filters.append({
            "$or": [
                {"categoria_standard": categoria},
                {"categoria": categoria},
            ]
        })

    if marca_standard:
        marca_pulita = marca_standard.strip()

        if marca_pulita.lower() in ["black & decker", "black+decker", "black decker"]:
            marca_regex = re.compile(r"black\s*(?:&|\+)?\s*decker", re.IGNORECASE)
        else:
            marca_regex = re.compile("^" + re.escape(marca_pulita) + "$", re.IGNORECASE)

        and_filters.append({
            "$or": [
                {"marca_standard": marca_regex},
                {"marca": marca_regex},
            ]
        })

    if da_completare:
        and_filters.append({
            "$or": [
                {"prezzo_vendita": {"$in": [0, None, ""]}},
                {"prezzo_vendita": {"$exists": False}},
                {"barcode": {"$in": ["", None]}},
                {"barcode": {"$exists": False}},
                {"foto": {"$in": ["", None]}},
                {"foto": {"$exists": False}},
                {"categoria_standard": {"$in": ["", None, "Da classificare"]}},
                {"categoria_standard": {"$exists": False}},
            ]
        })
    if disponibile is True:
        query["quantita"] = {"$gt": 0}

    sinonimi_db = await carica_sinonimi_ricerca_db()
    query = applica_modalita_ricerca(query, q, search_mode, sinonimi_db)
     
    if prezzo_min is not None or prezzo_max is not None:
        condizione_prezzo = {}

        if prezzo_min is not None:
            condizione_prezzo["$gte"] = prezzo_min

        if prezzo_max is not None:
            condizione_prezzo["$lte"] = prezzo_max

        if query:
            query = {
                "$and": [
                    query,
                    {"prezzo_vendita": condizione_prezzo}
                ]
            }
        else:
            query["prezzo_vendita"] = condizione_prezzo


    limit = max(1, min(int(limit or 30), 100))
    skip = max(0, int(skip or 0))

    if and_filters:
        if "$and" in query:
            query["$and"].extend(and_filters)
        elif query:
            query = {
                "$and": [
                    query,
                    *and_filters,
                ]
            }
        else:
            query = {
                "$and": and_filters
            }

    total = await db.products.count_documents(query)

    docs = await db.products.find(query).skip(skip).limit(limit).to_list(limit)

    items = []
    for p in docs:
        p["id"] = str(p.get("id") or p.get("_id") or "")
        p.pop("_id", None)
        items.append(p)

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
        "hasMore": skip + len(items) < total,
    }



@api_router.get("/search-synonyms")
async def list_search_synonyms():
    """
    Lista sinonimi ricerca modificabili dall'app.
    """
    docs = await db.search_synonyms.find({}, {"_id": 0}).sort("termine", 1).to_list(1000)

    result = []
    for d in docs:
        termine = str(d.get("termine", "")).strip().lower()
        sinonimi = d.get("sinonimi", [])

        if isinstance(sinonimi, str):
            sinonimi = [x.strip() for x in sinonimi.split(",") if x.strip()]

        result.append({
            "termine": termine,
            "sinonimi": sinonimi,
        })

    return result


@api_router.post("/search-synonyms")
async def save_search_synonym(payload: dict = Body(...)):
    """
    Crea o aggiorna una riga sinonimi.
    Body:
    {
      "termine": "flex",
      "sinonimi": ["flessibile", "smerigliatrice"]
    }
    """
    termine = str(payload.get("termine", "")).strip().lower()

    if not termine:
        raise HTTPException(status_code=400, detail="Termine obbligatorio")

    sinonimi = payload.get("sinonimi", [])

    if isinstance(sinonimi, str):
        sinonimi = [x.strip() for x in sinonimi.split(",") if x.strip()]

    puliti = []
    for s in sinonimi:
        s_norm = str(s).strip().lower()
        if s_norm and s_norm != termine and s_norm not in puliti:
            puliti.append(s_norm)

    await db.search_synonyms.update_one(
        {"termine": termine},
        {
            "$set": {
                "termine": termine,
                "sinonimi": puliti,
            }
        },
        upsert=True
    )

    return {
        "termine": termine,
        "sinonimi": puliti,
    }


@api_router.delete("/search-synonyms/{termine}")
async def delete_search_synonym(termine: str):
    """
    Elimina una riga sinonimi.
    """
    termine_norm = str(termine).strip().lower()

    if not termine_norm:
        raise HTTPException(status_code=400, detail="Termine obbligatorio")

    res = await db.search_synonyms.delete_one({"termine": termine_norm})

    return {
        "deleted": res.deleted_count,
        "termine": termine_norm,
    }


@api_router.post("/invoices/upload-xml")
async def upload_invoice_xml(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome file mancante")

    if not file.filename.lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="Carica solo file XML")

    upload_dir = Path("import_fatture")
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    destination = upload_dir / safe_name

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="File XML vuoto")

    with open(destination, "wb") as f:
        f.write(content)

    return {
        "ok": True,
        "filename": safe_name,
        "path": str(destination),
        "message": "Fattura XML caricata correttamente"
    }



async def add_fornitore_standard_if_missing(fornitore: str | None):
    """
    Aggiunge il fornitore alla lista standard solo dopo averlo ricondotto.
    Così DE SANTIS NICOLA S.R.L. non crea un doppione se esiste già De Santis.
    """
    fornitore = str(fornitore or "").strip()
    if not fornitore:
        return ""

    fornitore_standard = await riconduci_fornitore_standard(db, fornitore)

    if not fornitore_standard:
        return ""

    await db.standard_lists.update_one(
        {"tipo": "fornitori"},
        {"$addToSet": {"items": fornitore_standard}},
        upsert=True
    )

    return fornitore_standard


def parse_invoice_report(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)

    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (TypeError, ValueError, json.JSONDecodeError):
            return {}

    return {}


def serialize_invoice_history(item: Dict[str, Any]) -> Dict[str, Any]:
    report = parse_invoice_report(item.get("report"))
    secondary_costs = item.get("costi_secondari_fornitori")

    if isinstance(secondary_costs, str):
        try:
            secondary_costs = json.loads(secondary_costs)
        except (TypeError, ValueError, json.JSONDecodeError):
            secondary_costs = []

    if not isinstance(secondary_costs, list):
        secondary_costs = report.get("costi_secondari_fornitori", [])

    return {
        "chiave_import": str(item.get("chiave_import", "")),
        "numero": str(item.get("numero", "")),
        "data": str(item.get("data", "")),
        "partita_iva": str(item.get("partita_iva", "")),
        "denominazione": str(item.get("denominazione", "")),
        "data_import": str(item.get("data_import", "")),
        "righe_fattura": int(item.get("righe_fattura", 0) or 0),
        "righe_fattura_originali": int(
            item.get("righe_fattura_originali", 0) or 0
        ),
        "prodotti_aggiornati": int(item.get("prodotti_aggiornati", 0) or 0),
        "barcode_non_trovati": int(item.get("barcode_non_trovati", 0) or 0),
        "righe_saltate": int(item.get("righe_saltate", 0) or 0),
        "costi_secondari_fornitori": secondary_costs,
        "totale_costi_secondari_fornitori": float(
            item.get("totale_costi_secondari_fornitori", 0) or 0
        ),
        "registrata_manualmente": bool(item.get("registrata_manualmente", False)),
        "sincronizzata": True,
    }


@api_router.post("/invoices/sync")
async def sync_invoice_history(
    payload: InvoiceHistorySyncRequest,
    current_user: dict = Depends(get_current_user),
):
    invoice = payload.invoice
    import_key = str(invoice.get("chiave_import") or "").strip()

    if not import_key:
        raise HTTPException(status_code=400, detail="Chiave fattura mancante")

    if len(payload.products) > 5000 or len(payload.pending_products) > 5000:
        raise HTTPException(status_code=400, detail="Troppe righe nella fattura")

    existing = await db.invoice_imports.find_one({"chiave_import": import_key})
    existing_report = parse_invoice_report((existing or {}).get("report"))
    report = parse_invoice_report(invoice.get("report"))

    existing_products = existing_report.get("prodotti_letti", [])
    products = payload.products
    if isinstance(existing_products, list) and len(existing_products) > len(products):
        products = existing_products

    existing_costs = (existing or {}).get("costi_secondari_fornitori")
    if not isinstance(existing_costs, list):
        existing_costs = existing_report.get("costi_secondari_fornitori", [])
    secondary_costs = payload.secondary_costs or (
        existing_costs if isinstance(existing_costs, list) else []
    )

    report["prodotti_letti"] = products
    report["costi_secondari_fornitori"] = secondary_costs
    report["non_trovati"] = payload.pending_products

    total_secondary_costs = round(
        sum(float(cost.get("importo", 0) or 0) for cost in secondary_costs),
        2,
    )
    now = datetime.now(timezone.utc).isoformat()

    history = {
        "chiave_import": import_key,
        "numero": str(invoice.get("numero") or "").strip(),
        "data": str(invoice.get("data") or "").strip(),
        "partita_iva": str(invoice.get("partita_iva") or "").strip(),
        "denominazione": str(invoice.get("denominazione") or "").strip(),
        "data_import": str(
            (existing or {}).get("data_import") or invoice.get("data_import") or now
        ),
        "righe_fattura": max(
            int((existing or {}).get("righe_fattura", 0) or 0),
            int(invoice.get("righe_fattura", len(products)) or 0),
        ),
        "righe_fattura_originali": int(
            invoice.get("righe_fattura_originali", len(products)) or 0
        ),
        "prodotti_aggiornati": max(
            int((existing or {}).get("prodotti_aggiornati", 0) or 0),
            int(invoice.get("prodotti_aggiornati", 0) or 0),
        ),
        "barcode_non_trovati": int(invoice.get("barcode_non_trovati", 0) or 0),
        "righe_saltate": int(invoice.get("righe_saltate", 0) or 0),
        "costi_secondari_fornitori": secondary_costs,
        "totale_costi_secondari_fornitori": total_secondary_costs,
        "report": json.dumps(report, ensure_ascii=False),
        "source": "app_sync",
        "updated_at": now,
        "ultimo_sync_da": {
            "user_id": str(current_user.get("_id", "")),
            "username": str(current_user.get("username", "")),
        },
    }

    await db.invoice_imports.update_one(
        {"chiave_import": import_key},
        {
            "$set": history,
            "$setOnInsert": {
                "created_at": now,
                "imported_by": history["ultimo_sync_da"],
            },
        },
        upsert=True,
    )

    await db.pending_invoice_products.delete_many({"chiave_import": import_key})

    for pending in payload.pending_products:
        pending_line = {
            **pending,
            "chiave_import": import_key,
            "numero_fattura": history["numero"],
            "fornitore": history["denominazione"],
            "partita_iva": history["partita_iva"],
            "updated_at": now,
        }
        await db.pending_invoice_products.update_one(
            {
                "chiave_import": import_key,
                "linea": str(pending.get("linea") or ""),
                "barcode": str(pending.get("barcode") or ""),
                "codice_fornitore": str(pending.get("codice_fornitore") or ""),
            },
            {
                "$set": pending_line,
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

    stored = await db.invoice_imports.find_one({"chiave_import": import_key})
    return {
        "ok": True,
        "created": existing is None,
        "invoice": serialize_invoice_history(stored or history),
    }


@api_router.get("/invoices/exists")
async def invoice_history_exists(chiave_import: str):
    item = await db.invoice_imports.find_one({"chiave_import": chiave_import})
    return {
        "exists": item is not None,
        "invoice": serialize_invoice_history(item) if item else None,
    }


@api_router.get("/invoices/products")
async def get_shared_invoice_products(chiave_import: str):
    item = await db.invoice_imports.find_one({"chiave_import": chiave_import})

    if not item:
        raise HTTPException(status_code=404, detail="Fattura non trovata")

    report = parse_invoice_report(item.get("report"))
    products = report.get("prodotti_letti", [])
    return {
        "items": products if isinstance(products, list) else [],
        "total": len(products) if isinstance(products, list) else 0,
    }


@api_router.post("/invoices/import-xml")
async def import_invoice_xml(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome file mancante")

    if not file.filename.lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="Carica solo file XML")

    upload_dir = ROOT_DIR / "import_fatture"
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    destination = upload_dir / safe_name

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="File XML vuoto")

    with open(destination, "wb") as f:
        f.write(content)

    risultato = await importa_fattura_xml_da_file(db, destination)

    if risultato is None:
        raise HTTPException(
            status_code=500,
            detail="Import fattura non ha restituito nessun risultato. Controlla import_fatture_service.py: manca o è rientrato male il return finale."
        )

    return {
        "ok": risultato.get("ok", False),
        "filename": safe_name,
        "path": str(destination),
        **risultato,
    }

@api_router.get("/invoices/missing-products")
async def get_missing_products(file_path: str):
    path = Path(file_path)

    if not path.exists():
        raise HTTPException(status_code=404, detail="File prodotti non trovati non esistente")

    if not str(path).endswith(".csv"):
        raise HTTPException(status_code=400, detail="File non valido")

    import csv

    items = []

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for index, row in enumerate(reader):
            barcode = str(row.get("barcode", "")).strip()
            codice_fornitore = str(row.get("codice_fornitore", "")).strip()
            descrizione = str(row.get("descrizione", "")).strip()
            quantita = str(row.get("quantita", "")).strip()
            prezzo_unitario = str(row.get("prezzo_unitario", "")).strip()

            if not barcode and not descrizione:
                continue

            items.append({
                "id": f"{barcode}_{index}",
                "barcode": barcode,
                "codice_fornitore": codice_fornitore,
                "descrizione": descrizione,
                "quantita": quantita,
                "prezzo_unitario": prezzo_unitario,
                "selected": True,
            })

    return {
        "items": items,
        "total": len(items)
    }


@api_router.get("/invoices/imports")
async def list_invoice_imports():
    items = []

    cursor = db.invoice_imports.find(
        {},
        {"_id": 0}
    ).sort("data_import", -1).limit(50)

    async for item in cursor:
        items.append(serialize_invoice_history(item))

    return {
        "items": items,
        "total": len(items)
    }


@api_router.get("/invoices/pending-products")
async def list_pending_invoice_products(numero_fattura: str | None = None):
    query_parts = []

    if numero_fattura:
        numero_fattura = str(numero_fattura).strip()
        query_parts.append({
            "$or": [
                {"numero_fattura": numero_fattura},
                {"fattura": numero_fattura},
                {"numero": numero_fattura},
            ]
        })

    # Mostra solo i prodotti ancora davvero non trovati/aperti.
    query_parts.append({
        "$and": [
            {"importato": {"$ne": True}},
            {"risolto": {"$ne": True}},
            {"registrato_manualmente": {"$ne": True}},
            {"da_importare": {"$ne": False}},
            {"stato": {"$nin": ["importato", "risolto", "creato"]}},
            {"status": {"$nin": ["importato", "risolto", "creato"]}},
        ]
    })

    query = {"$and": query_parts} if query_parts else {}

    docs = await db.pending_invoice_products.find(query).to_list(5000)

    results = []
    for d in docs:
        d["id"] = str(d.get("id") or d.get("_id"))
        d["_id"] = str(d.get("_id"))
        results.append(d)

    return results


@api_router.post("/invoices/reconcile-all")
async def reconcile_all_invoice_imports():
    fatture = await db.invoice_imports.find({}).to_list(5000)

    results = []

    for f in fatture:
        numero = str(
            f.get("numero_fattura")
            or f.get("fattura")
            or f.get("numero")
            or ""
        ).strip()

        if not numero:
            continue

        results.append(await aggiorna_conteggi_fattura_import(numero))

    return {
        "ok": True,
        "fatture_ricontrollate": len(results),
        "results": results,
    }


class CreatePendingProductsRequest(BaseModel):
    items: list[dict] = []


async def mark_pending_item_imported_from_invoice_item(item: dict, prodotto: dict | None = None):
    """
    Marca come importata/risolta la riga pending collegata a un prodotto creato
    o aggiornato manualmente dalla pagina Fornitori.
    Cerca per numero fattura + barcode/codice/descrizione.
    """
    numero_fattura = str(item.get("numero_fattura") or item.get("fattura") or item.get("numero") or "").strip()
    descrizione = str(item.get("descrizione") or "").strip()
    barcode = str(item.get("barcode") or "").strip()
    codice = str(
        item.get("codice_prodotto")
        or item.get("codice")
        or item.get("codice_fornitore")
        or ""
    ).strip()

    if prodotto:
        barcode = barcode or str(prodotto.get("barcode") or "").strip()
        codice = codice or str(
            prodotto.get("codice_prodotto")
            or prodotto.get("codice")
            or prodotto.get("codice_fornitore")
            or ""
        ).strip()
        descrizione = descrizione or str(prodotto.get("descrizione") or "").strip()

    condizioni = []

    base = {}
    if numero_fattura:
        base["numero_fattura"] = numero_fattura

    if barcode:
        q = dict(base)
        q["barcode"] = barcode
        condizioni.append(q)

    if codice:
        q = dict(base)
        q["$or"] = [
            {"codice_prodotto": codice},
            {"codice": codice},
            {"codice_fornitore": codice},
        ]
        condizioni.append(q)

    if descrizione:
        q = dict(base)
        q["descrizione"] = descrizione
        condizioni.append(q)

    if not condizioni:
        return 0

    res = await db.pending_invoice_products.update_many(
        {"$or": condizioni},
        {
            "$set": {
                "stato": "importato",
                "status": "importato",
                "importato": True,
                "risolto": True,
                "da_importare": False,
                "registrato_manualmente": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )

    if numero_fattura:
        await aggiorna_conteggi_fattura_import(numero_fattura)

    return res.modified_count


async def aggiorna_conteggi_fattura_import(numero_fattura: str):
    """
    Aggiorna lo storico fattura contando davvero:
    - importati/risolti
    - ancora non trovati
    """
    numero_fattura = str(numero_fattura or "").strip()
    if not numero_fattura:
        return

    importati = await db.pending_invoice_products.count_documents({
        "numero_fattura": numero_fattura,
        "$or": [
            {"importato": True},
            {"risolto": True},
            {"registrato_manualmente": True},
            {"stato": {"$in": ["importato", "risolto", "creato"]}},
            {"status": {"$in": ["importato", "risolto", "creato"]}},
        ]
    })

    aperti = await db.pending_invoice_products.count_documents({
        "numero_fattura": numero_fattura,
        "$and": [
            {"importato": {"$ne": True}},
            {"risolto": {"$ne": True}},
            {"registrato_manualmente": {"$ne": True}},
            {"da_importare": {"$ne": False}},
            {"stato": {"$nin": ["importato", "risolto", "creato"]}},
            {"status": {"$nin": ["importato", "risolto", "creato"]}},
        ]
    })

    await db.invoice_imports.update_many(
        {
            "$or": [
                {"numero_fattura": numero_fattura},
                {"fattura": numero_fattura},
                {"numero": numero_fattura},
            ]
        },
        {
            "$set": {
                "prodotti_importati": importati,
                "prodotti_aggiornati": importati,
                "aggiornati": importati,
                "updated_count": importati,

                "barcode_non_trovati": aperti,
                "non_trovati": aperti,
                "prodotti_non_trovati": aperti,
                "not_found": aperti,

                "registrata_manualmente": importati > 0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )


@api_router.post("/invoices/pending-products/create")
async def create_pending_invoice_products(payload: CreatePendingProductsRequest):
    creati = 0
    saltati = 0
    gia_presenti = 0

    created_products = []

    for item in payload.items:
        descrizione = str(item.get("descrizione", "")).strip()
        barcode = str(item.get("barcode", "")).strip()
        codice_fornitore = str(item.get("codice_fornitore", "")).strip()
        quantita = int(float(str(item.get("quantita", 0) or 0).replace(",", ".")))
        prezzo_acquisto = float(str(item.get("prezzo_unitario", 0) or 0).replace(",", "."))
        fornitore_originale = str(
            item.get("fornitore")
            or item.get("denominazione")
            or item.get("ragione_sociale")
            or item.get("cedente")
            or item.get("supplier")
            or ""
        ).strip()

        fornitore_ricavato = await riconduci_fornitore_standard(db, fornitore_originale)

        # Stessa logica dell'import automatico: se la descrizione non fa
        # riconoscere una marca vera, usa il fornitore gia' ricondotto; per
        # i fornitori che vendono solo vernici, la categoria e' sempre Vernici.
        marca_ricavata = ricava_marca_da_descrizione(descrizione) or fornitore_ricavato
        if fornitore_ricavato.strip().lower() in FORNITORI_SOLO_VERNICI:
            categoria_ricavata = "Vernici"
        else:
            categoria_ricavata = ricava_categoria_da_descrizione(descrizione)

        if not descrizione:
            saltati += 1
            continue

        codice_prodotto = codice_fornitore or barcode or f"FATT-{uuid.uuid4().hex[:8].upper()}"

        condizioni = [
            {"codice_prodotto": codice_prodotto},
        ]

        if barcode:
            condizioni.append({"barcode": barcode})

        esistente = await db.products.find_one({"$or": condizioni})

        if esistente:
            gia_presenti += 1
            aggiornamenti = {
                "quantita": int(esistente.get("quantita", 0)) + quantita,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            # Se il prodotto esistente non ha fornitore/marca/categoria (es. creato
            # da un import iniziale senza questi dati), completali ora con quanto
            # ricavato dalla fattura, senza sovrascrivere valori gia' presenti.
            if not str(esistente.get("fornitore", "")).strip() and fornitore_ricavato:
                aggiornamenti["fornitore"] = fornitore_ricavato
            if not str(esistente.get("fornitore_originale", "")).strip() and fornitore_originale:
                aggiornamenti["fornitore_originale"] = fornitore_originale
            if not str(esistente.get("marca", "")).strip() and marca_ricavata:
                aggiornamenti["marca"] = marca_ricavata
            if not str(esistente.get("marca_standard", "")).strip() and marca_ricavata:
                aggiornamenti["marca_standard"] = marca_ricavata
            if not str(esistente.get("categoria", "")).strip() and categoria_ricavata:
                aggiornamenti["categoria"] = categoria_ricavata
            if not float(esistente.get("prezzo_acquisto", 0) or 0) and prezzo_acquisto:
                aggiornamenti["prezzo_acquisto"] = prezzo_acquisto

            await db.products.update_one(
                {"_id": esistente["_id"]},
                {"$set": aggiornamenti}
            )
            continue

        nuovo = await crea_prodotto_da_fattura(
            db,
            descrizione=descrizione,
            barcode=barcode,
            codice_prodotto=codice_prodotto,
            marca=marca_ricavata,
            marca_standard=marca_ricavata,
            categoria=categoria_ricavata,
            fornitore=fornitore_ricavato,
            fornitore_originale=fornitore_originale,
            quantita=quantita,
            prezzo_acquisto=prezzo_acquisto,
        )

        await db.products.insert_one(nuovo)

        await mark_pending_item_imported_from_invoice_item(item, nuovo)

        await db.pending_invoice_products.update_many(
            {
                "descrizione": descrizione,
                "numero_fattura": item.get("numero_fattura", ""),
                "stato": "da_salvare",
            },
            {
                "$set": {
                    "stato": "importato",
                    "status": "importato",
                    "importato": True,
                    "risolto": True,
                    "da_importare": False,
                    "created_product_id": nuovo["id"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        )

        nuovo.pop("_id", None)
        created_products.append(nuovo)
        creati += 1

    # Dopo la creazione manuale, ricalcola davvero la fattura:
    # conta solo i prodotti pendenti che ora trovano match nel catalogo
    # tramite barcode, codice prodotto/codice fornitore oppure descrizione.
    numeri_fattura = list({
        str(item.get("numero_fattura") or "").strip()
        for item in payload.items
        if str(item.get("numero_fattura") or "").strip()
    })

    reconcile_results = []
    for numero_fattura in numeri_fattura:
        reconcile_results.append(await aggiorna_conteggi_fattura_import(numero_fattura))


    return {
        "ok": True,
        "creati": creati,
        "saltati": saltati,
        "gia_presenti": gia_presenti,
        "prodotti": created_products,
    }


@api_router.get("/products/{pid}", response_model=Product)
async def get_product(pid: str):
    """
    Dettaglio prodotto robusto.

    Cerca il prodotto per:
    - _id MongoDB
    - id salvato nel documento
    - codice_prodotto
    - barcode

    Serve perché dalla ricerca barcode può arrivare un identificativo diverso
    rispetto all'id MongoDB.
    """
    condizioni = [
        {"id": pid},
        {"codice_prodotto": pid},
        {"barcode": pid},
    ]

    # Se il pid è un ObjectId valido, cerca anche su _id MongoDB
    try:
        if ObjectId.is_valid(pid):
            condizioni.insert(0, {"_id": ObjectId(pid)})
    except Exception:
        pass

    # Se il barcode è salvato come numero, cerca anche come intero
    try:
        condizioni.append({"barcode": int(pid)})
    except Exception:
        pass

    prodotto = await db.products.find_one({"$or": condizioni})

    if not prodotto:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    prodotto["id"] = str(prodotto.get("id") or prodotto.get("_id") or "")
    prodotto.pop("_id", None)

    return prodotto



@api_router.post("/products", response_model=Product)
async def create_product(input: ProductCreate):
    prod = Product(**input.dict())
    data = applica_marca_standard_al_prodotto(prod.dict())
    await db.products.insert_one(data)
    return prod


@api_router.put("/products/{pid}", response_model=Product)
async def update_product(pid: str, input: ProductUpdate):
    """
    Aggiornamento prodotto robusto.

    Cerca il prodotto per:
    - _id MongoDB
    - id salvato nel documento
    - codice_prodotto
    - barcode

    Poi aggiorna usando il vero _id MongoDB.
    """
    condizioni = [
        {"id": pid},
        {"codice_prodotto": pid},
        {"barcode": pid},
    ]

    try:
        if ObjectId.is_valid(pid):
            condizioni.insert(0, {"_id": ObjectId(pid)})
    except Exception:
        pass

    try:
        condizioni.append({"barcode": int(pid)})
    except Exception:
        pass

    prodotto_esistente = await db.products.find_one({"$or": condizioni})

    if not prodotto_esistente:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    update_data = input.dict(exclude_unset=True)

    if not update_data:
        prodotto_esistente["id"] = str(prodotto_esistente.get("id") or prodotto_esistente.get("_id") or "")
        prodotto_esistente.pop("_id", None)
        return prodotto_esistente

    await db.products.update_one(
        {"_id": prodotto_esistente["_id"]},
        {"$set": update_data}
    )

    prodotto_aggiornato = await db.products.find_one({"_id": prodotto_esistente["_id"]})

    if not prodotto_aggiornato:
        raise HTTPException(status_code=404, detail="Prodotto non trovato dopo aggiornamento")

    prodotto_aggiornato["id"] = str(prodotto_aggiornato.get("id") or prodotto_aggiornato.get("_id") or "")
    prodotto_aggiornato.pop("_id", None)

    return prodotto_aggiornato



@api_router.delete("/products/{pid}")
async def delete_product(pid: str):
    condizioni = [
        {"id": pid},
        {"codice_prodotto": pid},
        {"barcode": pid},
    ]

    try:
        if ObjectId.is_valid(pid):
            condizioni.insert(0, {"_id": ObjectId(pid)})
    except Exception:
        pass

    try:
        condizioni.append({"barcode": int(pid)})
    except Exception:
        pass

    prodotto = await db.products.find_one({"$or": condizioni})

    if not prodotto:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    res = await db.products.delete_one({"_id": prodotto["_id"]})

    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    return {"ok": True}


@api_router.post("/products/{pid}/adjust-stock", response_model=Product)
async def adjust_stock(pid: str, body: StockAdjust):
    # Update atomico via pipeline aggregata: legge e scrive la nuova
    # quantita' in un'unica operazione di database, senza finestra di tempo
    # in cui un'altra richiesta concorrente possa leggere lo stesso valore
    # di partenza e causare un "lost update" sulla giacenza.
    doc = await db.products.find_one_and_update(
        {"id": pid},
        [
            {
                "$set": {
                    "quantita": {"$max": [0, {"$add": ["$quantita", body.delta]}]},
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        ],
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return Product(**doc)



def calcola_categoria_standard_import(data: dict) -> str:
    """
    Assegna categoria_standard durante import Excel/cataloghi usando l'ordine delle parole.

    Regola:
    - legge categoria + descrizione + codice + marca da sinistra verso destra;
    - la prima parola/frase utile che indica una categoria vince;
    - parole generiche tipo GIFT SET non decidono nulla;
    - evita falsi positivi tipo VITI dentro GIRAVITI.
    """
    import re

    categoria = str(data.get("categoria") or "").upper()
    categoria_standard_attuale = str(data.get("categoria_standard") or "").upper()
    descrizione = str(data.get("descrizione") or data.get("nome") or "").upper()
    codice = str(data.get("codice_prodotto") or data.get("barcode") or "").upper()
    marca = str(data.get("marca") or data.get("marca_standard") or "").upper()

    categorie_standard_nomi = {
        "UTENSILI MANUALI",
        "STRUMENTI DI MISURA",
        "UTENSILI A FILO",
        "UTENSILI A BATTERIA",
        "ACCESSORI",
        "PORTAUTENSILI",
        "FERRAMENTA",
        "FISSAGGIO",
        "GIARDINAGGIO",
        "VERNICI",
        "IDRAULICA",
        "ELETTRICO",
        "ANTINFORTUNISTICA",
        "AUTO",
        "CASA",
        "CHIAVI",
        "ALTRO",
    }

    # Se categoria è già una categoria standard, probabilmente è una vecchia classificazione.
    # Non deve vincere sulla descrizione. La useremo solo come fallback più sotto.
    categoria_per_testo = "" if categoria in categorie_standard_nomi else categoria

    testo = f"{categoria_per_testo} {descrizione} {codice} {marca}"
    testo = re.sub(r"\\s+", " ", testo).strip()

    # PRIORITÀ 1:
    # Prodotti chiaramente da giardino vincono su Volt e Watt.
    # Un tagliasiepi 500W resta Giardinaggio, non Utensili a filo.
    parole_giardino_prioritarie = [
        "GAMMA GIARDINO",
        "GIARDINAGGIO",
        "GIARDINO",
        "TAGLIASIEPI",
        "TAGLIA SIEPI",
        "DECESPUGLIATORE",
        "RASAERBA",
        "TAGLIAERBA",
        "TOSAERBA",
        "MOTOSEGA",
        "SOFFIATORE",
        "POTATORE",
        "POTATURA",
        "FORBICI POTATURA",
        "IRRIGAZIONE",
        "TUBO GIARDINO",
    ]

    if any(k in testo for k in parole_giardino_prioritarie):
        return "Giardinaggio"

    # PRIORITÀ 2:
    # Volt = utensile a batteria.
    # Watt = utensile a filo.
    # Queste regole valgono solo se prima non è stato riconosciuto Giardinaggio.
    volt_match = re.search(r"(?<![A-Z0-9])\d+(?:[.,]\d+)?\s*(?:V|VOLT|VOLTS)(?![A-Z0-9])", testo)
    watt_match = re.search(r"(?<![A-Z0-9])\d+(?:[.,]\d+)?\s*(?:W|WATT|WATTS)(?![A-Z0-9])", testo)

    if volt_match:
        return "Utensili a batteria"

    if watt_match:
        return "Utensili a filo"

    categorie_standard = {
        "UTENSILI MANUALI": "Utensili manuali",
        "STRUMENTI DI MISURA": "Strumenti di misura",
        "UTENSILI A FILO": "Utensili a filo",
        "UTENSILI A BATTERIA": "Utensili a batteria",
        "ACCESSORI": "Accessori",
        "PORTAUTENSILI": "Portautensili",
        "FERRAMENTA": "Ferramenta",
        "FISSAGGIO": "Fissaggio",
        "GIARDINAGGIO": "Giardinaggio",
        "VERNICI": "Vernici",
        "IDRAULICA": "Idraulica",
        "ELETTRICO": "Elettrico",
        "ANTINFORTUNISTICA": "Antinfortunistica",
        "AUTO": "Auto",
        "CASA": "Casa",
        "CHIAVI": "Chiavi",
        "ALTRO": "Altro",
    }

    # Se la categoria_standard attuale è già una categoria valida e la categoria importata non dice altro,
    # la manteniamo come fallback finale, non come priorità assoluta.
    fallback_standard = categorie_standard.get(categoria_standard_attuale) or categorie_standard.get(categoria)

    regole = [
        # Giardinaggio
        ("Giardinaggio", [
            "GAMMA GIARDINO",
            "GIARDINAGGIO",
            "GIARDINO",
            "IRRIGAZIONE",
            "RASAERBA",
            "TAGLIAERBA",
            "TAGLIASIEPI",
            "DECESPUGLIATORE",
            "SOFFIATORE",
            "MOTOSEGA",
            "POTATORE",
            "POTATURA",
            "FORBICI POTATURA",
            "RASTRELLO",
            "ZAPPA",
            "VANGA",
            "TUBO GIARDINO",
        ]),

        # Utensili a batteria
        ("Utensili a batteria", [
            "UTENSILI A BATTERIA",
            "ELETTROUTENSILI A BATTERIA",
            "GIRAVITA A BATTERIA",
            "GIRAVITI A BATTERIA",
            "CACCIAVITE A BATTERIA",
            "CACCIAVITI A BATTERIA",
            "TRAPANO A BATTERIA",
            "TRAPANO BATTERIA",
            "AVVITATORE",
            "AVVITATORI",
            "BATTERIA",
            "BATTERIE",
            "CARICABATTERIE",
            "SMERIGLIATRICE A BATTERIA",
            "SMERIGLIATRICE BATTERIA",
            "SEGHETTO A BATTERIA",
            "SEGHETTO BATTERIA",
            "FLESSIBILE BATTERIA",
        ]),

        # Utensili a filo
        ("Utensili a filo", [
            "UTENSILI A FILO",
            "ELETTROUTENSILI A FILO",
            "TRAPANO A FILO",
            "SMERIGLIATRICE A FILO",
            "SEGHETTO A FILO",
            "LEVIGATRICE A FILO",
            "MISCELATORE A FILO",
            "DEMOLITORE A FILO",
            "220V",
            "220 V",
            "230V",
            "230 V",
        ]),

        # Accessori
        ("Accessori", [
            "GAMMA ACCESSORI",
            "SET ACCESSORI",
            "KIT ACCESSORI",
            "SET DI ACCESSORI",
            "ASSORTIMENTO ACCESSORI",
            "ACCESSORI",
            "PUNTA",
            "PUNTE",
            "DISCO",
            "DISCHI",
            "LAMA",
            "LAME",
            "INSERTO",
            "INSERTI",
            "BIT",
            "BITS",
            "BUSSOLE",
            "SET BUSSOLE",
            "ABRASIVO",
            "ABRASIVI",
            "CARTA ABRASIVA",
            "SPAZZOLA",
            "SPAZZOLE",
            "SAIT",
        ]),

        # Utensili manuali
        ("Utensili manuali", [
            "UTENSILI MANUALI",
            "UTENSILERIA MANUALE",
            "GIRAVITE",
            "GIRAVITI",
            "CACCIAVITE",
            "CACCIAVITI",
            "MARTELLO",
            "MARTELLI",
            "PINZA",
            "PINZE",
            "CHIAVE INGLESE",
            "CHIAVI INGLESI",
            "CHIAVE COMBINATA",
            "CHIAVI COMBINATE",
            "CHIAVE A BUSSOLA",
            "BUSSOLA",
            "CRICCHETTO",
            "LIMA",
            "LIME",
            "SEGHETTO",
            "CUTTER",
            "SPATOLA",
        ]),

        # Strumenti di misura
        ("Strumenti di misura", [
            "STRUMENTI DI MISURA",
            "STRUMENTAZIONE",
            "METRO",
            "FLESSOMETRO",
            "LIVELLA",
            "CALIBRO",
            "SQUADRA",
            "MISURATORE",
            "LASER",
            "DISTANZIOMETRO",
            "TRACCIATORE",
        ]),

        # Portautensili
        ("Portautensili", [
            "PORTAUTENSILI",
            "BORSA UTENSILI",
            "BORSE UTENSILI",
            "CASSETTA UTENSILI",
            "CASSETTE UTENSILI",
            "VALIGIA",
            "VALIGETTA",
            "BAULE",
            "ORGANIZER",
            "PORTA UTENSILI",
        ]),

        # Vernici
        ("Vernici", [
            "VERNICI",
            "VERNICE",
            "SMALTO",
            "SMALTI",
            "PITTURA",
            "PITTURE",
            "IDROPITTURA",
            "IMPREGNANTE",
            "DILUENTE",
            "SOLVENTE",
            "ANTIRUGGINE",
            "FONDO",
            "STUCCO",
            "PENNELLO",
            "RULLO",
            "NASTRO CARTA",
            "TASSANI",
            "ITALIANCOLOR",
        ]),

        # Idraulica
        ("Idraulica", [
            "IDRAULICA",
            "RUBINETTO",
            "RUBINETTI",
            "TUBO IDRAULICO",
            "TUBI IDRAULICI",
            "RACCORDO",
            "RACCORDI",
            "SIFONE",
            "VALVOLA",
            "VALVOLE",
            "GUARNIZIONE IDRAULICA",
            "FLESSIBILE ACQUA",
            "SCARICO",
            "MISCELATORE",
        ]),

        # Elettrico
        ("Elettrico", [
            "ELETTRICO",
            "ELETTRICA",
            "MATERIALE ELETTRICO",
            "CAVO ELETTRICO",
            "CAVI ELETTRICI",
            "PRESA",
            "PRESE",
            "SPINA",
            "SPINE",
            "INTERRUTTORE",
            "INTERRUTTORI",
            "PROLUNGA",
            "MULTIPRESA",
            "LAMPADINA",
            "LAMPADA",
            "LED",
            "PORTALAMPADA",
            "NASTRO ISOLANTE",
        ]),

        # Antinfortunistica
        ("Antinfortunistica", [
            "ANTINFORTUNISTICA",
            "SICUREZZA",
            "DPI",
            "GUANTO",
            "GUANTI",
            "SCARPA ANTINFORTUNISTICA",
            "SCARPE ANTINFORTUNISTICHE",
            "OCCHIALI",
            "MASCHERA",
            "MASCHERINA",
            "CASCO",
            "ELMETTO",
            "GILET",
            "CUFFIE",
            "TAPPI",
            "GARSPORT",
        ]),

        # Fissaggio
        ("Fissaggio", [
            "FISSAGGIO",
            "TASSELLO",
            "TASSELLI",
            "VITE",
            "VITI",
            "BULLONE",
            "BULLONI",
            "DADO",
            "DADI",
            "RONDELLA",
            "RONDELLE",
            "ANCORANTE",
            "ANCORANTI",
            "CHIODI",
            "CHIODINO",
            "RIVETTO",
            "RIVETTI",
            "BARRA FILETTATA",
            "BARRE FILETTATE",
            "FISCHER",
            "TECFI",
        ]),

        # Ferramenta
        ("Ferramenta", [
            "FERRAMENTA",
            "CATENA",
            "CATENE",
            "LUCCHETTO",
            "LUCCHETTI",
            "CERNIERA",
            "CERNIERE",
            "STAFFA",
            "STAFFE",
            "MOSCHETTONE",
            "MOSCHETTONI",
            "GANCIO",
            "GANCI",
            "FILO FERRO",
            "CAVETTO",
            "MOLLA",
            "MOLLE",
        ]),

        # Auto
        ("Auto", [
            "AUTO",
            "AUTOMOTIVE",
            "LAVAVETRI",
            "TERGICRISTALLO",
            "TERGICRISTALLI",
            "BATTERIA AUTO",
            "OLIO MOTORE",
            "ADBLUE",
            "LUBRIFICANTE AUTO",
            "CURA AUTO",
        ]),

        # Casa
        ("Casa", [
            "CASA",
            "CURA DELLA CASA",
            "PULIZIA",
            "DETERGENTE",
            "DETERGENTI",
            "SCOPE",
            "SCOPA",
            "SECCHIO",
            "SPUGNA",
            "PANNO",
            "PANNI",
            "COLLA CASA",
            "SILICONE",
            "SARATOGA",
        ]),

        # Chiavi
        ("Chiavi", [
            "CHIAVI",
            "CHIAVE GREZZA",
            "CHIAVI GREZZE",
            "DUPLICAZIONE CHIAVI",
            "CILINDRO",
            "CILINDRI",
            "SERRATURA",
            "SERRATURE",
        ]),
    ]

    risultati = []

    for categoria_nome, parole in regole:
        for parola in parole:
            parola_upper = parola.upper()

            # Per parole brevi/generiche usiamo confini parola,
            # così VITI non viene trovata dentro GIRAVITI.
            if " " not in parola_upper and len(parola_upper) <= 6:
                pattern = r"(?<![A-Z0-9])" + re.escape(parola_upper) + r"(?![A-Z0-9])"
                match = re.search(pattern, testo)
                if match:
                    risultati.append((match.start(), -len(parola_upper), categoria_nome, parola_upper))
            else:
                index = testo.find(parola_upper)
                if index >= 0:
                    risultati.append((index, -len(parola_upper), categoria_nome, parola_upper))

    # Regex per voltaggi tipo 12V, 18V, 20V, 54V.
    # La posizione del voltaggio parte dove appare nel testo.
    for match in re.finditer(r"(?<![A-Z0-9])\d{2}\s*V(?![A-Z0-9])", testo):
        risultati.append((match.start(), -len(match.group(0)), "Utensili a batteria", match.group(0)))

    if risultati:
        risultati.sort()
        return risultati[0][2]

    return fallback_standard or "Altro"


@api_router.post("/products/bulk")
async def bulk_import(products: List[ProductCreate]):
    inserted = 0
    updated = 0

    for p in products:
        data = p.dict()
        data["categoria_standard"] = calcola_categoria_standard_import(data)
        prod = Product(**data)

        if prod.barcode:
            key = {"barcode": prod.barcode}
        elif prod.codice_prodotto:
            key = {"codice_prodotto": prod.codice_prodotto}
        else:
            key = {"descrizione": prod.descrizione}

        existing = await db.products.find_one(key, {"_id": 0})
        if existing:
            await db.products.update_one(
                {"id": existing["id"]},
                {"$set": {**prod.dict(), "id": existing["id"]}},
            )
            updated += 1
        else:
            data = applica_marca_standard_al_prodotto(prod.dict())
            await db.products.insert_one(data)
            inserted += 1

    return {
        "inserted": inserted,
        "updated": updated,
    }

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
    # Costi secondari fornitori letti dalle fatture: spedizione, imballaggio, bollo, incasso, ecc.
    fatture_importate = await db.invoice_imports.find({}).to_list(5000)

    totale_costi_secondari_fornitori = 0.0
    costi_secondari_fornitori_per_tipo = {}

    for fattura in fatture_importate:
        costi = fattura.get("costi_secondari_fornitori") or []

        for costo in costi:
            tipo = str(costo.get("tipo") or "Altro costo secondario").strip()
            try:
                importo = float(costo.get("importo") or 0)
            except Exception:
                importo = 0.0

            if importo <= 0:
                continue

            totale_costi_secondari_fornitori += importo
            costi_secondari_fornitori_per_tipo[tipo] = costi_secondari_fornitori_per_tipo.get(tipo, 0.0) + importo

    costi_secondari_fornitori_per_tipo_list = [
        {
            "tipo": tipo,
            "totale": round(totale, 2),
        }
        for tipo, totale in sorted(
            costi_secondari_fornitori_per_tipo.items(),
            key=lambda x: x[1],
            reverse=True
        )
    ]

    from datetime import date

    oggi = date.today().isoformat()

    sales_today = [
        s for s in sales_docs
        if str(s.get("created_at", "")).startswith(oggi)
    ]

    vendite_giorno = round(
        sum(float(s.get("totale", 0)) for s in sales_today),
        2
    )

    numero_vendite_giorno = len(sales_today)

    # Più venduti
    pipeline_best = [
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.product_id",
                "descrizione": {"$first": "$items.descrizione"},
                "pezzi_venduti": {"$sum": "$items.quantita"},
                "totale_venduto": {
                    "$sum": {
                        "$multiply": [
                            "$items.prezzo_vendita",
                            "$items.quantita"
                        ]
                    }
                },
            }
        },
        {"$sort": {"pezzi_venduti": -1, "totale_venduto": -1}},
        {"$limit": 5},
        {
            "$project": {
                "_id": 0,
                "product_id": "$_id",
                "descrizione": 1,
                "pezzi_venduti": 1,
                "totale_venduto": {"$round": ["$totale_venduto", 2]},
            }
        },
    ]

    piu_venduti = await db.sales.aggregate(pipeline_best).to_list(5)

    # Meno venduti: le vendite vengono aggregate una sola volta e poi
    # accostate ai prodotti tramite product_id. In precedenza un $lookup
    # non correlato assegnava a ogni prodotto le vendite di un altro.
    vendite_per_prodotto = {
        str(v.get("_id")): v
        for v in await db.sales.aggregate([
            {"$unwind": "$items"},
            {
                "$group": {
                    "_id": "$items.product_id",
                    "pezzi_venduti": {"$sum": "$items.quantita"},
                    "totale_venduto": {
                        "$sum": {
                            "$multiply": ["$items.prezzo_vendita", "$items.quantita"]
                        }
                    },
                }
            },
        ]).to_list(length=None)
    }

    riepilogo_venduti = []
    for d in docs:
        vendita = vendite_per_prodotto.get(str(d.get("id"))) or {}

        riepilogo_venduti.append({
            "product_id": d.get("id"),
            "descrizione": d.get("descrizione"),
            "pezzi_venduti": int(vendita.get("pezzi_venduti", 0) or 0),
            "totale_venduto": round(float(vendita.get("totale_venduto", 0) or 0), 2),
            "quantita_magazzino": int(d.get("quantita", 0) or 0),
        })

    meno_venduti = sorted(
        riepilogo_venduti,
        key=lambda r: (r["pezzi_venduti"], -r["quantita_magazzino"]),
    )[:5]

    return {
        "total_products": total_products,
        "total_pieces": total_pieces,
        "valore_magazzino": round(valore_magazzino, 2),
        "totale_costi_secondari_fornitori": round(totale_costi_secondari_fornitori, 2),
        "costi_secondari_fornitori_per_tipo": costi_secondari_fornitori_per_tipo_list,
        "valore_vendita_potenziale": round(valore_vendita, 2),
        "sotto_scorta_count": len(sotto_scorta),
        # Solo i campi utili a identificare l'articolo: la dashboard legge
        # sotto_scorta_count, e spedire i prodotti interi significava
        # allegare anche le foto in base64 (oltre 180 KB per una risposta
        # che ne usa meno di 10).
        "sotto_scorta": [
            {
                "id": d.get("id"),
                "codice_prodotto": d.get("codice_prodotto", ""),
                "barcode": d.get("barcode", ""),
                "descrizione": d.get("descrizione", ""),
                "marca": d.get("marca", ""),
                "categoria": d.get("categoria", ""),
                "quantita": int(d.get("quantita", 0) or 0),
                "soglia_scorta": int(d.get("soglia_scorta", 5) or 0),
            }
            for d in sotto_scorta[:20]
        ],
        "categorie": [{"nome": k, "count": v} for k, v in sorted(cat_counts.items(), key=lambda x: -x[1])],
        "vendite_totali": round(totale_vendite, 2),
        "numero_vendite": len(sales_docs),
        "vendite_giorno": vendite_giorno,
        "numero_vendite_giorno": numero_vendite_giorno,
        "piu_venduti": piu_venduti,
        "meno_venduti": meno_venduti,
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

    if any(it.quantita <= 0 or it.prezzo_vendita < 0 for it in input.items):
        raise HTTPException(
            status_code=400,
            detail="Quantit\u00e0 e prezzi della vendita non validi",
        )

    # Risolve e valida prima tutti i prodotti, aggregando eventuali righe
    # duplicate. In questo modo nessuna vendita viene salvata a met\u00e0.
    richieste_per_prodotto = {}
    for it in input.items:
        filtri = [
            {"id": it.product_id},
            {"codice_prodotto": it.product_id},
            {"barcode": it.product_id},
        ]

        if ObjectId.is_valid(it.product_id):
            filtri.append({"_id": ObjectId(it.product_id)})

        prodotto = await db.products.find_one({"$or": filtri})
        if not prodotto:
            raise HTTPException(
                status_code=404,
                detail=f"Prodotto non trovato: {it.descrizione}",
            )

        product_key = prodotto["_id"]
        if product_key not in richieste_per_prodotto:
            richieste_per_prodotto[product_key] = {
                "prodotto": prodotto,
                "quantita": 0,
            }
        richieste_per_prodotto[product_key]["quantita"] += it.quantita

    for richiesta in richieste_per_prodotto.values():
        disponibile = int(richiesta["prodotto"].get("quantita", 0))
        if disponibile < richiesta["quantita"]:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Giacenza insufficiente per: "
                    f"{richiesta['prodotto'].get('descrizione', 'prodotto')}"
                ),
            )

    totale = sum(it.prezzo_vendita * it.quantita for it in input.items)
    sale = Sale(items=input.items, totale=round(totale, 2))

    decrementati = []
    try:
        for product_id, richiesta in richieste_per_prodotto.items():
            quantita = richiesta["quantita"]
            risultato = await db.products.update_one(
                {"_id": product_id, "quantita": {"$gte": quantita}},
                {
                    "$inc": {"quantita": -quantita},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
                },
            )
            if risultato.modified_count != 1:
                raise HTTPException(
                    status_code=409,
                    detail="La giacenza \u00e8 cambiata durante la vendita. Riprova.",
                )
            decrementati.append((product_id, quantita))

        await db.sales.insert_one(sale.dict())
    except Exception:
        # Compensazione per MongoDB standalone, dove le transazioni potrebbero
        # non essere disponibili: ripristina ogni decremento gi\u00e0 eseguito.
        for product_id, quantita in decrementati:
            await db.products.update_one(
                {"_id": product_id},
                {"$inc": {"quantita": quantita}},
            )
        raise

    return sale


@api_router.get("/sales", response_model=List[Sale])
async def list_sales(limit: int = 50):
    docs = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [Sale(**d) for d in docs]

@api_router.get("/sales/today")
async def list_sales_today():
    oggi = datetime.now().astimezone().date()

    docs = await db.sales.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    risultato = []

    for vendita in docs:
        created_at = str(vendita.get("created_at") or "")

        try:
            data_vendita = datetime.fromisoformat(
                created_at.replace("Z", "+00:00")
            ).astimezone().date()
        except Exception:
            continue

        if data_vendita != oggi:
            continue

        items = vendita.get("items") or []

        risultato.append({
            "id": vendita.get("id", ""),
            "total": round(float(vendita.get("totale", 0)), 2),
            "created_at": created_at,
            "articoli": len(items),
            "pezzi": sum(int(item.get("quantita", 0)) for item in items),
            "prodotto_titolo": (
                str(items[0].get("descrizione") or "Prodotto venduto")
                if items
                else "Prodotto venduto"
            ),
        })

    return risultato


@api_router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str):
    vendita = await db.sales.find_one({"id": sale_id})

    if not vendita:
        raise HTTPException(
            status_code=404,
            detail="Vendita non trovata"
        )

    items = vendita.get("items") or []

    for item in items:
        product_id = str(item.get("product_id") or "")
        quantita = int(item.get("quantita") or 0)

        if product_id and quantita > 0:
            await db.products.update_one(
                {"id": product_id},
                {
                    "$inc": {"quantita": quantita},
                    "$set": {
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                },
            )

    await db.sales.delete_one({"id": sale_id})

    return {
        "ok": True,
        "sale_id": sale_id,
        "quantita_ripristinate": sum(
            int(item.get("quantita") or 0) for item in items
        ),
    }



# ============================================================
# LISTE STANDARD MODIFICABILI: categorie, fornitori, marche
# ============================================================

STANDARD_LIST_TYPES = ["categorie", "fornitori", "marche"]

STANDARD_LIST_DEFAULTS = {
    "categorie": [
        "Utensili manuali",
        "Strumenti di misura",
        "Utensili a filo",
        "Utensili a batteria",
        "Accessori",
        "Portautensili",
        "Ferramenta",
        "Fissaggio",
        "Giardinaggio",
        "Vernici",
        "Idraulica",
        "Elettrico",
        "Antinfortunistica",
        "Auto",
        "Casa",
        "Chiavi",
        "Altro",
    ],
    "fornitori": [
        "De Santis",
        "C&C",
        "DFL",
        "Viridex",
        "Liantonio Vernici",
        "Sait abrasivi",
        "Stanley Black+Decker",
        "Capaldo",
        "Deodato",
        "Tassani",
        "Italiancolor",
        "Saratoga",
        "Duemme",
        "Garsport",
        "Pasquale Romito Cataldo",
        "Tecfi",
        "Viglietta",
        "Prochimica",
        "Fratelli Vitale",
        "Madras",
    ],
    "marche": [],
}


def _clean_standard_items(items):
    puliti = []
    visti = set()

    for item in items or []:
        valore = str(item or "").strip()
        if not valore:
            continue

        chiave = valore.lower()
        if chiave in visti:
            continue

        visti.add(chiave)
        puliti.append(valore)

    return sorted(puliti, key=lambda x: x.lower())


async def _collect_brand_defaults():
    marche = set()

    cursor = db.products.find(
        {},
        {
            "marca": 1,
            "marca_standard": 1,
        }
    )

    async for p in cursor:
        marca = str(p.get("marca") or "").strip()
        marca_standard = str(p.get("marca_standard") or "").strip()

        for valore in [marca_standard, marca]:
            if valore and valore.lower() not in ["tutte", "nessuna", "null", "undefined", "da classificare"]:
                marche.add(valore)

    return sorted(marche, key=lambda x: x.lower())


async def ensure_standard_list(tipo: str):
    if tipo not in STANDARD_LIST_TYPES:
        raise HTTPException(status_code=400, detail="Tipo lista non valido")

    doc = await db.standard_lists.find_one({"tipo": tipo})

    defaults = list(STANDARD_LIST_DEFAULTS.get(tipo, []))

    if tipo == "marche":
        marche_db = await _collect_brand_defaults()
        defaults = _clean_standard_items(defaults + marche_db)

    if not doc:
        doc = {
            "tipo": tipo,
            "items": _clean_standard_items(defaults),
        }
        await db.standard_lists.insert_one(doc)
        return doc

    items_attuali = _clean_standard_items(doc.get("items") or [])

    # IMPORTANTE:
    # I default servono solo alla creazione iniziale della lista.
    # Se l'utente modifica "Chiavi" in "Serrature", non dobbiamo reinserire "Chiavi".
    # Per le marche invece possiamo continuare ad aggiungere quelle trovate nei prodotti,
    # perché le marche reali già presenti nel catalogo devono restare selezionabili.
    if tipo == "marche":
        items_finali = _clean_standard_items(items_attuali + defaults)

        if items_finali != items_attuali:
            await db.standard_lists.update_one(
                {"tipo": tipo},
                {"$set": {"items": items_finali}}
            )
            doc["items"] = items_finali

    return doc


@api_router.get("/standard-lists")
async def get_all_standard_lists():
    result = {}

    for tipo in STANDARD_LIST_TYPES:
        doc = await ensure_standard_list(tipo)
        result[tipo] = doc.get("items") or []

    return result


@api_router.get("/standard-lists/{tipo}")
async def get_standard_list(tipo: str):
    doc = await ensure_standard_list(tipo)

    return {
        "tipo": tipo,
        "items": doc.get("items") or [],
        "total": len(doc.get("items") or []),
    }


@api_router.post("/standard-lists/{tipo}/items")
async def add_standard_list_item(tipo: str, payload: dict):
    doc = await ensure_standard_list(tipo)

    value = str(payload.get("value") or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Valore mancante")

    items = _clean_standard_items((doc.get("items") or []) + [value])

    await db.standard_lists.update_one(
        {"tipo": tipo},
        {"$set": {"items": items}}
    )

    return {
        "tipo": tipo,
        "items": items,
        "total": len(items),
    }


@api_router.put("/standard-lists/{tipo}/items")
async def update_standard_list_item(tipo: str, payload: dict):
    doc = await ensure_standard_list(tipo)

    old_value = str(payload.get("old_value") or "").strip()
    new_value = str(payload.get("new_value") or "").strip()

    if not old_value or not new_value:
        raise HTTPException(status_code=400, detail="Valori mancanti")

    items = doc.get("items") or []
    updated = []

    found = False
    for item in items:
        if str(item).strip().lower() == old_value.lower():
            updated.append(new_value)
            found = True
        else:
            updated.append(item)

    if not found:
        raise HTTPException(status_code=404, detail="Voce non trovata")

    updated = _clean_standard_items(updated)

    await db.standard_lists.update_one(
        {"tipo": tipo},
        {"$set": {"items": updated}}
    )

    # Se rinominiamo una voce standard, aggiorniamo anche i prodotti già esistenti.
    # Altrimenti nelle impostazioni cambia il nome, ma nel catalogo restano le vecchie categorie.
    if tipo == "categorie":
        await db.products.update_many(
            {
                "$or": [
                    {"categoria": {"$regex": f"^{old_value}$", "$options": "i"}},
                    {"categoria_standard": {"$regex": f"^{old_value}$", "$options": "i"}},
                ]
            },
            {
                "$set": {
                    "categoria": new_value,
                    "categoria_standard": new_value,
                }
            }
        )

    elif tipo == "fornitori":
        await db.products.update_many(
            {"fornitore": {"$regex": f"^{old_value}$", "$options": "i"}},
            {"$set": {"fornitore": new_value}}
        )

    elif tipo == "marche":
        await db.products.update_many(
            {
                "$or": [
                    {"marca": {"$regex": f"^{old_value}$", "$options": "i"}},
                    {"marca_standard": {"$regex": f"^{old_value}$", "$options": "i"}},
                ]
            },
            {
                "$set": {
                    "marca": new_value,
                    "marca_standard": new_value,
                }
            }
        )

    return {
        "tipo": tipo,
        "items": updated,
        "total": len(updated),
    }


@api_router.delete("/standard-lists/{tipo}/items")
async def delete_standard_list_item(tipo: str, payload: dict):
    doc = await ensure_standard_list(tipo)

    value = str(payload.get("value") or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Valore mancante")

    items = [
        item for item in (doc.get("items") or [])
        if str(item).strip().lower() != value.lower()
    ]

    items = _clean_standard_items(items)

    await db.standard_lists.update_one(
        {"tipo": tipo},
        {"$set": {"items": items}}
    )

    return {
        "tipo": tipo,
        "items": items,
        "total": len(items),
    }


@api_router.get("/settings/pricing")
async def get_pricing_settings():
    doc = await db.app_settings.find_one({"key": "pricing_markups"})
    return {"markups": {**DEFAULT_MARKUPS, **((doc or {}).get("value") or {})}}


@api_router.put("/settings/pricing")
async def update_pricing_settings(payload: dict, _: dict = Depends(require_admin)):
    incoming = payload.get("markups") or {}
    markups = {}
    for key in DEFAULT_MARKUPS:
        try:
            value = float(incoming.get(key, DEFAULT_MARKUPS[key]))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"Ricarico non valido: {key}")
        if value < 0 or value > 500:
            raise HTTPException(status_code=400, detail="I ricarichi devono essere tra 0% e 500%")
        markups[key] = value

    now = datetime.now(timezone.utc).isoformat()
    products = await db.products.find(
        {"prezzo_acquisto": {"$gt": 0}},
        {"id": 1, "barcode": 1, "prezzo_acquisto": 1, "prezzo_vendita": 1},
    ).to_list(length=None)
    if products:
        backup_dir = ROOT_DIR / "backups"
        backup_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_path = backup_dir / f"prezzi_vendita_prima_modifica_regole_{timestamp}.json"
        backup_path.write_text(
            json.dumps(
                [
                    {
                        "id": product.get("id"),
                        "barcode": product.get("barcode"),
                        "prezzo_acquisto": product.get("prezzo_acquisto"),
                        "prezzo_vendita": product.get("prezzo_vendita"),
                    }
                    for product in products
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    operations = [
        UpdateOne(
            {"_id": product["_id"]},
            {"$set": {
                "prezzo_vendita": calculate_sale_price(
                    float(product.get("prezzo_acquisto") or 0), markups
                ),
                "updated_at": now,
            }},
        )
        for product in products
    ]
    if operations:
        await db.products.bulk_write(operations, ordered=False)

    await db.app_settings.update_one(
        {"key": "pricing_markups"},
        {"$set": {"value": markups, "updated_at": now}},
        upsert=True,
    )
    return {"markups": markups, "updated_products": len(operations)}



app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def apply_sale_price_migration():
    """Applica una sola volta le nuove fasce ai prodotti gia presenti."""
    migration_name = "sale_prices_markup_v1"

    try:
        applied = await db.app_migrations.find_one({"name": migration_name})
        if applied:
            return

        settings = await db.app_settings.find_one({"key": "pricing_markups"})
        markups = {**DEFAULT_MARKUPS, **((settings or {}).get("value") or {})}
        products = await db.products.find(
            {"prezzo_acquisto": {"$gt": 0}},
            {"id": 1, "barcode": 1, "prezzo_acquisto": 1, "prezzo_vendita": 1},
        ).to_list(length=None)
        now = datetime.now(timezone.utc).isoformat()
        changes = []

        for product in products:
            purchase_price = float(product.get("prezzo_acquisto") or 0)
            sale_price = calculate_sale_price(purchase_price, markups)
            current_sale_price = float(product.get("prezzo_vendita") or 0)
            if abs(current_sale_price - sale_price) > 0.001:
                changes.append((product, sale_price))

        if changes:
            backup_dir = ROOT_DIR / "backups"
            backup_dir.mkdir(exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_path = backup_dir / f"prezzi_vendita_prima_ricarichi_{timestamp}.json"
            backup_path.write_text(
                json.dumps(
                    [
                        {
                            "id": product.get("id"),
                            "barcode": product.get("barcode"),
                            "prezzo_acquisto": product.get("prezzo_acquisto"),
                            "prezzo_vendita": product.get("prezzo_vendita"),
                        }
                        for product, _ in changes
                    ],
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            await db.products.bulk_write(
                [
                    UpdateOne(
                        {"_id": product["_id"]},
                        {"$set": {"prezzo_vendita": sale_price, "updated_at": now}},
                    )
                    for product, sale_price in changes
                ],
                ordered=False,
            )

        await db.app_migrations.insert_one(
            {"name": migration_name, "applied_at": now, "updated_products": len(changes)}
        )
        logger.info("Migrazione prezzi vendita: %s prodotti aggiornati", len(changes))
    except Exception:
        logger.exception("Migrazione prezzi vendita rinviata: database non disponibile")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
