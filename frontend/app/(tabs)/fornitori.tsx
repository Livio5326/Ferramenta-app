import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from "expo-document-picker";
import {
  api,
  createPendingInvoiceProducts,
  getInvoiceProducts,
  importInvoiceXml,
  listInvoiceImports,
} from "../../src/api";

import AppButton from '@/src/components/AppButton';

const INVOICES_PER_PAGE = 10;

export default function FornitoriScreen() {
  const [importingInvoice, setImportingInvoice] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<any>(null);
  const [invoiceImports, setInvoiceImports] = useState<any[]>([]);
  const [loadingImports, setLoadingImports] = useState(false);
  const [missingProducts, setMissingProducts] = useState<any[]>([]);
  const [loadingMissing, setLoadingMissing] = useState(false);
  const [expandedInvoiceKey, setExpandedInvoiceKey] =
    useState<string | null>(null);
  const [invoiceProducts, setInvoiceProducts] =
    useState<any[]>([]);
  const [loadingInvoiceProducts, setLoadingInvoiceProducts] =
    useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const handleCreateSelectedProducts = async () => {
  try {
    const selectedItems = missingProducts
      .filter((item) => item.selected)
      .filter((item) => {
        const descrizione = String(item?.descrizione || "").trim();

        return (
          descrizione &&
          descrizione !== "-" &&
          descrizione.toLowerCase() !== "n/d"
        );
      });

    if (selectedItems.length === 0) {
      Alert.alert("Nessun prodotto", "Seleziona almeno un prodotto valido da creare.");
      return;
    }

    const result = await createPendingInvoiceProducts(selectedItems);

    Alert.alert(
      "Prodotti creati",
      `Creati: ${result.creati}\nGià presenti: ${result.gia_presenti}\nSaltati: ${result.saltati}`
    );

    setMissingProducts([]);
    await loadInvoiceImports();

} catch (err: any) {
  console.log("ERRORE RAW:", err);
  console.log("ERRORE MESSAGE:", err?.message);
  console.log("ERRORE DETAIL:", err?.detail);
  console.log("ERRORE RESPONSE:", err?.response);
  console.log("ERRORE DATA:", err?.response?.data);

  const messaggioErrore =
    err?.response?.data?.detail
      ? JSON.stringify(err.response.data.detail, null, 2)
      : err?.response?.data
      ? JSON.stringify(err.response.data, null, 2)
      : err?.detail
      ? JSON.stringify(err.detail, null, 2)
      : err?.message
      ? err.message
      : String(err);

  Alert.alert("Errore creazione prodotti", messaggioErrore);
}
};


const loadInvoiceImports = useCallback(async () => {
  try {
    setLoadingImports(true);

    const result = await listInvoiceImports();

    setInvoiceImports(
      Array.isArray(result) ? result : result?.items || []
    );
  } catch (e) {
    console.warn("Errore caricamento storico fatture", e);
    setInvoiceImports([]);
  } finally {
    setLoadingImports(false);
  }
}, []);

useEffect(() => {
  void loadInvoiceImports();
}, [loadInvoiceImports]);

const totalInvoicePages = Math.max(
  1,
  Math.ceil(invoiceImports.length / INVOICES_PER_PAGE)
);
const currentInvoicePage = Math.min(invoicePage, totalInvoicePages);
const paginatedInvoiceImports = invoiceImports.slice(
  (currentInvoicePage - 1) * INVOICES_PER_PAGE,
  currentInvoicePage * INVOICES_PER_PAGE
);

useEffect(() => {
  if (invoicePage > totalInvoicePages) {
    setInvoicePage(totalInvoicePages);
  }
}, [invoicePage, totalInvoicePages]);

const changeInvoicePage = (nextPage: number) => {
  const safePage = Math.max(1, Math.min(nextPage, totalInvoicePages));

  if (safePage === currentInvoicePage) {
    return;
  }

  setInvoicePage(safePage);
  setExpandedInvoiceKey(null);
  setInvoiceProducts([]);
};

const renderInvoicePagination = () => (
  <View style={styles.pagination}>
    <AppButton
      style={[
        styles.paginationButton,
        currentInvoicePage === 1 && styles.paginationButtonDisabled,
      ]}
      onPress={() => changeInvoicePage(currentInvoicePage - 1)}
      disabled={currentInvoicePage === 1}
    >
      <Text style={styles.paginationButtonText}>PRECEDENTE</Text>
    </AppButton>

    <Text style={styles.paginationLabel}>
      Pagina {currentInvoicePage} di {totalInvoicePages}
    </Text>

    <AppButton
      style={[
        styles.paginationButton,
        currentInvoicePage === totalInvoicePages &&
          styles.paginationButtonDisabled,
      ]}
      onPress={() => changeInvoicePage(currentInvoicePage + 1)}
      disabled={currentInvoicePage === totalInvoicePages}
    >
      <Text style={styles.paginationButtonText}>SUCCESSIVA</Text>
    </AppButton>
  </View>
);

const loadMissingProducts = async (invoice: any) => {
    const numeroFattura = String(
      invoice?.numero || invoice?.numero_fattura || invoice?.fattura || ""
    ).trim();

    if (!numeroFattura) {
      Alert.alert("Fattura", "Numero fattura non trovato.");
      return;
    }

    setLoadingMissing(true);

    try {
      const prodotti = await api.getPendingInvoiceProducts(numeroFattura);
      setMissingProducts(prodotti || []);
    } catch (e) {
      console.warn("Errore caricamento prodotti non trovati", e);
      Alert.alert("Errore", "Impossibile caricare i prodotti non trovati.");
    } finally {
      setLoadingMissing(false);
    }
  };

  const loadInvoiceProducts = async (invoice: any) => {
    const key = String(invoice?.chiave_import || "").trim();

    if (!key) {
      Alert.alert("Errore", "Chiave della fattura non disponibile.");
      return;
    }

    if (expandedInvoiceKey === key) {
      setExpandedInvoiceKey(null);
      setInvoiceProducts([]);
      return;
    }

    try {
      setLoadingInvoiceProducts(true);

      const products = await getInvoiceProducts(key);

      setInvoiceProducts(Array.isArray(products) ? products : []);
      setExpandedInvoiceKey(key);
      await loadInvoiceImports();
    } catch (e: any) {
      Alert.alert(
        "Dettaglio non disponibile",
        e?.message || "Impossibile leggere i prodotti della fattura."
      );
    } finally {
      setLoadingInvoiceProducts(false);
    }
  };

  const handleImportInvoiceXml = async () => {
    try {
      setImportingInvoice(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets?.[0];

      if (!file) {
        Alert.alert("Errore", "File non selezionato.");
        return;
      }

      const fileName = String(file.name || "").toLowerCase();

      if (!fileName.endsWith(".xml")) {
        Alert.alert("File non valido", "Seleziona una fattura in formato XML.");
        return;
      }

      const importResult = await importInvoiceXml({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
      });

    setInvoiceResult(importResult);

      if (importResult?.gia_importata) {
        Alert.alert(
          "Fattura già importata",
          `La fattura ${importResult.numero || ""} risulta già caricata.`
          );
      } else {
        Alert.alert(
          "Import completato",
          `Prodotti aggiornati: ${importResult?.prodotti_aggiornati ?? 0}\nProdotti non trovati: ${importResult?.barcode_non_trovati ?? 0}\nRighe saltate: ${importResult?.righe_saltate ?? 0}`
        );
      }

      await loadInvoiceImports();
    } catch (e: any) {
      console.warn("Errore import fattura XML", e);

      Alert.alert(
        "Errore import fattura XML",
        e?.message || String(e)
      );
    } finally {
      setImportingInvoice(false);
    }
  };  

return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Fornitori</Text>
        <Text style={styles.subtitle}>
          Gestione carichi merce e fatture XML fornitori.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Import fattura XML</Text>
        <Text style={styles.cardText}>
          Carica una fattura elettronica XML. L’app leggerà gli EAN, aggiornerà
          le quantità dei prodotti già presenti e segnalerà quelli non trovati.
        </Text>

        <AppButton
          style={[styles.primaryButton, importingInvoice && styles.disabled]}
          onPress={handleImportInvoiceXml}
          disabled={importingInvoice}
        >
          <Text style={styles.primaryButtonText}>
            {importingInvoice ? "IMPORT IN CORSO..." : "IMPORTA FATTURA XML"}
          </Text>
        </AppButton>
      </View>

      <View style={styles.card}>
  <View style={styles.sectionHeader}>
    <Text style={styles.cardTitle}>Storico fatture importate</Text>

    <AppButton onPress={loadInvoiceImports} disabled={loadingImports}>
      <Text style={styles.refreshText}>
        {loadingImports ? "CARICO..." : "AGGIORNA"}
      </Text>
    </AppButton>
  </View>

  {invoiceImports.length === 0 ? (
    <Text style={styles.cardText}>
      Nessuna fattura importata trovata.
    </Text>
  ) : (
    <>
      {renderInvoicePagination()}

      {paginatedInvoiceImports.map((item) => (
      <View key={item.chiave_import} style={styles.invoiceRow}>
        <Text style={styles.invoiceTitle}>
          {item.denominazione || "Fornitore non indicato"}
        </Text>

        <Text style={styles.invoiceText}>
          Fattura: {item.numero || "N/D"} · Data: {item.data || "N/D"}
        </Text>

        <View style={styles.invoiceStats}>
          <Text style={styles.invoiceStat}>
            Importati: {item.prodotti_importati ?? item.prodotti_aggiornati ?? item.aggiornati ?? 0}
          </Text>
          <Text style={styles.invoiceStat}>
            Non trovati: {item.barcode_non_trovati ?? 0}
          </Text>
          <Text style={styles.invoiceStat}>
            Saltati: {item.righe_saltate ?? 0}
          </Text>
        </View>

        <AppButton
  style={{
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#EEF6F0",
  }}
  onPress={() => loadInvoiceProducts(item)}
  disabled={loadingInvoiceProducts}
>
  <Text
    style={{
      color: "#176B3A",
      fontWeight: "700",
      textAlign: "center",
    }}
  >
    {expandedInvoiceKey === item.chiave_import
      ? "NASCONDI PRODOTTI"
      : loadingInvoiceProducts
      ? "CARICO..."
      : "VEDI TUTTI I PRODOTTI"}
  </Text>
</AppButton>

        {expandedInvoiceKey === item.chiave_import ? (
          <View style={styles.invoiceProductsList}>
            {invoiceProducts.length > 0 ? (
              invoiceProducts.map((product, index) => (
                <View
                  key={`${product.linea || product.barcode || product.codice_fornitore || "prodotto"}_${index}`}
                  style={styles.invoiceProductRow}
                >
                  <Text style={styles.invoiceProductTitle}>
                    {product.descrizione || "Prodotto senza descrizione"}
                  </Text>

                  <Text style={styles.invoiceProductMeta}>
                    {product.barcode
                      ? `EAN: ${product.barcode}`
                      : `Codice: ${product.codice_fornitore || "N/D"}`}
                  </Text>

                  <Text style={styles.invoiceProductMeta}>
                    Qta: {Number(product.quantita || 0)} · Unitario: {Number(product.prezzo_unitario || 0).toFixed(2)} €
                    {product.prezzo_totale != null
                      ? ` · Totale: ${Number(product.prezzo_totale || 0).toFixed(2)} €`
                      : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.invoiceProductsEmpty}>
                Nessun prodotto leggibile trovato nella fattura.
              </Text>
            )}
          </View>
        ) : null}

        {expandedInvoiceKey === item.chiave_import &&
        Array.isArray(item.costi_secondari_fornitori) &&
        item.costi_secondari_fornitori.length > 0 ? (
          <View style={styles.secondaryCostsBox}>
            <Text style={styles.secondaryCostsTitle}>
              COSTI SECONDARI FORNITORE
            </Text>

            {item.costi_secondari_fornitori.map((cost: any, index: number) => (
              <View
                key={`${cost.tipo || "costo"}_${cost.descrizione || index}`}
                style={styles.secondaryCostRow}
              >
                <View style={styles.secondaryCostInfo}>
                  <Text style={styles.secondaryCostType}>
                    {cost.tipo || "Altro costo secondario"}
                  </Text>
                  <Text style={styles.secondaryCostDescription}>
                    {cost.descrizione || "Senza descrizione"}
                  </Text>
                </View>
                <Text style={styles.secondaryCostAmount}>
                  {Number(cost.importo || 0).toFixed(2)} €
                </Text>
              </View>
            ))}
          </View>
        ) : null}

       {Number(item.barcode_non_trovati ?? item.non_trovati ?? item.prodotti_non_trovati ?? item.not_found ?? 0) > 0 ? (
  <AppButton
    style={styles.missingButton}
    onPress={() => loadMissingProducts(item)}
    disabled={loadingMissing}
  >
    <Text style={styles.missingButtonText}>
      {loadingMissing ? "CARICO..." : "VEDI PRODOTTI NON TROVATI"}
    </Text>
  </AppButton>
) : null}

        {item.registrata_manualmente ? (
          <Text style={styles.manualBadge}>REGISTRATA MANUALMENTE</Text>
        ) : null}
      </View>
      ))}

      {renderInvoicePagination()}
    </>
  )}
</View>
      {invoiceResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            {invoiceResult.ok ? "Ultimo import completato" : "Import non eseguito"}
          </Text>

          <Text style={styles.resultText}>
            Fornitore: {invoiceResult.fornitore || invoiceResult.denominazione || "N/D"}
          </Text>
          <Text style={styles.resultText}>
            Numero fattura: {invoiceResult.numero || "N/D"}
          </Text>
          <Text style={styles.resultText}>
            Data fattura: {invoiceResult.data || "N/D"}
          </Text>

          {invoiceResult.ok ? (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {invoiceResult.prodotti_aggiornati ?? 0}
                  </Text>
                  <Text style={styles.statLabel}>Aggiornati</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {invoiceResult.barcode_non_trovati ?? 0}
                  </Text>
                  <Text style={styles.statLabel}>Non trovati</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {invoiceResult.righe_saltate ?? 0}
                  </Text>
                  <Text style={styles.statLabel}>Saltati</Text>
                </View>
              </View>

              {invoiceResult.file_non_trovati ? (
                <Text style={styles.smallText}>
                  File non trovati creato: {invoiceResult.file_non_trovati}
                </Text>
              ) : null}

              {invoiceResult.report ? (
                <Text style={styles.smallText}>
                  Report creato: {invoiceResult.report}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.errorText}>
              {invoiceResult.errore || "Errore sconosciuto"}
            </Text>
          )}
        </View>
      )}

      {missingProducts.length > 0 ? (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Prodotti non trovati</Text>

    <Text style={styles.cardText}>
      Deseleziona i prodotti che NON vuoi creare. Quelli selezionati verranno
      creati nel catalogo con prezzo vendita 0.
    </Text>

    {missingProducts.map((item, index) => (
      <AppButton
        key={`${item.barcode}_${index}`}
        style={[
          styles.missingProductRow,
          item.selected && styles.missingProductSelected,
        ]}
        onPress={() => {
          setMissingProducts((prev) =>
            prev.map((p, i) =>
              i === index ? { ...p, selected: !p.selected } : p
            )
          );
        }}
      >
        <View style={styles.checkboxBox}>
          <Text style={styles.checkboxText}>{item.selected ? "✓" : ""}</Text>
        </View>

        <View style={styles.missingProductInfo}>
          <Text style={styles.missingProductTitle}>
            {item.descrizione || "Senza descrizione"}
          </Text>

          <Text style={styles.missingProductText}>
            Barcode: {item.barcode || "N/D"}
          </Text>

          <Text style={styles.missingProductText}>
            Codice: {item.codice_fornitore || "N/D"} · Qta:{" "}
            {item.quantita || "0"} · Acquisto: {item.prezzo_unitario || "0"} €
          </Text>
        </View>
      </AppButton>
    ))}

     <AppButton
  style={styles.primaryButton}
  onPress={handleCreateSelectedProducts}
>
  <Text style={styles.primaryButtonText}>
    CREA PRODOTTI SELEZIONATI
  </Text>
</AppButton>
  </View>
) : null}

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Nota pratica</Text>
        <Text style={styles.noteText}>
          Se la fattura è già stata importata, il sistema la blocca e non
          modifica le quantità. Finalmente un software che non si fida del dito
          umano sul tasto due volte.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4EFE6",
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2F2A22",
    letterSpacing: 0.5,
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#6F6252",
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#FFF9EF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7C7AF",
    padding: 16,
    marginBottom: 14,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2F2A22",
    marginBottom: 8,
  },

  cardText: {
    fontSize: 14,
    color: "#6F6252",
    lineHeight: 20,
    marginBottom: 14,
  },

  primaryButton: {
    backgroundColor: "#315C3A",
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1,
  },

  disabled: {
    opacity: 0.55,
  },

  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7C7AF",
    padding: 16,
    marginBottom: 14,
  },

  resultTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#2F2A22",
    marginBottom: 10,
  },

  resultText: {
    fontSize: 13,
    color: "#4A4033",
    marginBottom: 5,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },

  statBox: {
    flex: 1,
    backgroundColor: "#EFE5D6",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },

  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#315C3A",
  },

  statLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    color: "#6F6252",
  },

  smallText: {
    fontSize: 11,
    color: "#6F6252",
    marginTop: 6,
  },

  errorText: {
    marginTop: 10,
    fontSize: 13,
    color: "#8B1E1E",
    fontWeight: "800",
  },

  noteCard: {
    backgroundColor: "#EFE5D6",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D7C7AF",
  },

  noteTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2F2A22",
    marginBottom: 6,
  },

  noteText: {
    fontSize: 13,
    color: "#6F6252",
    lineHeight: 19,
  },
  sectionHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
},

