import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "@/src/api";

const COLORS = {
  bg: "#F4EFE6",
  card: "#EFE6D8",
  brown: "#5A341F",
  brown2: "#9A633B",
  green: "#2F6B45",
  text: "#2A211B",
  muted: "#7B6A5D",
  border: "#A06A43",
};

const FONTS = {
  mono: "monospace",
};

function fmtEUR(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function fmtOra(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SaleToday = {
  id: string;
  total: number;
  created_at: string;
  articoli: number;
  pezzi: number;
  prodotto_titolo: string;
};

export default function VenditeOggiScreen() {
  const [loading, setLoading] = useState(true);
  const [vendite, setVendite] = useState<SaleToday[]>([]);

  const load = useCallback(async () => {
  setLoading(true);

  try {
    const rows = await api.listSalesToday();
    setVendite(rows || []);
  } catch (e) {
    console.warn("Caricamento vendite oggi fallito:", e);
    setVendite([]);
  } finally {
    setLoading(false);
  }
}, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totaleGiorno = vendite.reduce((sum, v) => sum + Number(v.total || 0), 0);
  const pezziGiorno = vendite.reduce((sum, v) => sum + Number(v.pezzi || 0), 0);

  const eliminaVendita = (saleId: string) => {
    Alert.alert(
      "Eliminare vendita?",
      "La vendita verrà cancellata e le quantità torneranno in magazzino.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteSale(saleId);
              await load();
            } catch (e: any) {
              Alert.alert("Errore", String(e?.message || e));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={26} color={COLORS.text} />
        </Pressable>

        <View>
          <Text style={styles.title}>Vendite di oggi</Text>
          <Text style={styles.subtitle}>Giornata corrente</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>TOTALE GIORNATA</Text>
        <Text style={styles.summaryValue}>{fmtEUR(totaleGiorno)}</Text>
        <Text style={styles.summaryMeta}>
          {vendite.length} transazioni · {pezziGiorno} pezzi
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Caricamento vendite...</Text>
        </View>
      ) : vendite.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nessuna vendita oggi</Text>
          <Text style={styles.emptyText}>
            Quando completi una vendita, comparirà qui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={vendite}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.saleCard}>
              <View style={styles.saleLeft}>
                <Text style={styles.saleTime} numberOfLines={1}>
                  {item.prodotto_titolo || "Prodotto venduto"}
                </Text>
                <Text style={styles.saleInfo}>
                  {fmtOra(item.created_at)} · {item.articoli} articoli · {item.pezzi} pezzi
                </Text>
              </View>

              <Text style={styles.saleTotal}>{fmtEUR(item.total)}</Text>
              <Pressable
                style={styles.deleteSaleBtn}
                onPress={() => eliminaVendita(item.id)}
              >
                <Feather name="trash-2" size={20} color="#A94438" />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 23,
    paddingTop: 50,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(90,52,31,0.25)",
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E9DDCD",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: FONTS.mono,
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: COLORS.muted,
  },
  summaryCard: {
    marginHorizontal: 24,
    marginTop: 18,
    marginBottom: 18,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  summaryLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 2.5,
    color: COLORS.text,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.green,
  },
  summaryMeta: {
    marginTop: 8,
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.muted,
  },
  deleteSaleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(169,68,56,0.10)",
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 30,
    gap: 12,
  },
  saleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(160,106,67,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  saleLeft: {
    flex: 1,
    minWidth: 0,
    maxWidth: "71%", 
   },
  saleTime: {
    fontSize: 18,
    fontWeight: "700",  
    color: COLORS.text,
  },
  saleInfo: {
    marginTop: 6,
    fontFamily: FONTS.mono,
    color: COLORS.muted,
    fontSize: 12,
  },
  saleTotal: {
    fontSize: 18,
    width: 90,
    textAlign: "right",
    fontWeight: "900",
    color: COLORS.brown,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
  },
  emptyCard: {
    margin: 24,
    padding: 24,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "rgba(160,106,67,0.35)",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.muted,
  },
});
