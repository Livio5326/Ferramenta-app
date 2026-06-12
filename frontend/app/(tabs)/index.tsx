import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { COLORS, FONTS, fmtEUR } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { ModeToggle } from '@/src/components/ModeToggle';
import { useAppStore } from '@/src/store';
import { api } from '@/src/api';

const WOOD_BG = 'https://images.unsplash.com/photo-1583418007992-a8e33a92e7ad?w=800';

export default function Dashboard() {
  const router = useRouter();
  const mode = useAppStore((s) => s.mode);
  const isCliente = mode === 'cliente';

  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.stats();
      setStats(s);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSeed = async () => {
    try {
      const r = await api.seed();
      if (r.seeded) {
        Alert.alert('Dati demo caricati', `${r.count} prodotti aggiunti`);
        load();
      } else {
        Alert.alert('Archivio non vuoto', `Ci sono già ${r.existing} prodotti`);
      }
    } catch (e: any) {
      Alert.alert('Errore', String(e?.message || e));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="dashboard-screen">
      <ScreenHeader
        title="FERRAMENTA"
        subtitle="MANAGER · MAGAZZINO"
        right={<ModeToggle />}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}
      >
        {/* Wood banner */}
        <View style={styles.bannerWrap}>
          <Image source={WOOD_BG} style={styles.banner} contentFit="cover" />
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerInner}>
            <Text style={styles.bannerLabel}>{"// BENVENUTO"}</Text>
            <Text style={styles.bannerTitle}>{isCliente ? 'CATALOGO' : 'COMMAND CENTER'}</Text>
            <Text style={styles.bannerSub}>
              {isCliente ? 'Sfoglia i prodotti disponibili' : 'Magazzino, vendita e statistiche in un colpo d\'occhio'}
            </Text>
          </View>
        </View>

        {/* Bento stats */}
        {!isCliente && (
          <View style={styles.bento}>
            <View style={[styles.bentoCard, styles.bentoCardLg]} testID="stat-valore">
              <Text style={styles.statLabel}>VALORE MAGAZZINO</Text>
              <Text style={styles.statValue}>{fmtEUR(stats?.valore_magazzino || 0)}</Text>
              <Text style={styles.statFoot}>{stats?.total_pieces || 0} PEZZI · {stats?.total_products || 0} REF</Text>
            </View>
            <Pressable style={[styles.bentoCard, styles.bentoCardLg, { backgroundColor: stats?.sotto_scorta_count ? COLORS.error : COLORS.surfaceSecondary }]} onPress={()=> router.push('/catalogo?sotto_scorta=true')} testID="stat-scorta">
              <Text style={[styles.statLabel, stats?.sotto_scorta_count && { color: COLORS.onError }]}>SOTTO SCORTA</Text>
              <Text style={[styles.statValue, stats?.sotto_scorta_count && { color: COLORS.onError }]}>{stats?.sotto_scorta_count || 0}</Text>
              <Text style={[styles.statFoot, stats?.sotto_scorta_count && { color: COLORS.onError }]}>DA RIORDINARE</Text>
            </Pressable>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actionsGrid}>
          <Pressable style={styles.action} onPress={() => router.push('/scanner')} testID="action-scan">
            <Feather name="maximize" size={28} color={COLORS.onBrandPrimary} />
            <Text style={styles.actionText}>SCAN BARCODE</Text>
          </Pressable>
          <Pressable style={[styles.action, { backgroundColor: COLORS.surfaceInverse }]} onPress={() => router.push('/catalogo')} testID="action-catalog">
            <Feather name="package" size={28} color={COLORS.onSurfaceInverse} />
            <Text style={styles.actionText}>CATALOGO</Text>
          </Pressable>
          {!isCliente && (
            <>
              <Pressable style={[styles.action, { backgroundColor: COLORS.success }]} onPress={() => router.push('/vendita')} testID="action-vendita">
                <Feather name="shopping-cart" size={28} color={COLORS.onSuccess} />
                <Text style={styles.actionText}>VENDITA RAPIDA</Text>
              </Pressable>
              <Pressable style={[styles.action, { backgroundColor: COLORS.warning }]} onPress={() => router.push('/product/new')} testID="action-add">
                <Feather name="plus-square" size={28} color={COLORS.onWarning} />
                <Text style={styles.actionText}>NUOVO PRODOTTO</Text>
              </Pressable>
              <Pressable style={[styles.action, { backgroundColor: COLORS.brandSecondary }]} onPress={() => router.push('/import')} testID="action-import">
                <Feather name="upload" size={28} color={COLORS.onBrandSecondary} />
                <Text style={styles.actionText}>IMPORTA EXCEL</Text>
              </Pressable>
              <Pressable style={[styles.action, { backgroundColor: COLORS.brandTertiary }]} onPress={handleSeed} testID="action-seed">
                <Feather name="database" size={28} color={COLORS.onBrandTertiary} />
                <Text style={[styles.actionText, { color: COLORS.onBrandTertiary }]}>CARICA DEMO</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Low stock list */}
        {!isCliente && stats?.sotto_scorta?.length > 0 && (
          <View style={styles.lowStockBlock}>
            <Text style={styles.sectionTitle}>{"// PRODOTTI SOTTO SCORTA"}</Text>
            {stats.sotto_scorta.slice(0, 5).map((p: any) => (
              <Pressable
                key={p.id}
                style={styles.lowRow}
                onPress={() => router.push(`/product/${p.id}`)}
                testID={`lowstock-${p.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.lowName} numberOfLines={1}>{p.descrizione}</Text>
                  <Text style={styles.lowMeta}>{p.marca || '—'} · {p.categoria || '—'}</Text>
                </View>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>{p.quantita}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 32 },
  bannerWrap: { height: 140, borderBottomWidth: 2, borderColor: COLORS.borderStrong, position: 'relative' },
  banner: { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(44,34,27,0.55)' },
  bannerInner: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  bannerLabel: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.brandTertiary, letterSpacing: 2 },
  bannerTitle: { fontFamily: FONTS.display, fontSize: 28, fontWeight: '900', color: COLORS.onSurfaceInverse, letterSpacing: -0.5, marginTop: 2 },
  bannerSub: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.surface, marginTop: 4 },
  bento: { flexDirection: 'row', borderBottomWidth: 2, borderColor: COLORS.borderStrong },
  bentoCard: { flex: 1, padding: 16, backgroundColor: COLORS.surfaceSecondary, borderRightWidth: 2, borderColor: COLORS.borderStrong },
  bentoCardLg: { minHeight: 110 },
  statLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  statValue: { fontFamily: FONTS.display, fontSize: 26, fontWeight: '900', color: COLORS.onSurface, marginTop: 8, letterSpacing: -0.5 },
  statFoot: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, marginTop: 6, letterSpacing: 1 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  action: {
    width: '50%',
    minHeight: 100,
    backgroundColor: COLORS.brand,
    padding: 14,
    justifyContent: 'space-between',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.borderStrong,
  },
  actionText: { fontFamily: FONTS.mono, fontSize: 12, fontWeight: '700', color: COLORS.onBrandPrimary, letterSpacing: 1 },
  lowStockBlock: { padding: 16, gap: 8 },
  sectionTitle: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5, marginBottom: 4 },
  lowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    gap: 12,
  },
  lowName: { fontFamily: FONTS.display, fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  lowMeta: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, marginTop: 2 },
  qtyBadge: { backgroundColor: COLORS.error, paddingHorizontal: 10, paddingVertical: 6 },
  qtyBadgeText: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: '900', color: COLORS.onError },
});
