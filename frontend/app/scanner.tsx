import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';

import { COLORS, FONTS } from '@/src/theme';
import { api } from '@/src/api';
import type { Product } from '@/src/store';
import { getLocalProductById } from '@/src/local/db';
import { useAppStore } from '@/src/store';

export default function Scanner() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = String(params.returnTo || '');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastCode, setLastCode] = useState<string>('');
  const addToCart = useAppStore((s) => s.addToCart);
  const mode = useAppStore((s) => s.mode);

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permWrap}>
        <Feather name="camera-off" size={64} color={COLORS.brandTertiary} />
        <Text style={styles.permTitle}>FOTOCAMERA RICHIESTA</Text>
        <Text style={styles.permTxt}>Concedi accesso per scansionare i barcode dei prodotti.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission} testID="grant-camera">
          <Text style={styles.permBtnTxt}>CONCEDI PERMESSO</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} testID="scanner-back-perm">
          <Text style={styles.permLink}>Annulla</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const onScan = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLastCode(data);
    if (returnTo === 'product-new') {
      router.replace({ pathname: '/product/new', params: { barcode: data } });
      return;
    }
    try {
      const p = getLocalProductById(data) as Product | null;
      if (!p) throw new Error("Prodotto non trovato");
      Alert.alert(
        'Prodotto trovato',
        `${p.descrizione}\nQTA: ${p.quantita} · ${p.prezzo_vendita.toFixed(2)} €`,
        [
          { text: 'Dettaglio', onPress: () => { router.replace(`/product/${p.id}`); } },
          mode === 'gestore' ? { text: 'Aggiungi a vendita', onPress: () => { addToCart(p, 1); router.replace('/vendita'); } } : null,
          { text: 'Continua scan', onPress: () => setScanned(false) },
        ].filter(Boolean) as any
      );
    } catch (e) {
      Alert.alert(
        'Non trovato',
        `Barcode ${data} non in archivio.`,
        [
          mode === 'gestore' ? { text: 'Aggiungi nuovo', onPress: () => router.replace({ pathname: '/product/new', params: { barcode: data } }) } : null,
          { text: 'Continua scan', onPress: () => setScanned(false) },
          { text: 'Chiudi', style: 'cancel', onPress: () => router.back() },
        ].filter(Boolean) as any
      );
    }
  };

  return (
    <View style={styles.root} testID="scanner-screen">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr', 'code93', 'codabar', 'itf14', 'pdf417', 'datamatrix', 'aztec'] }}
        onBarcodeScanned={scanned ? undefined : onScan}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable style={styles.closeBtn} onPress={() => router.back()} testID="scanner-close">
            <Feather name="x" size={24} color={COLORS.onSurfaceInverse} />
          </Pressable>
          <Text style={styles.topTitle}>SCANNER BARCODE</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.target}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <View style={styles.bottom}>
          <Text style={styles.scanTxt}>{scanned ? `LETTO: ${lastCode}` : 'IN ATTESA DI BARCODE...'}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const SIZE = 260;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)' },
  topTitle: { fontFamily: FONTS.mono, fontSize: 13, color: '#fff', fontWeight: '900', letterSpacing: 2 },
  closeBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  target: { alignSelf: 'center', width: SIZE, height: SIZE, marginTop: 40 },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: COLORS.brandTertiary },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  bottom: { padding: 20, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center' },
  scanTxt: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.brandTertiary, letterSpacing: 2, fontWeight: '700' },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: COLORS.surface },
  permTitle: { fontFamily: FONTS.display, fontSize: 20, fontWeight: '900', color: COLORS.onSurface, letterSpacing: 1 },
  permTxt: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onSurfaceSecondary, textAlign: 'center' },
  permBtn: { backgroundColor: COLORS.brand, paddingHorizontal: 24, paddingVertical: 14, borderWidth: 2, borderColor: COLORS.borderStrong },
  permBtnTxt: { fontFamily: FONTS.mono, fontSize: 13, fontWeight: '900', color: COLORS.onBrandPrimary, letterSpacing: 1.5 },
  permLink: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.brand, textDecorationLine: 'underline', marginTop: 8 },
});
