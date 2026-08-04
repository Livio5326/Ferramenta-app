from invoice_importer import parse_invoice_xml


SAMPLE_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="urn:test">
  <p:FatturaElettronicaHeader>
    <p:CedentePrestatore><p:DatiAnagrafici>
      <p:IdFiscaleIVA><p:IdPaese>IT</p:IdPaese><p:IdCodice>01234567890</p:IdCodice></p:IdFiscaleIVA>
      <p:Anagrafica><p:Denominazione>Fornitore Test SRL</p:Denominazione></p:Anagrafica>
    </p:DatiAnagrafici></p:CedentePrestatore>
  </p:FatturaElettronicaHeader>
  <p:FatturaElettronicaBody>
    <p:DatiGenerali><p:DatiGeneraliDocumento><p:Data>2026-08-01</p:Data><p:Numero>FT-1</p:Numero></p:DatiGeneraliDocumento></p:DatiGenerali>
    <p:DatiBeniServizi><p:DettaglioLinee>
      <p:NumeroLinea>1</p:NumeroLinea>
      <p:CodiceArticolo><p:CodiceTipo>EAN</p:CodiceTipo><p:CodiceValore>8050000000002</p:CodiceValore></p:CodiceArticolo>
      <p:Descrizione>Martello test</p:Descrizione><p:Quantita>2</p:Quantita>
      <p:PrezzoUnitario>12</p:PrezzoUnitario><p:PrezzoTotale>20</p:PrezzoTotale>
    </p:DettaglioLinee></p:DatiBeniServizi>
  </p:FatturaElettronicaBody>
</p:FatturaElettronica>"""


def test_parse_invoice_with_namespace():
    invoice = parse_invoice_xml(SAMPLE_XML)
    assert invoice["numero_fattura"] == "FT-1"
    assert invoice["partita_iva"] == "01234567890"
    assert invoice["fornitore"] == "Fornitore Test SRL"
    assert invoice["righe"][0]["barcode"] == "8050000000002"
    assert invoice["righe"][0]["quantita"] == 2
    assert invoice["righe"][0]["prezzo_unitario"] == 10.0
