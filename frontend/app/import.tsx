import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { COLORS, FONTS } from '@/src/theme';
import {
  createLocalProduct,
  getLocalProductById,
  updateLocalProduct,
} from '@/src/local/db';

const COLS = ['BARCODE', 'CODICE PRODOTTO', 'DESCRIZIONE', 'MARCA', 'CATEGORIA', 'P. ACQUISTO', 'P. VENDITA', 'QUANTITÀ', 'FORNITORE', 'FOTO', 'NOTE'];

export default function ImportScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [log, setLog] = useState<string>('');

  const pickAndParse = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const uri = res.assets[0].uri;
      setBusy(true);
      setLog('Lettura file...');
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const wb = XLSX.read(b64, { type: 'base64' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      setLog(`${json.length} righe trovate. Anteprima:`);
      setPreview(json.slice(0, 5));
      // store full
      (globalThis as any).__imported = json;
    } catch (e: any) {
      Alert.alert('Errore', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const normalize = (rows: any[]) => {
    const num = (v: any) => {
      if (typeof v === 'number') return v;
      const s = String(v || '').replace(',', '.').replace(/[^0-9.\-]/g, '');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };
    return rows.map((r) => ({
      barcode: String(r['BARCODE'] ?? r['barcode'] ?? '').trim(),
      codice_prodotto: String(r['CODICE PRODOTTO'] ?? r['Codice Prodotto'] ?? r['codice_prodotto'] ?? r['CODICE FORNITORE'] ?? r['Codice Fornitore'] ?? '').trim(),
      descrizione: String(r['DESCRIZIONE'] ?? r['descrizione'] ?? '').trim() || 'Senza descrizione',
      marca: String(r['MARCA'] ?? r['marca'] ?? '').trim(),
      categoria: String(r['CATEGORIA'] ?? r['categoria'] ?? '').trim(),
      prezzo_acquisto: num(r['P. ACQUISTO'] ?? r['prezzo_acquisto']),
      prezzo_vendita: num(r['P. VENDITA'] ?? r['prezzo_vendita']),
      quantita: parseInt(String(r['QUANTITÀ'] ?? r['QUANTITA'] ?? r['quantita'] ?? 0)) || 0,
      fornitore: String(r['FORNITORE'] ?? r['fornitore'] ?? '').trim(),
      foto: String(r['FOTO'] ?? r['foto'] ?? '').trim(),
      note: String(r['NOTE'] ?? r['note'] ?? '').trim(),
      soglia_scorta: 5,
    }));
  };

  const upload = async () => {
    const rows: any[] = (globalThis as any).__imported || [];
    if (!rows.length) {
      Alert.alert('Nessun dato', 'Seleziona prima un file Excel.');
      return;
    }
    setBusy(true);
    setLog('Caricamento in corso...');
    try {
      const data = normalize(rows);
      let inseriti = 0;  
      let aggiornati = 0;
      let errori = 0;
 
      for (const prodotto of data) {
        try {
          const identificativo =
            prodotto.codice_prodotto ||
            prodotto.barcode ||
            '';

          const esistente = identificativo
            ? (getLocalProductById(identificativo) as any)
            : null;

          if (esistente) {
            updateLocalProduct(String(esistente.id), prodotto);
            aggiornati++;
          } else {
            createLocalProduct(prodotto);
            inseriti++;
          }
        } catch (errore) {
          console.warn('Errore import prodotto:', prodotto, errore);
          errori++;
        }
      }

      const totale = inseriti + aggiornati;

      setLog(
        `${totale} prodotti elaborati: ${inseriti} inseriti, ${aggiornati} aggiornati, ${errori} errori.`
      );

      Alert.alert(
        'Import completato',
        `${inseriti} prodotti inseriti.\n${aggiornati} prodotti aggiornati.\n${errori} errori.`,
        [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Errore', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="import-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="import-close"><Feather name="x" size={24} color={COLORS.onSurface} /></Pressable>
        <Text style={styles.title}>IMPORTA EXCEL</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>{"// FORMATO ATTESO"}</Text>
          <Text style={styles.infoTxt}>Il file deve contenere le colonne:</Text>
          <View style={styles.colList}>
            {COLS.map((c) => <Text key={c} style={styles.colTag}>{c}</Text>)}
          </View>
        </View>

        <Pressable style={styles.pickBtn} onPress={pickAndParse} disabled={busy} testID="pick-file-btn">
          <Feather name="file-plus" size={24} color={COLORS.onBrandPrimary} />
          <Text style={styles.pickBtnTxt}>{busy ? 'ATTENDI...' : 'SCEGLI FILE EXCEL'}</Text>
        </Pressable>

        {log ? <Text style={styles.log}>{log}</Text> : null}

        {preview.length > 0 && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>{"// ANTEPRIMA "}({preview.length} righe)</Text>
            {preview.map((r, i) => (
              <View key={i} style={styles.previewRow}>
                <Text style={styles.previewName} numberOfLines={2}>{r['DESCRIZIONE'] || r['descrizione'] || '—'}</Text>
                <Text style={styles.previewMeta}>{r['MARCA'] || ''} · {r['CATEGORIA'] || ''} · QTA {r['QUANTITÀ'] || r['QUANTITA'] || 0}</Text>
              </View>
            ))}
            <Pressable style={styles.uploadBtn} onPress={upload} disabled={busy} testID="confirm-import">
              {busy ? <ActivityIndicator color={COLORS.onSuccess} /> : (
                <>
                  <Feather name="upload-cloud" size={20} color={COLORS.onSuccess} />
                  <Text style={styles.uploadTxt}>CONFERMA IMPORT</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 2, borderColor: COLORS.borderStrong },
  title: { fontFamily: FONTS.display, fontSize: 18, fontWeight: '900', color: COLORS.onSurface, letterSpacing: 1 },
  infoBlock: { borderWidth: 2, borderColor: COLORS.borderStrong, padding: 16, gap: 8, backgroundColor: COLORS.surfaceSecondary },
  infoLabel: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  infoTxt: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onSurface },
  colList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  colTag: { fontFamily: FONTS.mono, fontSize: 10, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: COLORS.brand, color: COLORS.onBrandPrimary, letterSpacing: 0.5 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.brand, padding: 18, borderWidth: 2, borderColor: COLORS.borderStrong },
  pickBtnTxt: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: '900', color: COLORS.onBrandPrimary, letterSpacing: 1.5 },
  log: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onSurfaceSecondary },
  preview: { borderWidth: 2, borderColor: COLORS.borderStrong, padding: 12, gap: 8, backgroundColor: COLORS.surfaceSecondary },
  previewTitle: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  previewRow: { padding: 8, borderBottomWidth: 1, borderColor: COLORS.divider },
  previewName: { fontFamily: FONTS.display, fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  previewMeta: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, marginTop: 2 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.success, paddingVertical: 14, marginTop: 6 },
  uploadTxt: { fontFamily: FONTS.mono, fontSize: 13, fontWeight: '900', color: COLORS.onSuccess, letterSpacing: 1.5 },
});