refreshText: {
  fontSize: 12,
  fontWeight: "900",
  color: "#315C3A",
  letterSpacing: 0.8,
},

invoiceRow: {
  borderTopWidth: 1,
  borderTopColor: "#D7C7AF",
  paddingTop: 12,
  marginTop: 12,
},

invoiceTitle: {
  fontSize: 14,
  fontWeight: "900",
  color: "#2F2A22",
  marginBottom: 4,
},

invoiceText: {
  fontSize: 12,
  color: "#6F6252",
  marginBottom: 8,
},

invoiceStats: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8,
},

invoiceStat: {
  fontSize: 11,
  fontWeight: "800",
  color: "#315C3A",
  backgroundColor: "#EFE5D6",
  paddingHorizontal: 8,
  paddingVertical: 5,
  borderRadius: 999,
},

invoiceProductsList: {
  marginTop: 10,
  gap: 8,
},

invoiceProductRow: {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#D7C7AF",
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
},

invoiceProductTitle: {
  fontSize: 13,
  fontWeight: "800",
  color: "#2F2A22",
  marginBottom: 4,
},

invoiceProductMeta: {
  fontSize: 11,
  color: "#6F6252",
  lineHeight: 16,
},

invoiceProductsEmpty: {
  paddingVertical: 10,
  textAlign: "center",
  fontSize: 12,
  color: "#6F6252",
},

