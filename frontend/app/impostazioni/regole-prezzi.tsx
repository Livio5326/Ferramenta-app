import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import AppButton from "@/src/components/AppButton";
import { api } from "@/src/api";
import {
  getPricingMarkupsOffline,
  savePricingMarkupsOffline,
} from "@/src/local/db";
import { PricingMarkups } from "@/src/pricing";
import { COLORS, FONTS } from "@/src/theme";

const FIELDS: { key: keyof PricingMarkups; label: string }[] = [
  { key: "upTo3", label: "Da 0 € a 3,00 €" },
  { key: "upTo6", label: "Da 3,01 € a 6,00 €" },
  { key: "upTo18", label: "Da 6,01 € a 18,00 €" },
  { key: "upTo30", label: "Da 18,01 € a 30,00 €" },
  { key: "over30", label: "Da 30,01 € in su" },
];

export default function RegolePrezziScreen() {
  const router = useRouter();
  const [values, setValues] = useState<Record<keyof PricingMarkups, string>>(() => {
    const saved = getPricingMarkupsOffline();
    return Object.fromEntries(
      FIELDS.map(({ key }) => [key, String(saved[key])])
    ) as Record<keyof PricingMarkups, string>;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getPricingSettings()
      .then(({ markups }) => {
        savePricingMarkupsOffline(markups);
        setValues(Object.fromEntries(
          FIELDS.map(({ key }) => [key, String(markups[key])])
        ) as Record<keyof PricingMarkups, string>);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const parseValues = (): PricingMarkups | null => {
    const parsed = {} as PricingMarkups;
    for (const { key } of FIELDS) {
      const value = Number(values[key].replace(",", "."));
      if (!Number.isFinite(value) || value < 0 || value > 500) {
        Alert.alert("Valore non valido", "Inserisci percentuali tra 0 e 500.");
        return null;
      }
      parsed[key] = value;
    }
    return parsed;
  };

  const save = () => {
    const markups = parseValues();
    if (!markups) return;

    Alert.alert(
      "Aggiornare i prezzi?",
      "Le nuove percentuali ricalcoleranno i prezzi di vendita di tutti i prodotti con un prezzo d'acquisto.",
      [
        { text: "ANNULLA", style: "cancel" },
        {
          text: "AGGIORNA",
          onPress: async () => {
            try {
              setSaving(true);
              const result = await api.updatePricingSettings(markups);
              savePricingMarkupsOffline(result.markups);
              Alert.alert(
                "Regole aggiornate",
                `Prodotti condivisi ricalcolati: ${result.updated_products}`
              );
            } catch (error: any) {
              Alert.alert(
                "Aggiornamento non riuscito",
                error?.message || "Il backend non è raggiungibile."
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <AppButton style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={COLORS.onSurface} />
          </AppButton>
          <View style={styles.headerText}>
            <Text style={styles.title}>REGOLE PREZZI</Text>
            <Text style={styles.subtitle}>Ricarichi sul prezzo d’acquisto</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Il prezzo finale include IVA al 22% ed è arrotondato al decimo di euro più vicino.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.brand} style={styles.loader} />
        ) : (
          <View style={styles.card}>
            {FIELDS.map(({ key, label }) => (
              <View key={key} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={values[key]}
                    onChangeText={(value) =>
                      setValues((current) => ({ ...current, [key]: value }))
                    }
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={styles.input}
                  />
                  <Text style={styles.percent}>%</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <AppButton
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={save}
          disabled={saving || loading}
        >
          <Text style={styles.saveText}>
            {saving ? "AGGIORNAMENTO..." : "SALVA E RICALCOLA"}
          </Text>
        </AppButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { padding: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  headerText: { flex: 1 },
  backButton: {
    width: 42, height: 42, borderRadius: 12, alignItems: "center",
    justifyContent: "center", backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1, borderColor: COLORS.border,
  },
  title: { fontFamily: FONTS.display, fontSize: 22, fontWeight: "900", color: COLORS.onSurface },
  subtitle: { marginTop: 4, fontSize: 13, color: COLORS.onSurfaceSecondary },
  infoBox: { padding: 14, borderRadius: 14, backgroundColor: "#EFE5D6", marginBottom: 14 },
  infoText: { fontSize: 13, lineHeight: 19, color: COLORS.onSurfaceSecondary },
  loader: { marginVertical: 40 },
  card: {
    padding: 16, borderRadius: 18, backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  fieldRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  fieldLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.onSurface },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  input: {
    width: 72, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#FFFFFF",
    textAlign: "right", fontSize: 16, fontWeight: "800", color: COLORS.onSurface,
  },
  percent: { fontSize: 15, fontWeight: "800", color: COLORS.onSurfaceSecondary },
  saveButton: {
    minHeight: 52, borderRadius: 14, backgroundColor: COLORS.brand,
    alignItems: "center", justifyContent: "center",
  },
  saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", letterSpacing: 0.8 },
  disabled: { opacity: 0.55 },
});
