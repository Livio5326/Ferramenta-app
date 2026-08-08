import {
  useCallback,
  useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import { COLORS, FONTS, TESTO, fmtEUR } from "@/src/theme";
import { api } from "@/src/api";
import { ScreenHeader } from "@/src/components/ScreenHeader";

import AppButton from '@/src/components/AppButton';
type StatsData = {
  valore_magazzino?: number;
  valore_vendita_potenziale?: number;
  total_products?: number;
  total_pieces?: number;
  vendite_totali?: number;
  numero_vendite?: number;
  vendite_giorno?: number;
  numero_vendite_giorno?: number;
  sotto_scorta_count?: number;
  piu_venduti?: any[];
  meno_venduti?: any[];
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

    const data = await api.statistiche();
    setStats(data);
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
    <SafeAreaView style={styles.safe} edges={['top']} testID="stats-screen">
      <ScreenHeader title="Statistiche" subtitle="Magazzino • Vendite" />

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
          <Text style={[styles.heroValue, TESTO.cifra]}>
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
            label="Vendite del mese"
            value={fmtEUR(stats?.vendite_totali || 0)}
            footer={`${stats?.numero_vendite || 0} transazioni`}
          />
        </View>

        <View style={styles.smallCardsRow}>
          <StatCard
            label="Sotto scorta"
            value={String(stats?.sotto_scorta_count || 0)}
            footer="prodotti"
          />

          <AppButton
            style={styles.clickableSmallCard}
            onPress={() => router.push("/vendite-oggi")}
          >
            <Text style={styles.clickableSmallCardLabel}>VENDITE DEL GIORNO</Text>
            <Text
              style={[styles.clickableSmallCardValue, TESTO.cifra]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {fmtEUR(stats?.vendite_giorno || 0)}
            </Text>
            <Text style={[styles.clickableSmallCardFooter, TESTO.cifra]}>
              {stats?.numero_vendite_giorno || 0} transazioni
            </Text>
          </AppButton>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>PIÙ VENDUTI</Text>
          <Text style={styles.sectionSubtitle}>
            Prodotti con più pezzi venduti
          </Text>

          {(stats?.piu_venduti || []).length === 0 ? (
            <View style={styles.emptyStatBox}>
              <Text style={styles.emptyStatText}>Nessuna vendita registrata.</Text>
            </View>
          ) : (
            (stats?.piu_venduti || []).map((item: any, index: number) => (
              <AppButton 
                key={`${item.descrizione}-${index}`}
                style={styles.productStatRow}  
                onPress={() => {
                  if (item.product_id) {
                    router.push(`/product/${item.product_id}`);
                  }
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.productStatName} numberOfLines={1}>
                    {index + 1}. {item.descrizione}
                  </Text>
                  <Text style={styles.productStatMeta}>
                    {Number(item.pezzi_venduti || 0)} pezzi
                  </Text>
                </View>

                <Text style={styles.productStatValue}>
                  {fmtEUR(Number(item.totale_venduto || 0))}
                </Text>
              </AppButton>
            ))
          )}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>MENO VENDUTI</Text>
          <Text style={styles.sectionSubtitle}>
            Prodotti fermi o con poche vendite
          </Text>
   
          {(stats?.meno_venduti || []).length === 0 ? (
            <View style={styles.emptyStatBox}>
              <Text style={styles.emptyStatText}>Nessun prodotto trovato.</Text>
            </View>
          ) : (
            
             (stats?.meno_venduti || []).map((item: any, index: number) => (
                <AppButton
                  key={`${item.product_id || item.descrizione}-${index}`}
                  style={styles.productStatRow}
                  onPress={() => {
                    if (item.product_id) {
                      router.push(`/product/${item.product_id}`);
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productStatName} numberOfLines={1}>
                      {index + 1}. {item.descrizione}
                    </Text>
                    <Text style={styles.productStatMeta}>
                      {Number(item.pezzi_venduti || 0)} pezzi venduti ·{" "}
                      {Number(item.quantita_magazzino || 0)} in magazzino
                    </Text>
                  </View>

                  <Text style={styles.productStatValue}>
                    {fmtEUR(Number(item.totale_venduto || 0))}
                  </Text>
                </AppButton>
              ))

          )}
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

      <Text
        style={[styles.statValue, highlight && styles.statValueHighlight]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
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

  smallCardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  standardSmallCard: {
    width: "48%",
    height: 150,
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 20,
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
  },

  clickableSmallCard: {
    width: "48%",
    // minHeight invece di height fissa: il titolo "Vendite del giorno" va a
    // capo su due righe e con l'altezza bloccata a 126 tagliava valore e
    // "transazioni". La riga dispone in stretch, quindi la card "Sotto
    // scorta" accanto si allunga di pari passo e le due restano uguali.
    minHeight: 122,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: "center",
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.success,
  },

  smallCardLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 3,
    color: COLORS.onSurface,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  smallCardValue: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.onSurface,
  },

  smallCardFooter: {
    marginTop: 10,
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.onSurfaceSecondary,
  },

  clickableSmallCardLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.onSuccess,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // fontWeight tolto: con TESTO.cifra applicato in JSX la fontFamily diventa
  // il monospace del tema, e su Android i pesi non si sintetizzano insieme
  // a una fontFamily esplicita (vedi il commento in src/theme.ts).
  clickableSmallCardValue: {
    fontSize: 30,
    color: COLORS.onSuccess,
  },

  clickableSmallCardFooter: {
    marginTop: 10,
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.onSuccess,
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

  // fontFamily e fontWeight tolti: TESTO.cifra applicato in JSX porta la
  // propria fontFamily monospace, e su Android i pesi non si sintetizzano
  // insieme a una fontFamily esplicita (vedi il commento in src/theme.ts).
  heroValue: {
    fontSize: 30,
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

  // fontFamily/fontWeight tolti: StatCard.value è sempre un importo o un
  // conteggio (mai testo libero), quindi prende TESTO.cifra qui alla radice
  // dello stile. La fontFamily del tema arriva da lì; fontWeight va tolto
  // perché su Android non si sintetizza insieme a una fontFamily esplicita
  // (vedi il commento in src/theme.ts).
  statValue: {
    fontSize: 23,
    color: COLORS.onSurface,
    marginTop: 10,
    ...TESTO.cifra,
  },

  statValueHighlight: {
    color: COLORS.onSurfaceInverse,
  },

  // statFooter è condiviso da tutte le StatCard: nella maggior parte dei
  // casi è un'unità senza cifre ("prodotti", "unità", "fornitori"), ma per
  // "Vendite del mese" contiene un conteggio ("N transazioni"). Non c'è un
  // modo per distinguere i due casi senza aggiungere una prop a StatCard —
  // fuori scope per un task di soli colori/font — quindi TESTO.cifra va
  // sull'intero stile: sul testo senza cifre l'effetto è innocuo (cambia
  // solo il peso del mono, da regular a medium).
  statFooter: {
    fontSize: 10,
    color: COLORS.onSurfaceSecondary,
    marginTop: 8,
    ...TESTO.cifra,
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

  sottoScortaLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 3,
    color: COLORS.onSurface,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  sottoScortaValue: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.onSurface,
  },

  sottoScortaFooter: {
    marginTop: 10,
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.onSurfaceSecondary,
  },


  alertCardActive: {},

  daySalesLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.onSurface,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  daySalesValue: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.success,
  },

  daySalesFooter: {
    marginTop: 10,
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.onSurfaceSecondary,
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

  // fontFamily/fontWeight tolti: è sempre un importo o un conteggio, prende
  // TESTO.cifra qui. fontWeight via perché su Android non si sintetizza
  // insieme a una fontFamily esplicita (vedi il commento in src/theme.ts).
  categoryCount: {
    fontSize: 12,
    color: COLORS.brand,
    ...TESTO.cifra,
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
  
  sectionBlock: {
    marginTop: 28,
    marginBottom: 8,
  },

  productStatRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  productStatName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.onSurface,
  },

  // Contiene sempre pezzi venduti e/o quantità a magazzino: TESTO.cifra qui.
  productStatMeta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.onSurfaceSecondary,
    ...TESTO.cifra,
  },

  // fontWeight tolto per lo stesso motivo di categoryCount qui sopra.
  productStatValue: {
    fontSize: 16,
    color: COLORS.brand,
    ...TESTO.cifra,
  },

  emptyStatBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 18,
  },

  emptyStatText: {
    fontSize: 14,
    color: COLORS.onSurfaceSecondary,
  },  

});
