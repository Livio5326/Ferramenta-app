from pymongo import MongoClient
from collections import Counter, defaultdict

client = MongoClient("mongodb://localhost:27017")
db = client["ferramenta"]

products = list(db.products.find({}))
fatture = list(db.invoice_imports.find({}))

print("\n=== AUDIT GESTIONALE FERRAMENTA ===\n")

print(f"Prodotti totali: {len(products)}")
print(f"Fatture importate: {len(fatture)}")

# ---------------- PRODOTTI ----------------

senza_codice = []
senza_descrizione = []
prezzo_vendita_zero = []
prezzo_acquisto_zero = []
quantita_negativa = []
barcode_nd = []
promo_incoerenti = []
costi_accessori_vecchi = []

codici = []
barcode_list = []

for p in products:
    desc = str(p.get("descrizione") or "").strip()
    codice = str(p.get("codice_prodotto") or "").strip()
    barcode = str(p.get("barcode") or "").strip()
    prezzo_vendita = float(p.get("prezzo_vendita") or 0)
    prezzo_acquisto = float(p.get("prezzo_acquisto") or 0)
    quantita = int(p.get("quantita") or 0)

    if not codice or codice.upper() in ["N/D", "ND", "-"]:
        senza_codice.append(p)

    if not desc or desc == "-":
        senza_descrizione.append(p)

    if prezzo_vendita <= 0:
        prezzo_vendita_zero.append(p)

    if prezzo_acquisto <= 0:
        prezzo_acquisto_zero.append(p)

    if quantita < 0:
        quantita_negativa.append(p)

    if not barcode or barcode.upper() in ["N/D", "ND", "-"]:
        barcode_nd.append(p)

    if p.get("promo_attiva") and not p.get("prezzo_promo"):
        promo_incoerenti.append(p)

    if codice:
        codici.append(codice)

    if barcode and barcode.upper() not in ["N/D", "ND", "-"]:
        barcode_list.append(barcode)

codici_doppi = [k for k, v in Counter(codici).items() if v > 1]
barcode_doppi = [k for k, v in Counter(barcode_list).items() if v > 1]

print("\n--- PRODOTTI ---")
print(f"Senza codice prodotto: {len(senza_codice)}")
print(f"Senza descrizione: {len(senza_descrizione)}")
print(f"Prezzo vendita zero: {len(prezzo_vendita_zero)}")
print(f"Prezzo acquisto zero: {len(prezzo_acquisto_zero)}")
print(f"Quantità negativa: {len(quantita_negativa)}")
print(f"Barcode N/D o vuoto: {len(barcode_nd)}")
print(f"Promo attive senza prezzo promo: {len(promo_incoerenti)}")
print(f"Codici prodotto duplicati: {len(codici_doppi)}")
print(f"Barcode duplicati: {len(barcode_doppi)}")

# ---------------- FATTURE ----------------

fatture_con_costi = []
fatture_senza_costi_ma_con_secondari = []
fatture_con_costi_accessori_vecchio = []
totale_costi_secondari = 0

numeri_fattura = []

for f in fatture:
    numero = str(f.get("numero") or f.get("numero_fattura") or f.get("fattura") or "").strip()
    if numero:
        numeri_fattura.append(numero)

    costi_secondari = f.get("costi_secondari_fornitori") or []
    costi_accessori = f.get("costi_accessori")

    if costi_secondari:
        fatture_con_costi.append(f)
        for c in costi_secondari:
            totale_costi_secondari += float(c.get("importo") or 0)

    if costi_accessori is not None:
        fatture_con_costi_accessori_vecchio.append(f)

fatture_duplicate = [k for k, v in Counter(numeri_fattura).items() if v > 1]

print("\n--- FATTURE ---")
print(f"Fatture con costi secondari fornitori: {len(fatture_con_costi)}")
print(f"Totale costi secondari fornitori: {round(totale_costi_secondari, 2)} €")
print(f"Fatture con vecchio campo costi_accessori: {len(fatture_con_costi_accessori_vecchio)}")
print(f"Numeri fattura duplicati: {len(fatture_duplicate)}")

# ---------------- DETTAGLI UTILI ----------------

def stampa_esempi(titolo, lista, max_items=10):
    print(f"\n--- {titolo} ---")
    for p in lista[:max_items]:
        print({
            "descrizione": p.get("descrizione"),
            "codice_prodotto": p.get("codice_prodotto"),
            "barcode": p.get("barcode"),
            "quantita": p.get("quantita"),
            "prezzo_acquisto": p.get("prezzo_acquisto"),
            "prezzo_vendita": p.get("prezzo_vendita"),
            "fornitore": p.get("fornitore"),
            "marca": p.get("marca"),
            "categoria": p.get("categoria"),
        })

stampa_esempi("Esempi prezzo vendita zero", prezzo_vendita_zero)
stampa_esempi("Esempi senza codice", senza_codice)
stampa_esempi("Esempi senza descrizione", senza_descrizione)
stampa_esempi("Esempi promo incoerenti", promo_incoerenti)

print("\n=== FINE AUDIT ===\n")
