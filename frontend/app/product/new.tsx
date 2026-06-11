import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { COLORS, FONTS } from '@/src/theme';
import { api } from '@/src/api';

type Form = {
  barcode: string;
  descrizione: string;
  marca: string;
  categoria: string;
  prezzo_acquisto: string;
  prezzo_vendita: string;
  quantita: string;
  fornitore: string;
  foto: string;
  note: string;
  soglia_scorta: string;
};

const empty: Form = {
  barcode: '', descrizione: '', marca: '', categoria: '', prezzo_acquisto: '0', prezzo_vendita: '0', quantita: '0', fornitore: '', foto: '', note: '', soglia_scorta: '5',
};

export default function ProductForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; barcode?: string }>();
  const editing = !!params.id;
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params.id) {
      api.getProduct(params.id).then((p) => {
        setForm({
          barcode: p.barcode, descrizione: p.descrizione, marca: p.marca, categoria: p.categoria,
          prezzo_acquisto: String(p.prezzo_acquisto), prezzo_vendita: String(p.prezzo_vendita),
          quantita: String(p.quantita), fornitore: p.fornitore, foto: p.foto, note: p.note,
          soglia_scorta: String(p.soglia_scorta),
        });
      }).catch(() => {});
    } else if (params.barcode) {
      setForm((f) => ({ ...f, barcode: String(params.barcode) }));
    }
  }, [params.id, params.barcode]);

  const set = useCallback((k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v })), []);

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permesso negato', 'Concedi il permesso per accedere alle foto.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]?.base64) {
      set('foto', `data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const submit = async () => {
    if (!form.descrizione.trim()) {
      Alert.alert('Errore', 'La descrizione è obbligatoria');
      return;
    }
    setSaving(true);
    const payload = {
      barcode: form.barcode.trim(),
      descrizione: form.descrizione.trim(),
      marca: form.marca.trim(),
      categoria: form.categoria.trim(),
      prezzo_acquisto: parseFloat(form.prezzo_acquisto.replace(',', '.')) || 0,
      prezzo_vendita: parseFloat(form.prezzo_vendita.replace(',', '.')) || 0,
      quantita: parseInt(form.quantita) || 0,
      fornitore: form.fornitore.trim(),
      foto: form.foto,
      note: form.note,
      soglia_scorta: parseInt(form.soglia_scorta) || 5,
    };
    try {
      if (editing && params.id) await api.updateProduct(params.id, payload);
      else await api.createProduct(payload);
      router.back();
    } catch (e: any) {
      Alert.alert('Errore', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="product-form">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="form-close"><Feather name="x" size={24} color={COLORS.onSurface} /></Pressable>
          <Text style={styles.headerTitle}>{editing ? 'MODIFICA' : 'NUOVO PRODOTTO'}</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.photoBlock} onPress={() => Alert.alert('Foto', '', [
            { text: 'Camera', onPress: () => pickImage(true) },
            { text: 'Galleria', onPress: () => pickImage(false) },
            { text: 'URL', onPress: () => set('foto', form.foto) },
            { text: 'Annulla', style: 'cancel' },
          ])} testID="photo-btn">
            {form.foto ? (
              <Image source={form.foto} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.photoEmpty}>
                <Feather name="camera" size={36} color={COLORS.brand} />
                <Text style={styles.photoHint}>TOCCA PER FOTO</Text>
              </View>
            )}
          </Pressable>

          <Field label="DESCRIZIONE *" value={form.descrizione} onChange={(v) => set('descrizione', v)} testID="f-descrizione" multiline />
          <Field label="BARCODE" value={form.barcode} onChange={(v) => set('barcode', v)} testID="f-barcode" keyboard="numeric" />
          <Field label="URL FOTO (opz.)" value={form.foto.startsWith('data:') ? '' : form.foto} onChange={(v) => set('foto', v)} testID="f-foto" placeholder="https://..." />
          <Field label="MARCA" value={form.marca} onChange={(v) => set('marca', v)} testID="f-marca" />
          <Field label="CATEGORIA" value={form.categoria} onChange={(v) => set('categoria', v)} testID="f-categoria" />
          <View style={styles.row2}>
            <Field label="P. ACQUISTO €" value={form.prezzo_acquisto} onChange={(v) => set('prezzo_acquisto', v)} testID="f-acq" keyboard="decimal-pad" half />
            <Field label="P. VENDITA €" value={form.prezzo_vendita} onChange={(v) => set('prezzo_vendita', v)} testID="f-vend" keyboard="decimal-pad" half />
          </View>
          <View style={styles.row2}>
            <Field label="QUANTITÀ" value={form.quantita} onChange={(v) => set('quantita', v)} testID="f-qty" keyboard="numeric" half />
            <Field label="SOGLIA SCORTA" value={form.soglia_scorta} onChange={(v) => set('soglia_scorta', v)} testID="f-soglia" keyboard="numeric" half />
          </View>
          <Field label="FORNITORE" value={form.fornitore} onChange={(v) => set('fornitore', v)} testID="f-forn" />
          <Field label="NOTE" value={form.note} onChange={(v) => set('note', v)} testID="f-note" multiline />
        </ScrollView>
        <View style={styles.footer}>
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={submit} disabled={saving} testID="save-btn">
            <Feather name="check" size={20} color={COLORS.onBrandPrimary} />
            <Text style={styles.saveTxt}>{saving ? 'SALVATAGGIO...' : (editing ? 'AGGIORNA' : 'SALVA PRODOTTO')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, testID, keyboard, multiline, placeholder, half }: { label: string; value: string; onChange: (v: string) => void; testID: string; keyboard?: any; multiline?: boolean; placeholder?: string; half?: boolean }) {
  return (
    <View style={[styles.field, half && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={COLORS.onSurfaceSecondary}
        style={[styles.input, multiline && { minHeight: 60, textAlignVertical: 'top' }]}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 2, borderColor: COLORS.borderStrong },
  headerTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: '900', color: COLORS.onSurface, letterSpacing: 1 },
  photoBlock: { width: '100%', height: 200, backgroundColor: COLORS.surfaceSecondary, borderBottomWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { alignItems: 'center', gap: 8 },
  photoHint: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  field: { padding: 12, borderBottomWidth: 1, borderColor: COLORS.divider },
  fieldLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5, marginBottom: 6 },
  input: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.onSurface, paddingVertical: 6, borderBottomWidth: 2, borderColor: COLORS.borderStrong },
  row2: { flexDirection: 'row', borderBottomWidth: 0 },
  footer: { padding: 12, borderTopWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.brand, paddingVertical: 16 },
  saveTxt: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: '900', color: COLORS.onBrandPrimary, letterSpacing: 1.5 },
});
