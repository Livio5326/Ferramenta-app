import {
  useState } from 'react';
import { View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { COLORS, FONTS, VELI, fmtEUR } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useAppStore, cartTotal } from '@/src/store';
import { lineUnitPrice, lineSubtotal, buildSalePayload } from '@/src/pos/cart';
import { ManualReceiptPrinter, buildReceipt } from '@/src/pos/receiptPrinter';
import { api } from '@/src/api';

import AppButton from '@/src/components/AppButton';

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
  const setCartPrice = useAppStore((s) => s.setCartPrice);
  const addManualLine = useAppStore((s) => s.addManualLine);
  const [completing, setCompleting] = useState(false);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDesc, setQuickDesc] = useState('');
  const [quickPrice, setQuickPrice] = useState('');

  const total = cartTotal(cartVendibile);

  const confermaRigaRapida = () => {
    const desc = quickDesc.trim() || 'Riga rapida';
    const v = parseFloat(quickPrice.replace(',', '.'));
    addManualLine(desc, Number.isFinite(v) ? v : 0, 1);
    setQuickDesc('');
    setQuickPrice('');
    setQuickOpen(false);
  };

  const completa = async () => {
    const payload = buildSalePayload(cartVendibile);
    if (payload.length === 0 && cartVendibile.length === 0) return;
    setCompleting(true);
    try {
      if (payload.length > 0) {
        await api.createSale(payload);
      }
      const printer = new ManualReceiptPrinter();
      const { total: stampato } = await printer.printReceipt(buildReceipt(cartVendibile));
      clearCart();
      Alert.alert('Vendita completata', `Totale da battere in cassa: ${fmtEUR(stampato)}`);
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
          <View style={styles.headerActions}>
            <AppButton onPress={() => setQuickOpen(true)} testID="quick-line-btn">
              <Feather name="plus-square" size={20} color={COLORS.onSurface} />
            </AppButton>
            {cartVendibile.length > 0 ? (
              <AppButton onPress={clearCart} testID="clear-cart">
                <Feather name="trash-2" size={20} color={COLORS.error} />
              </AppButton>
            ) : null}
          </View>
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
          <AppButton style={[styles.bigBtn, { backgroundColor: COLORS.brandSecondary }]} onPress={() => setQuickOpen(true)} testID="quick-line-empty-btn">
            <Feather name="plus-square" size={20} color={COLORS.onBrandSecondary} />
            <Text style={styles.bigBtnTxt}>RIGA RAPIDA</Text>
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
                  <View style={styles.priceRow}>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="decimal-pad"
                      defaultValue={String(lineUnitPrice(item))}
                      onEndEditing={(e) => {
                        const v = parseFloat(e.nativeEvent.text.replace(',', '.'));
                        setCartPrice(item.product.id, Number.isFinite(v) ? v : 0);
                      }}
                      testID={`price-input-${item.product.id}`}
                    />
                    <Text style={styles.priceInputSuffix}>cad.</Text>
                  </View>
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
                <Text style={styles.rowSub}>{fmtEUR(lineSubtotal(item))}</Text>
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

      <Modal
        visible={quickOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="quick-line-modal">
            <Text style={styles.modalTitle}>RIGA RAPIDA</Text>
            <Text style={styles.modalLabel}>DESCRIZIONE</Text>
            <TextInput
              style={styles.modalInput}
              value={quickDesc}
              onChangeText={setQuickDesc}
              placeholder="Descrizione"
              placeholderTextColor={COLORS.onSurfaceSecondary}
              testID="quick-line-desc"
            />
            <Text style={styles.modalLabel}>PREZZO</Text>
            <TextInput
              style={styles.modalInput}
              value={quickPrice}
              onChangeText={setQuickPrice}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={COLORS.onSurfaceSecondary}
              testID="quick-line-price"
            />
            <View style={styles.modalActions}>
              <AppButton
                style={[styles.modalBtn, { backgroundColor: COLORS.surfaceSecondary }]}
                onPress={() => setQuickOpen(false)}
                testID="quick-line-cancel"
              >
                <Text style={styles.modalBtnTxt}>ANNULLA</Text>
              </AppButton>
              <AppButton
                style={[styles.modalBtn, { backgroundColor: COLORS.success }]}
                onPress={confermaRigaRapida}
                testID="quick-line-confirm"
              >
                <Text style={styles.modalBtnTxtOnSuccess}>AGGIUNGI</Text>
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.onSurfaceSecondary, letterSpacing: 2, fontWeight: '900' },
  bigBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.brand, paddingHorizontal: 20, paddingVertical: 14, borderWidth: 2, borderColor: COLORS.borderStrong, minWidth: 260, justifyContent: 'center' },
  bigBtnTxt: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.onBrandPrimary, fontWeight: '900', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSecondary },
  rowTitle: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceInput: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onSurface, borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface, paddingHorizontal: 8, paddingVertical: 4, minWidth: 80 },
  priceInputSuffix: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary },
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
  modalBackdrop: { flex: 1, backgroundColor: VELI.divisorioLegno, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.borderStrong, padding: 20, gap: 8 },
  modalTitle: { fontFamily: FONTS.displayForte, fontSize: 20, color: COLORS.onSurface, letterSpacing: -0.4, marginBottom: 8 },
  modalLabel: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, letterSpacing: 2 },
  modalInput: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.onSurface, borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderWidth: 2, borderColor: COLORS.borderStrong },
  modalBtnTxt: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.onSurface, letterSpacing: 1 },
  modalBtnTxtOnSuccess: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.onSuccess, letterSpacing: 1 },
});