secondaryCostsBox: {
  marginTop: 10,
  borderWidth: 1,
  borderColor: "#D4A373",
  backgroundColor: "#F7E8D0",
  borderRadius: 12,
  padding: 12,
  gap: 8,
},

secondaryCostsTitle: {
  fontSize: 11,
  fontWeight: "900",
  color: "#8B5A2B",
  letterSpacing: 0.7,
},

secondaryCostRow: {
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
},

secondaryCostInfo: {
  flex: 1,
},

secondaryCostType: {
  fontSize: 12,
  fontWeight: "800",
  color: "#4A4033",
},

secondaryCostDescription: {
  marginTop: 2,
  fontSize: 11,
  color: "#6F6252",
},

secondaryCostAmount: {
  fontSize: 12,
  fontWeight: "900",
  color: "#8B5A2B",
},

manualBadge: {
  marginTop: 8,
  fontSize: 10,
  fontWeight: "900",
  color: "#8B5A2B",
  letterSpacing: 0.8,
},

missingButton: {
  marginTop: 10,
  backgroundColor: "#EFE5D6",
  borderRadius: 12,
  paddingVertical: 10,
  paddingHorizontal: 12,
  alignItems: "center",
},

missingButtonText: {
  fontSize: 11,
  fontWeight: "900",
  color: "#8B1E1E",
  letterSpacing: 0.7,
},

