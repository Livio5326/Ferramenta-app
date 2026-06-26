export const FORNITORI_STANDARD = [
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
];

export function normalizzaFornitoreLocale(value?: string | null) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const cleaned = raw
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const aliases: Record<string, string> = {
    "de santis": "De Santis",
    "de santis nicola": "De Santis",
    "de santis nicola srl": "De Santis",
    "de santis nicola s r l": "De Santis",

    "c&c": "C&C",
    "c e c": "C&C",
    "c c": "C&C",

    "dfl": "DFL",

    "viridex": "Viridex",

    "liantonio vernici": "Liantonio Vernici",
    "liantonio": "Liantonio Vernici",

    "sait abrasivi": "Sait abrasivi",
    "sait": "Sait abrasivi",

    "stanley black+decker": "Stanley Black+Decker",
    "stanley black decker": "Stanley Black+Decker",
    "stanley black & decker": "Stanley Black+Decker",
    "stanley black and decker": "Stanley Black+Decker",

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
    "f.lli vitale": "Fratelli Vitale",

    "madras": "Madras",
  };

  return aliases[cleaned] || raw;
}
