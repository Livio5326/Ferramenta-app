import { useCallback, useState } from "react";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { COLORS, FONTS, fmtEUR } from "@/src/theme";
import { api } from "@/src/api";
import { getDb } from "@/src/local/db";

type StatsData = {
  valore_magazzino?: number;
  valore_vendita_potenziale?: number;
  total_products?: number;
  total_pieces?: number;
  vendite_totali?: number;
  numero_vendite?: number;
  sotto_scorta_count?: number;
  totale_costi_secondari_fornitori?: number;
  costi_secondari_fornitori_per_tipo?: {
    tipo: string;
    totale: number;
  }[];
  categorie?: {
    nome: string;
    count: number;
  }[];
};

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const db = getDb();

    const prodotti = db.getFirstSync<any>(`
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(quantita), 0) AS total_pieces,
        COALESCE(SUM(quantita * prezzo_acquisto), 0) AS valore_magazzino,
        COALESCE(SUM(quantita * prezzo_vendita), 0) AS valore_vendita_potenziale,
        COALESCE(SUM(CASE WHEN quantita <= soglia_scorta THEN 1 ELSE 0 END), 0) AS sotto_scorta_count
      FROM products
    `);

    const vendite = db.getFirstSync<any>(`
      SELECT
        COUNT(*) AS numero_vendite
      FROM sales
    `);

    const categorie = db.getAllSync<any>(`
      SELECT
        COALESCE(categoria, 'Senza categoria') AS nome,
        COUNT(*) AS count
      FROM products
      GROUP BY COALESCE(categoria, 'Senza categoria')
      ORDER BY count DESC
      LIMIT 8
      `);

    setStats({
      valore_magazzino: Number(prodotti?.valore_magazzino || 0),
      valore_vendita_potenziale: Number(prodotti?.valore_vendita_potenziale || 0),
      total_products: Number(prodotti?.total_products || 0),
      total_pieces: Number(prodotti?.total_pieces || 0),
      vendite_totali: Number(vendite?.vendite_totali || 0),
      numero_vendite: Number(vendite?.numero_vendite || 0),
      sotto_scorta_count: Number(prodotti?.sotto_scorta_count || 0),
      totale_costi_secondari_fornitori: 0,
      costi_secondari_fornitori_per_tipo: [],
      categorie: Array.isArray(categorie) ? categorie : [],
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      // niente panico, già abbastanza caos nel mondo
    }
    setRefreshing(false);
  };

  const categorie = stats?.categorie || [];
  const maxCategoria = categorie[0]?.count || 1;

  return (
    <SafeAreaView style={styles.safe} testID="stats-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Statistiche</Text>
        <Text style={styles.subtitle}>Magazzino • Vendite</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.brand}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>VALORE VENDITA POTENZIALE</Text>
          <Text style={styles.heroValue}>
            {fmtEUR(stats?.valore_vendita_potenziale || 0)}
          </Text>
          <Text style={styles.heroSub}>
            Valore stimato del magazzino ai prezzi di vendita.
          </Text>
        </View>

        <View style={styles.grid}>
          <StatCard
            label="Valore a costo"
            value={fmtEUR(stats?.valore_magazzino || 0)}
          />

          <StatCard
            label="Referenze"
            value={String(stats?.total_products || 0)}
            footer="prodotti"
          />

          <StatCard
            label="Pezzi totali"
            value={String(stats?.total_pieces || 0)}
            footer="unità"
          />

          <StatCard
            label="Vendite totali"
            value={fmtEUR(stats?.vendite_totali || 0)}
            footer={`${stats?.numero_vendite || 0} transazioni`}
            highlight
          />
        </View>

        <View
          style={[
            styles.alertCard,
            (stats?.sotto_scorta_count || 0) > 0 && styles.alertCardActive,
          ]}
        >
          <Text
            style={[
              styles.alertLabel,
              (stats?.sotto_scorta_count || 0) > 0 && styles.alertLabelActive,
            ]}
          >
            SOTTO SCORTA
          </Text>

          <Text
            style={[
              styles.alertValue,
              (stats?.sotto_scorta_count || 0) > 0 && styles.alertValueActive,
            ]}
          >
            {stats?.sotto_scorta_count || 0}
          </Text>

          <Text
            style={[
              styles.alertFooter,
              (stats?.sotto_scorta_count || 0) > 0 && styles.alertFooterActive,
            ]}
          >
            prodotti da controllare
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>COSTI SECONDARI FORNITORI</Text>
            <Text style={styles.sectionSubtitle}>
              Spedizione, imballaggio, bollo e altri costi non prodotto
            </Text>
          </View>

          <View style={styles.grid}>
            <StatCard
              label="Totale costi secondari"
              value={fmtEUR(stats?.totale_costi_secondari_fornitori || 0)}
              footer="fornitori"
              highlight
            />
          </View>

          {(stats?.costi_secondari_fornitori_per_tipo || []).length > 0 ? (
            (stats?.costi_secondari_fornitori_per_tipo || []).map((c) => {
              const totale = stats?.totale_costi_secondari_fornitori || 0;
              const pct = totale > 0 ? Math.max(4, Math.round(((c.totale || 0) / totale) * 100)) : 4;

              return (
                <View key={c.tipo} style={styles.categoryCard}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {c.tipo}
                    </Text>
                    <Text style={styles.categoryCount}>{fmtEUR(c.totale || 0)}</Text>
                  </View>

                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyHint}>
              Nessun costo secondario registrato.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DISTRIBUZIONE CATEGORIE</Text>
            <Text style={styles.sectionSubtitle}>
              Prime {Math.min(categorie.length, 10)} categorie
            </Text>
          </View>

          {categorie.slice(0, 10).map((c) => {
            const pct = Math.max(4, Math.round((c.count / maxCategoria) * 100));

            return (
              <View key={c.nome} style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {c.nome}
                  </Text>
                  <Text style={styles.categoryCount}>{c.count}</Text>
                </View>

                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}

          {categorie.length === 0 ? (
            <Text style={styles.emptyHint}>
              Nessun dato. Aggiungi prodotti o aggiorna il catalogo.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  footer,
  highlight = false,
}: {
  label: string;
  value: string;
  footer?: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>
        {label.toUpperCase()}
      </Text>

      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        {value}
      </Text>

      {footer ? (
        <Text
          style={[styles.statFooter, highlight && styles.statFooterHighlight]}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  header: {
    paddingHorizontal: 18,
    paddingTop: 45,
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

  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },

  heroCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    borderRadius: 22,
    padding: 18,
  },

  heroLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.onSurfaceSecondary,
    letterSpacing: 1.4,
    marginBottom: 8,
  },

  heroValue: {
    fontFamily: FONTS.display,
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.success,
  },

  heroSub: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.onSurfaceSecondary,
    marginTop: 8,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    width: "48%",
    minHeight: 122,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    borderRadius: 18,
    padding: 14,
    justifyContent: "space-between",
  },

  statCardHighlight: {
    backgroundColor: COLORS.surfaceInverse,
    borderColor: COLORS.surfaceInverse,
  },

  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.onSurfaceSecondary,
    letterSpacing: 1.2,
  },

  statLabelHighlight: {
    color: COLORS.brandTertiary,
  },

  statValue: {
    fontFamily: FONTS.display,
    fontSize: 23,
    fontWeight: "900",
    color: COLORS.onSurface,
    marginTop: 10,
  },

  statValueHighlight: {
    color: COLORS.onSurfaceInverse,
  },

  statFooter: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.onSurfaceSecondary,
    marginTop: 8,
  },

  statFooterHighlight: {
    color: COLORS.brandTertiary,
  },

  alertCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    borderRadius: 18,
    padding: 16,
  },

  alertCardActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },

  alertLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.onSurfaceSecondary,
    letterSpacing: 1.4,
  },

  alertLabelActive: {
    color: COLORS.onError,
  },

  alertValue: {
    fontFamily: FONTS.display,
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.onSurface,
    marginTop: 6,
  },

  alertValueActive: {
    color: COLORS.onError,
  },

  alertFooter: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.onSurfaceSecondary,
    marginTop: 4,
  },

  alertFooterActive: {
    color: COLORS.onError,
  },

  section: {
    marginTop: 4,
    gap: 10,
  },

  sectionHeader: {
    marginTop: 6,
    marginBottom: 2,
  },

  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: 0.8,
  },

  sectionSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.onSurfaceSecondary,
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: "uppercase",
  },

  categoryCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    padding: 13,
  },

  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  categoryName: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.onSurface,
    letterSpacing: 0.8,
    fontWeight: "900",
  },

  categoryCount: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.brand,
    fontWeight: "900",
  },

  bar: {
    height: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 999,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    backgroundColor: COLORS.brand,
  },

  emptyHint: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.onSurfaceSecondary,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
  },
});
