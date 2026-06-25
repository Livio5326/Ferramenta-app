import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { importInvoiceXml } from "../../src/api";

export default function FornitoriScreen() {
  const [importingInvoice, setImportingInvoice] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<any>(null);

  const handleImportInvoiceXml = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["text/xml", "application/xml", "text/*"],
        copyToCacheDirectory: true,
      });

      if (picked.canceled) {
        return;
      }

      const file = picked.assets?.[0];

      if (!file) {
        Alert.alert("Errore", "Nessun file selezionato");
        return;
      }

      if (!file.name?.toLowerCase().endsWith(".xml")) {
        Alert.alert("File non valido", "Seleziona una fattura in formato XML");
        return;
      }

      setImportingInvoice(true);
      setInvoiceResult(null);

      const result = await importInvoiceXml({
        uri: file.uri,
        name: file.name || "fattura.xml",
        mimeType: file.mimeType || "text/xml",
      });

      setInvoiceResult(result);

      if (result.ok) {
        Alert.alert(
          "Import completato",
          `Fornitore: ${result.fornitore || "N/D"}\n` +
            `Numero fattura: ${result.numero || "N/D"}\n\n` +
            `Prodotti aggiornati: ${result.prodotti_aggiornati}\n` +
            `Barcode non trovati: ${result.barcode_non_trovati}\n` +
            `Righe saltate: ${result.righe_saltate}`
        );
      } else {
        Alert.alert(
          "Import non eseguito",
          result.errore || "Errore sconosciuto"
        );
      }
    } catch (err: any) {
      Alert.alert("Errore import", err?.message || "Errore durante import XML");
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

        <Pressable
          style={[styles.primaryButton, importingInvoice && styles.disabled]}
          onPress={handleImportInvoiceXml}
          disabled={importingInvoice}
        >
          <Text style={styles.primaryButtonText}>
            {importingInvoice ? "IMPORT IN CORSO..." : "IMPORTA FATTURA XML"}
          </Text>
        </Pressable>
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
});