missingProductRow: {
  flexDirection: "row",
  gap: 10,
  borderWidth: 1,
  borderColor: "#D7C7AF",
  backgroundColor: "#FFF9EF",
  borderRadius: 14,
  padding: 12,
  marginBottom: 10,
},

missingProductSelected: {
  borderColor: "#315C3A",
  backgroundColor: "#F1F7EF",
},

checkboxBox: {
  width: 26,
  height: 26,
  borderRadius: 8,
  borderWidth: 2,
  borderColor: "#315C3A",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 2,
},

checkboxText: {
  color: "#315C3A",
  fontWeight: "900",
  fontSize: 16,
},

missingProductInfo: {
  flex: 1,
},

missingProductTitle: {
  fontSize: 13,
  fontWeight: "900",
  color: "#2F2A22",
  marginBottom: 5,
},

missingProductText: {
  fontSize: 11,
  color: "#6F6252",
  marginBottom: 3,
},

pagination: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginVertical: 10,
},

paginationButton: {
  flex: 1,
  minHeight: 38,
  borderRadius: 10,
  backgroundColor: "#315C3A",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 8,
},

paginationButtonDisabled: {
  opacity: 0.4,
},

paginationButtonText: {
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: "900",
  letterSpacing: 0.4,
},

paginationLabel: {
  minWidth: 86,
  textAlign: "center",
  color: "#4A4033",
  fontSize: 12,
  fontWeight: "800",
},
});
