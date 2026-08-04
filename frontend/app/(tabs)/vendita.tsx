import {
  useState } from 'react';
import { View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { COLORS, FONTS, fmtEUR } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAppStore, cartTotal } from '@/src/store';
import { api } from '@/src/api';

import AppButton from '@/src/components/AppButton';
function prezzoFinaleProdotto(p: any): number {
  const prezzoPromo = Number(p?.prezzo_promo || 0);
  if (p?.promo_attiva && prezzoPromo > 0) return prezzoPromo;
  return Number(p?.prezzo_vendita || 0);
}

function haPromoProdotto(p: any): boolean {
  return Boolean(p?.promo_attiva && Number(p?.prezzo_promo || 0) > 0);
}

export default function Vendita() {
  const router = useRouter();
  const cart = useAppStore((s) => s.cart);
  const cartVendibile = cart.filter((c) => Number(c.product.quantita ?? 0) > 0);
  const removeFromCart = useAppStore((s) => s.removeFromCart);
  const updateCartQty = useAppStore((s) => s.updateCartQty);
  const clearCart = useAppStore((s) => s.clearCart);
  const [completing, setCompleting] = useState(false);

  const total = cartTotal(cartVendibile);

  const completa = async () => {
    if (cartVendibile.length === 0) return;
    setCompleting(true);

    try {
      await api.createSale(
        cartVendibile.map((c) => ({
          product_id: c.product.id || c.product.codice_prodotto || c.product.barcode,
          descrizione: c.product.descrizione,
          prezzo_vendita: prezzoFinaleProdotto(c.product),
          quantita: c.quantita,
        }))
      );

      clearCart();
      Alert.alert('Vendita completata', `Totale ${fmtEUR(total)}`);
    } catch (e: any) {
      Alert.alert('Errore', String(e?.message || e));
    } finally {
      setCompleting(false);
    }
  };


  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="vendita-screen">
      <ScreenHeader
        title="VENDITA"
        subtitle={`${cartVendibile.length} ARTICOLI`}
        right={
          cartVendibile.length > 0 ? (
            <AppButton onPress={clearCart} testID="clear-cart">
              <Feather name="trash-2" size={20} color={COLORS.error} />
            </AppButton>
          ) : null
        }
      />
      {cartVendibile.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="shopping-cart" size={64} color={COLORS.brandTertiary} />
          <Text style={styles.emptyText}>CARRELLO VUOTO</Text>
          <AppButton style={styles.bigBtn} onPress={() => router.push('/scanner')} testID="start-scan-btn">
            <Feather name="maximize" size={20} color={COLORS.onBrandPrimary} />
            <Text style={styles.bigBtnTxt}>INIZIA SCANSIONE</Text>
          </AppButton>
          <AppButton style={[styles.bigBtn, { backgroundColor: COLORS.surfaceInverse }]} onPress={() => router.push('/catalogo-vendita')} testID="goto-catalog-btn">
            <Feather name="package" size={20} color={COLORS.onSurfaceInverse} />
            <Text style={styles.bigBtnTxt}>SCEGLI DAL CATALOGO</Text>
          </AppButton>
        </View>
      ) : (
        <>
          <FlatList
            data={cartVendibile}
            keyExtractor={(c) => c.product.id}
            contentContainerStyle={{ paddingBottom: 220 }}
            renderItem={({ item }) => (
              <View style={styles.row} testID={`cart-row-${item.product.id}`}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.rowTitle} numberOfLines={2}>{item.product.descrizione}</Text>
                  <Text style={[styles.rowMeta, haPromoProdotto(item.product) && styles.rowMetaPromo]}>
                    {fmtEUR(prezzoFinaleProdotto(item.product))} cad.
                  </Text>
                  {haPromoProdotto(item.product) ? (
                    <Text style={styles.promoBadge}>PROMO</Text>
                  ) : null}
                </View>
                <View style={styles.qtyCtrl}>
                  <AppButton style={styles.qtyBtn} onPress={() => updateCartQty(item.product.id, item.quantita - 1)} testID={`qty-minus-${item.product.id}`}>
                    <Feather name="minus" size={16} color={COLORS.onSurface} />
                  </AppButton>
                  <Text style={styles.qtyNum}>{item.quantita}</Text>
                  <AppButton style={styles.qtyBtn} onPress={() => updateCartQty(item.product.id, item.quantita + 1)} testID={`qty-plus-${item.product.id}`}>
                    <Feather name="plus" size={16} color={COLORS.onSurface} />
                  </AppButton>
                </View>
                <Text style={styles.rowSub}>{fmtEUR(prezzoFinaleProdotto(item.product) * item.quantita)}</Text>
                <AppButton style={styles.delBtn} onPress={() => removeFromCart(item.product.id)} testID={`remove-${item.product.id}`}>
                  <Feather name="x" size={16} color={COLORS.onError} />
                </AppButton>
              </View>
            )}
          />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTALE</Text>
              <Text style={styles.totalValue} testID="cart-total">{fmtEUR(total)}</Text>
            </View>
            <AppButton
              style={[styles.completeBtn, completing && { opacity: 0.5 }]}
              onPress={completa}
              disabled={completing}
              testID="complete-sale-btn"
            >
              <Feather name="check-circle" size={20} color={COLORS.onSuccess} />
              <Text style={styles.completeBtnTxt}>{completing ? 'IN CORSO...' : 'COMPLETA VENDITA'}</Text>
            </AppButton>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.onSurfaceSecondary, letterSpacing: 2, fontWeight: '900' },
  bigBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.brand, paddingHorizontal: 20, paddingVertical: 14, borderWidth: 2, borderColor: COLORS.borderStrong, minWidth: 260, justifyContent: 'center' },
  bigBtnTxt: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.onBrandPrimary, fontWeight: '900', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSecondary },
  rowTitle: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  rowMeta: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary },
  rowMetaPromo: { color: COLORS.error, fontWeight: '700' },
  promoBadge: { fontFamily: FONTS.mono, fontSize: 9, fontWeight: '900', color: COLORS.error },
  qtyCtrl: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface },
  qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyNum: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: '900', color: COLORS.onSurface, width: 28, textAlign: 'center' },
  rowSub: { fontFamily: FONTS.mono, fontSize: 13, fontWeight: '900', color: COLORS.brand, minWidth: 70, textAlign: 'right' },
  delBtn: { width: 32, height: 32, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.surfaceInverse, borderTopWidth: 2, borderColor: COLORS.borderStrong, padding: 16, gap: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.brandTertiary, letterSpacing: 2, fontWeight: '700' },
  totalValue: { fontFamily: FONTS.display, fontSize: 32, fontWeight: '900', color: COLORS.onSurfaceInverse, letterSpacing: -0.5 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.success, paddingVertical: 16, borderWidth: 2, borderColor: COLORS.surfaceInverse },
  completeBtnTxt: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: '900', color: COLORS.onSuccess, letterSpacing: 1.5 },
});
