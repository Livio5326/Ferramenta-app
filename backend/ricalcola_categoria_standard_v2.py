from pymongo import MongoClient
from bson.json_util import dumps
from pathlib import Path
from datetime import datetime
from collections import Counter
import re

db = MongoClient("mongodb://localhost:27017")["ferramenta"]
products = db.products

backup = Path.home() / "Scaricati" / ("backup_prima_categoria_standard_v2_" + datetime.now().strftime("%Y%m%d-%H%M") + ".json")
tutti = list(products.find({}))
backup.write_text(dumps(tutti, indent=2), encoding="utf-8")

def txt(x):
    return str(x or "").strip()

def low(x):
    return txt(x).lower()

def codice(p):
    return txt(p.get("codice_prodotto")).upper()

def ha_wattaggio(t):
    return bool(re.search(r"\b\d{2,4}\s*(w|watt|watts)\b", t.lower()))

def ha_batteria(t):
    t = t.lower()
    parole = [
        "batteria", "batterie", "caricabatterie", "carica batteria",
        "cordless", "18v", "20v", "12v", "54v", "v20",
        "litio", "li-ion", "brushless"
    ]
    return any(p in t for p in parole)

def sembra_accessorio(t):
    t = t.lower()
    parole = [
        "accessorio", "accessori", "punta", "punte", "lama", "lame",
        "disco", "dischi", "abrasiv", "mola", "mole", "platorello",
        "mandrino", "inserto", "inserti", "bit", "filo hdl",
        "rocchetto", "bobina", "ricambio", "caricabatterie",
        "batteria di ricambio", "set punte", "kit punte"
    ]
    return any(p in t for p in parole)

def assegna(p):
    marca = low(p.get("marca"))
    fornitore = low(p.get("fornitore"))
    categoria = low(p.get("categoria"))
    descrizione = low(p.get("descrizione"))
    note = low(p.get("note"))
    c = codice(p)

    testo = f"{marca} {fornitore} {categoria} {descrizione} {note} {c}"

    # -------------------------
    # STANLEY
    # -------------------------
    if "stanley" in marca or "stanley" in fornitore:
        if "portautensili" in categoria:
            return "Portautensili"

        if "strumenti di misura" in categoria or "strumentazione elettronica" in categoria:
            return "Strumenti di misura"

        if "utensileria manuale" in categoria or "utensileria meccanica" in categoria:
            return "Utensili manuali"

        if "utensili da giardino" in categoria:
cat > backend/ricalcola_categoria_standard_v2.py <<'PY'
from pymongo import MongoClient
from bson.json_util import dumps
from pathlib import Path
from datetime import datetime
from collections import Counter
import re

db = MongoClient("mongodb://localhost:27017")["ferramenta"]
products = db.products

backup = Path.home() / "Scaricati" / ("backup_prima_categoria_standard_v2_" + datetime.now().strftime("%Y%m%d-%H%M") + ".json")
tutti = list(products.find({}))
backup.write_text(dumps(tutti, indent=2), encoding="utf-8")

def testo(x):
    return str(x or "").strip()

def basso(x):
    return testo(x).lower()

def ha_wattaggio(t):
    return bool(re.search(r"\b\d{2,4}\s*(w|watt|watts)\b", t.lower()))

def ha_batteria(t):
    parole = [
        "batteria", "batterie", "caricabatterie", "carica batteria",
        "cordless", "18v", "20v", "12v", "54v", "v20",
        "litio", "li-ion", "brushless"
    ]
    return any(p in t.lower() for p in parole)

def sembra_accessorio(t):
    parole = [
        "accessorio", "accessori", "punta", "punte", "lama", "lame",
        "disco", "dischi", "abrasiv", "mola", "mole", "platorello",
        "mandrino", "inserto", "inserti", "bit", "filo hdl",
        "rocchetto", "bobina", "ricambio", "set punte", "kit punte"
    ]
    return any(p in t.lower() for p in parole)

