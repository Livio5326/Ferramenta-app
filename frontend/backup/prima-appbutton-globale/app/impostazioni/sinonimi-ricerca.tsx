import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/src/theme';
import { api } from "@/src/api";

type SearchSynonym = {
  termine: string;
  sinonimi: string[];
};

export default function SinonimiRicercaScreen() {
  const router = useRouter();

  const [items, setItems] = useState<SearchSynonym[]>([]);
  const [termine, setTermine] = useState('');
  const [sinonimi, setSinonimi] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await api.listSearchSynonyms();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert('Errore', e?.message || 'Errore caricamento sinonimi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    const term = termine.trim().toLowerCase();
    const values = sinonimi
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (!term) {
      Alert.alert('Attenzione', 'Inserisci il termine cercato.');
      return;
    }

    if (values.length === 0) {
      Alert.alert('Attenzione', 'Inserisci almeno un sinonimo separato da virgola.');
      return;
    }

    try {
      setSaving(true);
      await api.saveSearchSynonym({
        termine: term,
        sinonimi: values,
      });
      setTermine('');
      setSinonimi('');
      await load();
      Alert.alert('Salvato', 'Sinonimo ricerca salvato.');
    } catch (e: any) {
      Alert.alert('Errore', e?.message || 'Errore salvataggio sinonimo');
    } finally {
      setSaving(false);
    }
  }

  async function remove(term: string) {
    Alert.alert(
      'Elimina sinonimo',
      `Vuoi eliminare "${term}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteSearchSynonym(term);
              await load();
            } catch (e: any) {
              Alert.alert('Errore', e?.message || 'Errore eliminazione sinonimo');
            }
          },
        },
      ]
    );
  }

  function edit(item: SearchSynonym) {
    setTermine(item.termine);
    setSinonimi(item.sinonimi.join(', '));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={COLORS.onSurface} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>SINONIMI RICERCA</Text>
            <Text style={styles.subtitle}>
              Aggiungi parole alternative per migliorare la ricerca nel Catalogo.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nuovo sinonimo</Text>

          <Text style={styles.label}>Termine cercato</Text>
          <TextInput
            style={styles.input}
            placeholder="Esempio: flex"
            placeholderTextColor={COLORS.onSurfaceTertiary}
            value={termine}
            onChangeText={setTermine}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Sinonimi</Text>
          <TextInput
            style={styles.input}
            placeholder="Esempio: flessibile, smerigliatrice"
            placeholderTextColor={COLORS.onSurfaceTertiary}
            value={sinonimi}
            onChangeText={setSinonimi}
            autoCapitalize="none"
          />

          <Pressable
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={save}
            disabled={saving}
          >
            <Feather name="save" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Salva sinonimo</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sinonimi salvati</Text>

          {loading ? (
            <ActivityIndicator />
          ) : items.length === 0 ? (
            <Text style={styles.emptyText}>Nessun sinonimo salvato.</Text>
          ) : (
            items.map(item => (
              <View key={item.termine} style={styles.row}>
                <Pressable style={{ flex: 1 }} onPress={() => edit(item)}>
                  <Text style={styles.term}>{item.termine}</Text>
                  <Text style={styles.values}>{item.sinonimi.join(', ')}</Text>
                </Pressable>

                <Pressable style={styles.deleteBtn} onPress={() => remove(item.termine)}>
                  <Feather name="trash-2" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  container: {
    padding: 18,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 21,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 4,
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.onSurface,
    marginBottom: 12,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.onSurfaceSecondary,
    marginTop: 8,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    color: COLORS.onSurface,
  },
  saveBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabled: {
    opacity: 0.55,
  },
  saveBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  emptyText: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  term: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.onSurface,
  },
  values: {
    marginTop: 4,
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#B3261E',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
