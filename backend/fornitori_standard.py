FORNITORI_STANDARD = [
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
]


def pulisci_nome_fornitore(value):
    return (
        str(value or "")
        .strip()
        .lower()
        .replace(".", "")
        .replace(",", "")
        .replace("&", " e ")
        .replace("+", " ")
        .replace("-", " ")
        .replace("_", " ")
    )


def compatta_spazi(value):
    return " ".join(str(value or "").split())


def normalizza_fornitore(value):
    raw = str(value or "").strip()

    if not raw:
        return ""

    cleaned = compatta_spazi(pulisci_nome_fornitore(raw))

    aliases = {
        "de santis": "De Santis",
        "de santis nicola": "De Santis",
        "de santis nicola srl": "De Santis",
        "de santis nicola s r l": "De Santis",

        "c e c": "C&C",
        "c c": "C&C",
        "c&c": "C&C",

        "dfl": "DFL",
        "viridex": "Viridex",

        "liantonio vernici": "Liantonio Vernici",
        "liantonio": "Liantonio Vernici",

        "sait abrasivi": "Sait abrasivi",
        "sait": "Sait abrasivi",

        "black": "Stanley Black+Decker",
        "black decker": "Stanley Black+Decker",
        "black e decker": "Stanley Black+Decker",
        "blackdecker": "Stanley Black+Decker",
        "stanley": "Stanley Black+Decker",
        "stanley black decker": "Stanley Black+Decker",
        "stanley black e decker": "Stanley Black+Decker",
        "stanley blackdecker": "Stanley Black+Decker",

        "capaldo": "Capaldo",
        "deodato": "Deodato",
        "tassani": "Tassani",
        "italiancolor": "Italiancolor",
        "italian color": "Italiancolor",

        "saratoga": "Saratoga",
        "duemme": "Duemme",
        "garsport": "Garsport",

        "pasquale romito cataldo": "Pasquale Romito Cataldo",
        "romito": "Pasquale Romito Cataldo",

        "tecfi": "Tecfi",
        "viglietta": "Viglietta",
        "prochimica": "Prochimica",

        "fratelli vitale": "Fratelli Vitale",
        "flli vitale": "Fratelli Vitale",
        "f lli vitale": "Fratelli Vitale",

        "madras": "Madras",
    }

    return aliases.get(cleaned, raw)
