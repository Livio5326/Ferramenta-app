import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { COLORS, FONTS, fmtEUR } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { api } from '@/src/api';
import { Product, useAppStore } from '@/src/store';

export default function Catalogo() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const soloSottoScorta = params.sotto_scorta === 'true';
  const mode = useAppStore((s) => s.mode);
  const addToCart = useAppStore((s) => s.addToCart);
  const isCliente = mode === 'cliente';

  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listProducts({ q: q || undefined, categoria: categoria || undefined, sotto_scorta: soloSottoScorta || undefined });
      setItems( soloSottoScorta
    ? [...data].sort((a, b) => {
        const urgenzaA = (a.quantita ?? 0) / Math.max(a.soglia_scorta ?? 1, 1);
        const urgenzaB = (b.quantita ?? 0) / Math.max(b.soglia_scorta ?? 1, 1);

        if (urgenzaA !== urgenzaB) return urgenzaA - urgenzaB;
        return (a.quantita ?? 0) - (b.quantita ?? 0);
      })
    : data
   );
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [q, categoria, soloSottoScorta]);

  useFocusEffect(useCallback(() => {
    api.meta().then((m) => setCats(m.categorie)).catch(() => {});
    load();
  }, [load]));

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, categoria, load]);

  const renderCard = ({ item }: { item: Product }) => {
    const low = item.quantita <= item.soglia_scorta;
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/product/${item.id}`)}
        testID={`product-card-${item.id}`}
      >
        <View style={styles.cardImgWrap}>
          {item.foto ? (
            <Image source={{ uri: ((process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '') + '/uploads/' + item.foto) }} style={styles.cardImg} contentFit="cover" />
          ) : (
            <View style={styles.cardPlaceholder}>
              <Feather name="package" size={32} color={COLORS.brandTertiary} />
            </View>
          )}
          {low && !isCliente && (
            <View style={styles.lowBadge}>
              <Text style={styles.lowBadgeText}>LOW</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
  <Text style={styles.cardBrand}>{item.marca || '-'}</Text>

  <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
    {item.descrizione}
  </Text>

  {!!item.codice_prodotto && (
    <Text style={styles.cardNote} numberOfLines={1} ellipsizeMode="tail">
      {item.codice_prodotto}
    </Text>
  )}
</View> 

           <View style={styles.cardFoot}>
           <Text style={styles.cardPrice}>{fmtEUR(item.prezzo_vendita)}</Text>
            {!isCliente && (
              <Text style={[styles.cardQty, low && { color: COLORS.error }]}>QTA {item.quantita}</Text>
            )}
          </View>
          {!isCliente && (
            <Pressable
              style={styles.addBtn}
              onPress={() => addToCart(item, 1)}
              testID={`add-to-cart-${item.id}`}
            >
              <Feather name="plus" size={14} color={COLORS.onBrandPrimary} />
              <Text style={styles.addBtnTxt}>VENDI</Text>
            </Pressable>
          )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="catalogo-screen">
      <ScreenHeader title={soloSottoScorta ? "SOTTO SCORTA" : "CATALOGO"} subtitle={`${items.length} PRODOTTI`} />
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={COLORS.onSurfaceSecondary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Cerca per nome, barcode, marca..."
          placeholderTextColor={COLORS.onSurfaceSecondary}
          style={styles.searchInput}
          testID="search-input"
        />
        <Pressable onPress={() => router.push('/scanner')} testID="scan-btn">
          <Feather name="maximize" size={20} color={COLORS.brand} />
        </Pressable>
      </View>
      {/* Category chips */}
      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
          <Pressable
            style={[styles.chip, !categoria && styles.chipActive]}
            onPress={() => setCategoria(null)}
            testID="chip-tutti"
          >
            <Text style={[styles.chipTxt, !categoria && styles.chipTxtActive]}>TUTTI</Text>
          </Pressable>
          {cats.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, categoria === c && styles.chipActive]}
              onPress={() => setCategoria(c)}
              testID={`chip-${c}`}
            >
              <Text style={[styles.chipTxt, categoria === c && styles.chipTxtActive]}>{c.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.brand} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={48} color={COLORS.brandTertiary} />
          <Text style={styles.emptyText}>NESSUN PRODOTTO TROVATO</Text>
          {!isCliente && (
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/product/new')} testID="empty-add-btn">
              <Text style={styles.emptyBtnTxt}>+ AGGIUNGI PRODOTTO</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(it) => it.id}
          renderItem={renderCard}
          contentContainerStyle={{ paddingBottom: 24 }}
          columnWrapperStyle={{ borderBottomWidth: 0 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
  },
  searchInput: { flex: 1, fontFamily: FONTS.mono, fontSize: 13, color: COLORS.onSurface, paddingVertical: 4 },
  chipsRow: { height: 56, borderBottomWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface, justifyContent: 'center' },
  chipsContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  chip: { height: 36, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface, flexShrink: 0 },
  chipActive: { backgroundColor: COLORS.surfaceInverse, borderColor: COLORS.surfaceInverse },
  chipTxt: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurface, letterSpacing: 1, fontWeight: '700' },
  chipTxtActive: { color: COLORS.onSurfaceInverse },
  card: {
    width: '50%',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
  },
  cardImgWrap: { width: '100%', aspectRatio: 1, backgroundColor: COLORS.surfaceSecondary, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  lowBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.error, paddingHorizontal: 6, paddingVertical: 2 },
  lowBadgeText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onError, fontWeight: '900', letterSpacing: 1 },
  cardBody: { padding: 10, gap: 4, borderTopWidth: 2, borderColor: COLORS.borderStrong },
  cardBrand: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, letterSpacing: 1 },
  cardTitle: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', color: COLORS.onSurface, minHeight: 36 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardPrice: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: '900', color: COLORS.brand },
  cardQty: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary },
  addBtn: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.brand, paddingVertical: 6 },
  addBtnTxt: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onBrandPrimary, fontWeight: '900', letterSpacing: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  emptyBtn: { borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.brand, paddingHorizontal: 18, paddingVertical: 12 },
  emptyBtnTxt: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onBrandPrimary, fontWeight: '900', letterSpacing: 1 },
});

