import {
  useCallback,
  useEffect,
  useState } from 'react';
import { View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { COLORS, FONTS } from '@/src/theme';
import { api } from '@/src/api';
import type { Product } from '@/src/store';
import { FORNITORI_STANDARD } from '@/src/fornitoriStandard';
import { CATEGORIE_STANDARD } from '@/src/categorieStandard';

import AppButton from '@/src/components/AppButton';
type Form = {
  barcode: string;
  codice_prodotto: string;
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
  barcode: '', codice_prodotto: '', descrizione: '', marca: '', categoria: '', prezzo_acquisto: '0', prezzo_vendita: '0', quantita: '0', fornitore: '', foto: '', note: '', soglia_scorta: '0',
};

export default function ProductForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; barcode?: string }>();
  const editing = !!params.id;
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [categorieStandard, setCategorieStandard] = useState<string[]>(CATEGORIE_STANDARD);
  const [fornitoriStandard, setFornitoriStandard] = useState<string[]>(FORNITORI_STANDARD);
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  useEffect(() => {
  const load = async () => {
    try {
      const liste = await api.getStandardLists();

      const fornitori =
        liste.fornitori && liste.fornitori.length > 0
          ? liste.fornitori
          : FORNITORI_STANDARD;

      const categorie =
        liste.categorie && liste.categorie.length > 0
          ? liste.categorie
          : CATEGORIE_STANDARD;

      const marche =
        liste.marche && liste.marche.length > 0
          ? liste.marche
          : [];

      setFornitoriStandard(
        fornitori
          .map((v: string) => String(v || "").trim())
          .filter((v: string) => v && v !== "Tutte")
      );

      setCategorieStandard(
        categorie
          .map((v: string) => String(v || "").trim())
          .filter((v: string) => v && v !== "Tutte")
      );

      setBrands(
        marche
          .map((v: string) => String(v || "").trim())
          .filter((v: string) => v && v !== "Tutte")
      );
    } catch {
      setFornitoriStandard(
        FORNITORI_STANDARD.filter((v: string) => v && v !== "Tutte")
      );

      setCategorieStandard(
        CATEGORIE_STANDARD.filter((v: string) => v && v !== "Tutte")
      );

      setBrands([]);
    }
  };

  load();
}, []);

