from datetime import datetime, timezone
import uuid
from pricing import calculate_sale_price


def ricava_marca_da_descrizione(descrizione):
    testo = normalizza_testo(descrizione)

    marche = {
        "ambrovit": "Ambrovit",
        "stanley": "Stanley",
        "black decker": "Black & Decker",
        "black+decker": "Black & Decker",
        "black & decker": "Black & Decker",
        "dewalt": "DeWalt",
        "usag": "USAG",
        "beta": "Beta",
        "bosch": "Bosch",
        "makita": "Makita",
        "einhell": "Einhell",
        "fischer": "Fischer",
        "arexons": "Arexons",
        "saratoga": "Saratoga",
        "vileda": "Vileda",
        "mapei": "Mapei",
        "cisa": "Cisa",
        "mottura": "Mottura",
        "yale": "Yale",
        "tesa": "Tesa",
        "wolfcraft": "Wolfcraft",
        "kapriol": "Kapriol",
        "sika": "Sika",
        "maurer": "Maurer",
        "papillon": "Papillon",
        "mustad": "Mustad",
        "pattex": "Pattex",
        "henkel": "Henkel",
        "bostik": "Bostik",
        "wd-40": "WD-40",
        "svitol": "Svitol",
    }


    for chiave, marca in marche.items():
        if chiave in testo:
            return marca

    return ""


def ricava_categoria_da_descrizione(descrizione):
    testo = normalizza_testo(descrizione)

    regole = [
        (
            "Fissaggio",
            [
                "vite", "viti", "bullone", "bulloni", "dado", "dadi",
                "rondella", "rondelle", "tassello", "tasselli",
                "ancorante", "barra filettata", "filettata",
                "chiodo", "chiodi", "rivetto", "rivetti", "autoperforanti",
            ],
        ),
        (
            "Utensili manuali",
            [
                "chiave", "chiavi", "cacciavite", "cacciaviti",
                "pinza", "pinze", "martello", "sega", "lime",
                "brugola", "cricchetto", "bussole", "lama",
            ],
        ),
        (
            "Utensili a batteria",
            [
                "batteria", "avvitatore", "trapano batteria",
                "smerigliatrice batteria", "v20", "18v", "12v", "Volt",
            ],
        ),
        (
           "Utensili a filo",
            [
                "trapano", "smerigliatrice", "levigatrice",
                "seghetto", "tassellatore", "demolitore", "W",
                "mola", "roto orbitale", "a filo", "roto-orbitale", "Watt",
            ],
        ),
        (
            "Accessori",
            [
                "disco", "dischi", "punta", "punte", "lama",
                "lame", "bit", "inserti", "abrasivo", "abrasivi",
                "carta abrasiva", "platorello",
            ],
        ),
        (
            "Portautensili",
            [
                "borsa", "valigia", "cassettiera", "cassetta",
                "porta attrezzi", "portautensili", "fodero",
            ],
        ),
        (
            "Vernici",
            [
                "vernice", "smalto", "pittura", "pennello",
                "rullo", "stucco", "diluente", "impregnante",
            ],
        ),
        (
            "Idraulica",
            [
                "raccordo", "tubo", "rubinetto", "guarnizione",
                "sifone", "flessibile", "valvola", "sturalavandino",
            ],
        ),
       (
            "Elettrico",
            [
                "presa", "interruttore", "cavo", "spina",
                "lampada", "led", "prolunga", "multipresa",
            ],
        ),
        (
            "Giardinaggio",
            [
                "giardino", "irrigazione", "tubo acqua", "forbice potatura",
                "tagliasiepi", "decespugliatore", "rastrello",
            ],
        ),
        (
            "Antinfortunistica",
            [
                "guanto", "guanti", "scarpa", "scarpe",
                "occhiale", "occhiali", "mascherina", "casco",
                "pantaloncini", "giacca antipioggia",
            ],
        ),
        (
            "Casa",
            [
                "cartone", "scatola", "sacchetto", "contenitore",
                "secchio", "panno", "spugna",
            ],
        ),
    ]

    for categoria, parole in regole:
        for parola in parole:
            if parola in testo:
                return categoria

    return "Da classificare"

async def crea_prodotto_da_fattura(
    db,
    *,
    descrizione: str,
    barcode: str,
    codice_prodotto: str,
    marca: str,
    marca_standard: str,
    categoria: str,
    fornitore: str,
    fornitore_originale: str,
    quantita: int,
    prezzo_acquisto: float,
):
    """
    Crea un prodotto nel catalogo partendo da una riga di fattura.
    Restituisce il documento creato.
    """

    nuovo = {
        "id": str(uuid.uuid4()),
        "codice_prodotto": codice_prodotto,
        "barcode": barcode,
        "descrizione": descrizione,
        "marca": marca,
        "marca_standard": marca_standard,
        "categoria": categoria,
        "fornitore": fornitore,
        "fornitore_originale": fornitore_originale,
        "quantita": quantita,
        "prezzo_acquisto": prezzo_acquisto,
        "prezzo_vendita": calculate_sale_price(prezzo_acquisto),
        "prezzo_promo": None,
        "promo_attiva": False,
        "promo_nome": "",
        "promo_inizio": "",
        "promo_fine": "",
        "ultimo_aggiornamento_promo": "",
        "soglia_scorta": 0,
        "note": "",
        "foto": "",
        "image_url": "",
        "immagine": "",
        "immagine_url": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.products.insert_one(nuovo)

    return nuovo
