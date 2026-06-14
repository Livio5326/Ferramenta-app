import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { COLORS, FONTS, fmtEUR } from '@/src/theme';
import { api } from '@/src/api';
import { Product, useAppStore } from '@/src/store';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mode = useAppStore((s) => s.mode);
  const addToCart = useAppStore((s) => s.addToCart);
  const isCliente = mode === 'cliente';

  const [p, setP] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [saleQty, setSaleQty] = useState(1);
  const maxVendibile = Math.max(0, Number(p?.quantita ?? 0));

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getProduct(id);
      setP(data);
    } catch (e) {
      Alert.alert('Errore', 'Prodotto non trovato');
      router.back();
    }
  }, [id, router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!p) {
    return <View style={[styles.safe, styles.center]}><ActivityIndicator color={COLORS.brand} /></View>;
  }

  const adjust = async (delta: number) => {
    setBusy(true);
    try {
      const updated = await api.adjustStock(p.id, delta);
      setP(updated);
    } catch (e: any) {
      Alert.alert('Errore', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert('Eliminare?', `Eliminare definitivamente ${p.descrizione}?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive', onPress: async () => {
          await api.deleteProduct(p.id);
          router.back();
        }
      }
    ]);
  };

  const low = p.quantita <= p.soglia_scorta;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="product-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.imgWrap}>
          {p.foto ? (
<Image
  source={{
    uri: String(p.foto).startsWith('http') || String(p.foto).startsWith('data:')
      ? p.foto
      : ((process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '') + '/uploads/' + p.foto),
  }}
  style={styles.img}
  contentFit="cover"
/>
          ) : (
            <View style={[styles.img, { backgroundColor: COLORS.surfaceTertiary, alignItems: 'center', justifyContent: 'center' }]}>
              <Feather name="package" size={64} color={COLORS.brand} />
            </View>
          )}
          <View style={styles.imgOverlay} />
          <Pressable style={styles.backBtn} onPress={() => router.back()} testID="back-btn">
            <Feather name="arrow-left" size={20} color={COLORS.onSurfaceInverse} />
          </Pressable>
          {!isCliente && (
            <Pressable style={styles.editBtn} onPress={() => router.push({ pathname: '/product/new', params: { id: p.id } })} testID="edit-btn">
              <Feather name="edit-2" size={16} color={COLORS.onSurfaceInverse} />
              <Text style={styles.editTxt}>MODIFICA</Text>
            </Pressable>
          )}
          <View style={styles.imgInner}>
            <Text style={styles.brand}>{(p.marca || '—').toUpperCase()}</Text>
            <Text style={styles.title}>{p.descrizione}</Text>
          </View>
        </View>

        <View style={styles.priceBlock}>
          <View style={styles.priceCell}>
            <Text style={styles.priceLabel}>PREZZO VENDITA</Text>
            <Text style={styles.priceValue}>{fmtEUR(p.prezzo_vendita)}</Text>
          </View>
          {!isCliente && (
            <View style={[styles.priceCell, { borderRightWidth: 0 }]}>
              <Text style={styles.priceLabel}>P. ACQUISTO</Text>
              <Text style={styles.priceValueSm}>{fmtEUR(p.prezzo_acquisto)}</Text>
            </View>
          )}
        </View>

        <View style={styles.specs}>
          <Spec label="BARCODE" value={p.barcode || '—'} />
          <Spec label="CODICE PRODOTTO" value={p.codice_prodotto || '—'} />
          <Spec label="CATEGORIA" value={p.categoria || '—'} />
          <Spec label="MARCA" value={p.marca || '—'} />
          {!isCliente && <Spec label="FORNITORE" value={p.fornitore || '—'} />}
          <Spec label="DISPONIBILITÀ" value={`${p.quantita} pz`} highlight={low ? COLORS.error : undefined} />
          {!isCliente && <Spec label="SOGLIA SCORTA" value={`${p.soglia_scorta} pz`} />}
          {p.note ? <Spec label="NOTE" value={p.note} /> : null}
        </View>
      </ScrollView>

      {!isCliente && (
        <View style={styles.footer}>
          <View style={styles.stockCtrl}>
            <Pressable style={styles.stockBtn} onPress={() => setSaleQty((q) => Math.max(1, q - 1))} disabled={busy || saleQty <= 1} testID="sale-qty-minus">
              <Feather name="minus" size={20} color={COLORS.onSurface} />
            </Pressable>
            <Text style={styles.stockNum}>{saleQty}</Text>
              <Pressable style={styles.stockBtn} onPress={() => setSaleQty((q) => Math.min(maxVendibile, q + 1))} disabled={busy || saleQty >= maxVendibile} testID="sale-qty-plus">
              <Feather name="plus" size={20} color={COLORS.onSurface} />
            </Pressable>
          </View>
          <Pressable style={styles.addCartBtn} onPress={() => { addToCart(p, saleQty); Alert.alert('Aggiunto', '${saleQty} pz nel carrello'); }} testID="add-cart-detail">
            <Feather name="shopping-cart" size={18} color={COLORS.onSuccess} />
            <Text style={styles.addCartTxt}>VENDI</Text>
          </Pressable>
          <Pressable style={styles.delBtn} onPress={remove} testID="delete-btn">
            <Feather name="trash-2" size={18} color={COLORS.onError} />
          </Pressable>
        </View>
      )}
      {isCliente && (
        <View style={styles.footer}>
          <Pressable style={[styles.addCartBtn, { flex: 1, backgroundColor: low ? COLORS.error : COLORS.success }]} onPress={() => router.back()} testID="back-cliente">
            <Text style={styles.addCartTxt}>{low ? 'NON DISPONIBILE' : 'DISPONIBILE'}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function Spec({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <View style={specStyles.row}>
      <Text style={specStyles.label}>{label}</Text>
      <Text style={[specStyles.value, highlight && { color: highlight, fontWeight: '900' }]}>{value}</Text>
    </View>
  );
}

const specStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: COLORS.divider, alignItems: 'center', gap: 12 },
  label: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  value: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.onSurface, flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  imgWrap: { width: '100%', height: 280, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(44,34,27,0.45)' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 40, height: 40, backgroundColor: 'rgba(44,34,27,0.7)', alignItems: 'center', justifyContent: 'center' },
  editBtn: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brand, paddingHorizontal: 12, paddingVertical: 10 },
  editTxt: { fontFamily: FONTS.mono, fontSize: 11, fontWeight: '900', color: COLORS.onBrandPrimary, letterSpacing: 1 },
  imgInner: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  brand: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.brandTertiary, letterSpacing: 2 },
  title: { fontFamily: FONTS.display, fontSize: 24, fontWeight: '900', color: COLORS.onSurfaceInverse, marginTop: 4, letterSpacing: -0.5 },
  priceBlock: { flexDirection: 'row', borderBottomWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.brand },
  priceCell: { flex: 1, padding: 16, borderRightWidth: 2, borderColor: COLORS.borderStrong },
  priceLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.brandTertiary, letterSpacing: 1.5 },
  priceValue: { fontFamily: FONTS.display, fontSize: 28, fontWeight: '900', color: COLORS.onBrandPrimary, marginTop: 4 },
  priceValueSm: { fontFamily: FONTS.mono, fontSize: 18, fontWeight: '900', color: COLORS.onBrandPrimary, marginTop: 4 },
  specs: { backgroundColor: COLORS.surface },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 0, backgroundColor: COLORS.surfaceInverse, borderTopWidth: 2, borderColor: COLORS.borderStrong, padding: 12 },
  stockCtrl: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.surface, marginRight: 8 },
  stockBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceTertiary },
  stockNum: { fontFamily: FONTS.mono, fontSize: 16, fontWeight: '900', width: 42, textAlign: 'center' },
  addCartBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.success, paddingVertical: 14, borderWidth: 2, borderColor: COLORS.surfaceInverse },
  addCartTxt: { fontFamily: FONTS.mono, fontSize: 13, fontWeight: '900', color: COLORS.onSuccess, letterSpacing: 1.5 },
  delBtn: { width: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.error, marginLeft: 8 },
});