def assegna_categoria_standard(p):
    marca = basso(p.get("marca"))
    fornitore = basso(p.get("fornitore"))
    categoria = basso(p.get("categoria"))
    descrizione = basso(p.get("descrizione"))
    note = basso(p.get("note"))
    codice = testo(p.get("codice_prodotto")).upper()

    t = f"{marca} {fornitore} {categoria} {descrizione} {note} {codice}"

    # STANLEY
    if "stanley" in marca or "stanley" in fornitore:
        if "portautensili" in categoria:
            return "Portautensili"

        if "strumenti di misura" in categoria or "strumentazione elettronica" in categoria:
            return "Strumenti di misura"

        if "utensileria manuale" in categoria or "utensileria meccanica" in categoria:
            return "Utensili manuali"

        if "utensili da giardino" in categoria:
            return "Giardinaggio"

        if "elettroutensili a batteria" in categoria:
            return "Utensili a batteria"

        if "elettroutensili a filo" in categoria:
            return "Utensili a filo"

        if "accessori" in categoria:
            if codice.startswith(("FME", "SFME", "SFMEE", "FMEG", "SM")):
                return "Utensili a filo"

            if codice.startswith(("SFMC", "SCMW", "SFMCMW", "SCOEP")):
                if "rasaerba" in t or "taglia" in t or "giardino" in t or "spazzaneve" in t:
                    return "Giardinaggio"
                return "Utensili a batteria"

            return "Accessori"

        if "gesso rivestito" in categoria:
            return "Altro"

        return "Altro"

    # BLACK+DECKER
    if "black" in marca or "black" in fornitore:
        if "batterie e caricabatterie" in categoria:
            return "Utensili a batteria"

        if "gamma giardino" in categoria:
            return "Giardinaggio"

        if "cura della casa" in categoria:
            return "Casa"
        if "elettroutensili" in categoria:
            if ha_batteria(t) and not ha_wattaggio(t):
                return "Utensili a batteria"

            return "Utensili a filo"

        return "Altro"

    # GENERICO FUTURI CATALOGHI
    if "portautensili" in categoria or "porta utensili" in categoria:
        return "Portautensili"

    if "strumenti di misura" in categoria or "misura" in categoria:
        return "Strumenti di misura"

    if "utensileria manuale" in categoria or "utensileria meccanica" in categoria or "manuale" in categoria:
        return "Utensili manuali"

    if "giardino" in categoria:
        return "Giardinaggio"

    if "accessori" in categoria:
        return "Accessori"

    if "elettroutensili" in categoria or "power tools" in categoria:
        if ha_batteria(t) and not ha_wattaggio(t):
            return "Utensili a batteria"

        return "Utensili a filo"

    if "fissaggio" in categoria:
        return "Fissaggio"

    if "vernici" in categoria or "pittura" in categoria:
        return "Vernici"

    if "idraulica" in categoria:
        return "Idraulica"

    if "elettrico" in categoria:
        return "Elettrico"

    if "antinfortunistica" in categoria or "dpi" in categoria:
        return "Antinfortunistica"

    if "auto" in categoria:
        return "Auto"

    if "casa" in categoria:
        return "Casa"

    return "Altro"

conteggio = Counter()
aggiornati = 0

for p in tutti:
    categoria_standard = assegna_categoria_standard(p)
    conteggio[categoria_standard] += 1

    if p.get("categoria_standard") != categoria_standard:
        products.update_one(
            {"_id": p["_id"]},
            {"$set": {"categoria_standard": categoria_standard}}
        )
        aggiornati += 1

print("Backup creato:", backup)
print("Prodotti totali:", len(tutti))
print("Prodotti aggiornati:", aggiornati)
print()
print("Distribuzione categoria_standard:")
for categoria, count in conteggio.most_common():
    print(f"{categoria}: {count}")
PY
