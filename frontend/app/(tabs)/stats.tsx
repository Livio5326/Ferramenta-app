import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { COLORS, FONTS, fmtEUR } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { api } from '@/src/api';

export default function Stats() {
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await api.stats();
    setStats(s);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } catch (e) { /* noop */ }
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="stats-screen">
      <ScreenHeader title="STATISTICHE" subtitle="MAGAZZINO · VENDITE" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}>
        <View style={styles.bento}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>VALORE A COSTO</Text>
            <Text style={styles.cellValue}>{fmtEUR(stats?.valore_magazzino || 0)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>VALORE VENDITA</Text>
            <Text style={[styles.cellValue, { color: COLORS.success }]}>{fmtEUR(stats?.valore_vendita_potenziale || 0)}</Text>
          </View>
        </View>
        <View style={styles.bento}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>REFERENZE</Text>
            <Text style={styles.cellValue}>{stats?.total_products || 0}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>PEZZI TOTALI</Text>
            <Text style={styles.cellValue}>{stats?.total_pieces || 0}</Text>
          </View>
        </View>
        <View style={styles.bento}>
          <View style={[styles.cell, { backgroundColor: COLORS.surfaceInverse }]}>
            <Text style={[styles.cellLabel, { color: COLORS.brandTertiary }]}>VENDITE TOTALI</Text>
            <Text style={[styles.cellValue, { color: COLORS.onSurfaceInverse }]}>{fmtEUR(stats?.vendite_totali || 0)}</Text>
            <Text style={[styles.cellFoot, { color: COLORS.brandTertiary }]}>{stats?.numero_vendite || 0} TRANSAZIONI</Text>
          </View>
          <View style={[styles.cell, { backgroundColor: stats?.sotto_scorta_count ? COLORS.error : COLORS.surfaceSecondary }]}>
            <Text style={[styles.cellLabel, stats?.sotto_scorta_count && { color: COLORS.onError }]}>SOTTO SCORTA</Text>
            <Text style={[styles.cellValue, stats?.sotto_scorta_count && { color: COLORS.onError }]}>{stats?.sotto_scorta_count || 0}</Text>
            <Text style={[styles.cellFoot, stats?.sotto_scorta_count && { color: COLORS.onError }]}>DA RIORDINARE</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{"// DISTRIBUZIONE CATEGORIE"}</Text>
          {(stats?.categorie || []).slice(0, 10).map((c: any) => {
            const max = stats?.categorie?.[0]?.count || 1;
            const pct = (c.count / max) * 100;
            return (
              <View key={c.nome} style={styles.catRow} testID={`cat-${c.nome}`}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName} numberOfLines={1}>{c.nome.toUpperCase()}</Text>
                  <Text style={styles.catCount}>{c.count}</Text>
                </View>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
          {(!stats?.categorie || stats.categorie.length === 0) && (
            <Text style={styles.emptyHint}>Nessun dato. Aggiungi prodotti o carica il demo.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  bento: { flexDirection: 'row', borderBottomWidth: 2, borderColor: COLORS.borderStrong },
  cell: { flex: 1, padding: 16, backgroundColor: COLORS.surfaceSecondary, borderRightWidth: 2, borderColor: COLORS.borderStrong, minHeight: 110 },
  cellLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  cellValue: { fontFamily: FONTS.display, fontSize: 24, fontWeight: '900', color: COLORS.onSurface, marginTop: 8, letterSpacing: -0.5 },
  cellFoot: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, marginTop: 4, letterSpacing: 1 },
  section: { padding: 16, gap: 12 },
  sectionTitle: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  catRow: { gap: 4 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  catName: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onSurface, letterSpacing: 1, flex: 1 },
  catCount: { fontFamily: FONTS.mono, fontSize: 13, fontWeight: '900', color: COLORS.brand },
  bar: { height: 10, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.borderStrong },
  barFill: { height: '100%', backgroundColor: COLORS.brand },
  emptyHint: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onSurfaceSecondary, padding: 12, borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSecondary },
});