useEffect(() => {
  const load = async () => {
    if (params.id) {
      const p = await api.getProduct(String(params.id));

      if (p) {
        setForm({
          barcode: p.barcode || "",
          codice_prodotto: p.codice_prodotto || "",
          descrizione: p.descrizione || "",
          marca: p.marca || "",
          categoria: p.categoria || "",
          prezzo_acquisto: String(p.prezzo_acquisto || 0),
          prezzo_vendita: String(p.prezzo_vendita || 0),
          quantita: String(p.quantita || 0),
          fornitore: p.fornitore || "",
          foto: p.foto || "",
          note: p.note || "",
          soglia_scorta: String(p.soglia_scorta ?? 0),
        });
      }
    } else if (params.barcode) {
      setForm((f) => ({ ...f, barcode: String(params.barcode) }));
    }
  };

  load();
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
      codice_prodotto: form.codice_prodotto.trim(),
      descrizione: form.descrizione.trim(),
      marca: form.marca.trim(),
      marca_standard: form.marca.trim(),
      categoria: form.categoria.trim(),
      categoria_standard: form.categoria.trim(),
      prezzo_acquisto: parseFloat(form.prezzo_acquisto.replace(',', '.')) || 0,
      prezzo_vendita: parseFloat(form.prezzo_vendita.replace(',', '.')) || 0,
      quantita: parseInt(form.quantita) || 0,
      fornitore: form.fornitore.trim(),
      foto: form.foto,
      note: form.note,
      soglia_scorta: form.soglia_scorta.trim() === '' ? 0 : Number(form.soglia_scorta),
    };
    try {
    if (editing && params.id) {
      await api.updateProduct(String(params.id), payload);
    } else {
      await api.createProduct(payload);
    }

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
          <AppButton onPress={() => router.back()} testID="form-close"><Feather name="x" size={24} color={COLORS.onSurface} /></AppButton>
          <Text style={styles.headerTitle}>{editing ? 'MODIFICA' : 'NUOVO PRODOTTO'}</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <AppButton style={styles.photoBlock} onPress={() => Alert.alert('Foto', '', [
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
          </AppButton>

          <Field label="DESCRIZIONE *" value={form.descrizione} onChange={(v) => set('descrizione', v)} testID="f-descrizione" multiline />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field label="BARCODE" value={form.barcode} onChange={(v) => set('barcode', v)} testID="f-barcode" keyboard="numeric" />
            </View>

            <AppButton
              onPress={() => router.push({ pathname: '/scanner', params: { returnTo: 'product-new' } })}
              style={{
                width: 54,
                height: 54,
                marginLeft: 10,
                marginBottom: 24,
                borderWidth: 2,
                borderColor: COLORS.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              testID="scan-barcode-new-product"
            >
               <Feather name="maximize" size={22} color={COLORS.brand} />
            </AppButton>
          </View>
          
          <Field label="CODICE PRODOTTO" value={form.codice_prodotto} onChange={(v) => set('codice_prodotto', v)} testID="f-codice-prodotto" />
          <Field label="URL FOTO (opz.)" value={form.foto.startsWith('data:') ? '' : form.foto} onChange={(v) => set('foto', v)} testID="f-foto" placeholder="https://..." />
          <View style={styles.field}>
          <Text style={styles.fieldSelectLabel}>MARCA</Text>
          <AppButton
            style={[styles.input, styles.selectInput]}
            onPress={() => setBrandPickerOpen(true)}
            testID="f-marca"
          >
            <View style={styles.selectInputInner}>
              <Text style={styles.selectInputText}>
                {form.marca || "Seleziona marca"}
              </Text>
              <Feather name="chevron-down" size={18} color={COLORS.onSurface} />
            </View>
          </AppButton>
        </View>
          <View style={styles.field}>
          <Text style={styles.fieldSelectLabel}>CATEGORIA</Text>
          <AppButton
            style={[styles.input, styles.selectInput]}
            onPress={() => setCategoryPickerOpen(true)}
            testID="f-categoria"
          >
            <View style={styles.selectInputInner}>
              <Text style={styles.selectInputText}>
                {form.categoria || "Seleziona categoria"}
              </Text>
              <Feather name="chevron-down" size={18} color={COLORS.onSurface} />
            </View>
          </AppButton>
        </View>
          <View style={styles.row2}>
            <Field label="P. ACQUISTO €" value={form.prezzo_acquisto} onChange={(v) => set('prezzo_acquisto', v)} testID="f-acq" keyboard="decimal-pad" half />
            <Field label="P. VENDITA €" value={form.prezzo_vendita} onChange={(v) => set('prezzo_vendita', v)} testID="f-vend" keyboard="decimal-pad" half />
          </View>
          <View style={styles.row2}>
            <Field label="QUANTITÀ" value={form.quantita} onChange={(v) => set('quantita', v)} testID="f-qty" keyboard="numeric" half />
            <Field label="SOGLIA SCORTA" value={form.soglia_scorta} onChange={(v) => set('soglia_scorta', v)} testID="f-soglia" keyboard="numeric" half />
          </View>
          <View style={styles.field}>
          <Text style={styles.fieldSelectLabel}>FORNITORE</Text>
          <AppButton
            style={[styles.input, styles.selectInput]}
            onPress={() => setSupplierPickerOpen(true)}
            testID="f-forn"
          >
            <View style={styles.selectInputInner}>
              <Text style={styles.selectInputText}>
                {form.fornitore || "Seleziona fornitore"}
              </Text>
              <Feather name="chevron-down" size={18} color={COLORS.onSurface} />
            </View>
          </AppButton>
        </View>
          <Field label="NOTE" value={form.note} onChange={(v) => set('note', v)} testID="f-note" multiline />
        </ScrollView>
          <Modal
          visible={brandPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setBrandPickerOpen(false)}
        >
          <View style={styles.selectOverlay}>
            <View style={styles.selectBox}>
              <View style={styles.selectHeader}>
                <Text style={styles.selectTitle}>Marca</Text>
                <AppButton onPress={() => setBrandPickerOpen(false)}>
                  <Text style={styles.selectClose}>×</Text>
                </AppButton>
              </View>

              <ScrollView style={styles.selectList}>
                {brands.map((brand) => (
                  <AppButton
                    key={brand}
                    style={[
                      styles.selectOption,
                      form.marca === brand && styles.selectOptionActive,
                    ]}
                    onPress={() => {
                      set('marca', brand);
                      setBrandPickerOpen(false);
                    }}
                  >
                    <Text style={styles.selectOptionText}>{brand}</Text>
                  </AppButton>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={supplierPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSupplierPickerOpen(false)}
        >
          <View style={styles.selectOverlay}>
            <View style={styles.selectBox}>
              <View style={styles.selectHeader}>
                <Text style={styles.selectTitle}>Fornitore</Text>
                <AppButton onPress={() => setSupplierPickerOpen(false)}>
                  <Text style={styles.selectClose}>×</Text>
                </AppButton>
              </View>

              <ScrollView style={styles.selectList}>
                {fornitoriStandard.map((supplier: string) => (
                  <AppButton
                    key={supplier}
                    style={[
                      styles.selectOption,
                      form.fornitore === supplier && styles.selectOptionActive,
                    ]}
                    onPress={() => {
                      set('fornitore', supplier);
                      setSupplierPickerOpen(false);
                    }}
                  >
                    <Text style={styles.selectOptionText}>{supplier}</Text>
                  </AppButton>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={categoryPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCategoryPickerOpen(false)}
        >
          <View style={styles.selectOverlay}>
            <View style={styles.selectBox}>
              <View style={styles.selectHeader}>
                <Text style={styles.selectTitle}>Categoria</Text>
                <AppButton onPress={() => setCategoryPickerOpen(false)}>
                  <Text style={styles.selectClose}>×</Text>
                </AppButton>
              </View>

              <ScrollView style={styles.selectList}>
                {categorieStandard.map((cat: string) => (
                  <AppButton
                    key={cat}
                    style={[
                      styles.selectOption,
                      form.categoria === cat && styles.selectOptionActive,
                    ]}
                    onPress={() => {
                      set('categoria', cat);
                      setCategoryPickerOpen(false);
                    }}
                  >
                    <Text style={styles.selectOptionText}>{cat}</Text>
                  </AppButton>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

      <View style={styles.footer}>
          <AppButton style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={submit} disabled={saving} testID="save-btn">
            <Feather name="check" size={20} color={COLORS.onBrandPrimary} />
            <Text style={styles.saveTxt}>{saving ? 'SALVATAGGIO...' : (editing ? 'AGGIORNA' : 'SALVA PRODOTTO')}</Text>
          </AppButton>
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
  selectInput: {
    justifyContent: "center",
  },

  selectInputText: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontFamily: FONTS.mono,
  },

  selectOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },

  selectBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  selectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  selectTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontFamily: FONTS.mono,
    fontWeight: "900",
  },

  selectClose: {
    color: COLORS.onSurface,
    fontSize: 26,
    fontWeight: "900",
  },

  selectList: {
    maxHeight: 420,
  },

  selectOption: {
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
  },

  selectOptionActive: {
    backgroundColor: COLORS.surfaceInverse,
  },

  selectOptionText: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "800",
  },

  fieldSelectLabel: {
    color: COLORS.onSurface,
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: 0.6,
  },

  selectInputInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

});
