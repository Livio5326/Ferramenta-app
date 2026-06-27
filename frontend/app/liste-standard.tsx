import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { api } from "@/src/api";
import { COLORS, FONTS } from "@/src/theme";

type TipoLista = "categorie" | "fornitori" | "marche";

type ListeState = {
  categorie: string[];
  fornitori: string[];
  marche: string[];
};

const TABS: { key: TipoLista; label: string }[] = [
  { key: "categorie", label: "Categorie" },
  { key: "fornitori", label: "Fornitori" },
  { key: "marche", label: "Marche" },
];

export default function ListeStandardScreen() {
  const router = useRouter();

  const [active, setActive] = useState<TipoLista>("categorie");
  const [lists, setLists] = useState<ListeState>({
    categorie: [],
    fornitori: [],
    marche: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [oldValue, setOldValue] = useState("");
  const [value, setValue] = useState("");

  const items = useMemo(() => lists[active] || [], [lists, active]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getStandardLists();
      setLists({
        categorie: data.categorie || [],
        fornitori: data.fornitori || [],
        marche: data.marche || [],
      });
    } catch (e: any) {
      Alert.alert("Errore", String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setOldValue("");
    setValue("");
    setModalOpen(true);
  };

  const openEdit = (item: string) => {
    setOldValue(item);
    setValue(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setOldValue("");
    setValue("");
  };

  const saveItem = async () => {
    const cleaned = value.trim();

    if (!cleaned) {
      Alert.alert("Attenzione", "Inserisci un valore.");
      return;
    }

    setSaving(true);
    try {
      const res = oldValue
        ? await api.updateStandardListItem(active, oldValue, cleaned)
        : await api.addStandardListItem(active, cleaned);

      setLists((prev) => ({
        ...prev,
        [active]: res.items || [],
      }));

      closeModal();
    } catch (e: any) {
      Alert.alert("Errore", String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (item: string) => {
    Alert.alert(
      "Eliminare voce?",
      `Vuoi eliminare "${item}" dalla lista ${labelActive()}?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              const res = await api.deleteStandardListItem(active, item);
              setLists((prev) => ({
                ...prev,
                [active]: res.items || [],
              }));
            } catch (e: any) {
              Alert.alert("Errore", String(e?.message || e));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const labelActive = () => {
    return TABS.find((t) => t.key === active)?.label || active;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={COLORS.onSurface} />
        </Pressable>

        <View style={styles.headerTextBox}>
          <Text style={styles.title}>Liste standard</Text>
          <Text style={styles.subtitle}>
            Modifica categorie, fornitori e marche
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, active === tab.key && styles.tabActive]}
            onPress={() => setActive(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                active === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toolbar}>
        <View>
          <Text style={styles.sectionTitle}>{labelActive()}</Text>
          <Text style={styles.count}>{items.length} voci</Text>
        </View>

        <Pressable style={styles.addButton} onPress={openAdd}>
          <Feather name="plus" size={17} color={COLORS.onBrandPrimary} />
          <Text style={styles.addButtonText}>AGGIUNGI</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.brand} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.length === 0 ? (
            <Text style={styles.empty}>Nessuna voce presente.</Text>
          ) : (
            items.map((item) => (
              <View key={item} style={styles.itemRow}>
                <Text style={styles.itemText}>{item}</Text>

                <View style={styles.itemActions}>
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => openEdit(item)}
                  >
                    <Feather name="edit-2" size={16} color={COLORS.onSurface} />
                  </Pressable>

                  <Pressable
                    style={styles.iconButton}
                    onPress={() => deleteItem(item)}
                  >
                    <Feather name="trash-2" size={16} color={COLORS.error} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {oldValue ? "Modifica voce" : "Aggiungi voce"}
              </Text>

              <Pressable onPress={closeModal}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>{labelActive()}</Text>

            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Scrivi voce..."
              placeholderTextColor={COLORS.onSurfaceTertiary}
              style={styles.input}
              autoCapitalize="words"
            />

            <Pressable
              style={[styles.saveButton, saving && styles.disabled]}
              disabled={saving}
              onPress={saveItem}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "SALVATAGGIO..." : "SALVA"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
  },

  headerTextBox: {
    flex: 1,
  },

  title: {
    color: COLORS.onSurface,
    fontSize: 20,
    fontFamily: FONTS.mono,
    fontWeight: "900",
  },

  subtitle: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  tabActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },

  tabText: {
    color: COLORS.onSurface,
    fontSize: 12,
    fontWeight: "900",
  },

  tabTextActive: {
    color: COLORS.onBrandPrimary,
  },

  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontFamily: FONTS.mono,
    fontWeight: "900",
  },

  count: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },

  addButtonText: {
    color: COLORS.onBrandPrimary,
    fontSize: 12,
    fontWeight: "900",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    padding: 16,
    paddingBottom: 30,
  },

  empty: {
    color: COLORS.onSurfaceSecondary,
    textAlign: "center",
    marginTop: 40,
  },

  itemRow: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  itemText: {
    flex: 1,
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: "800",
  },

  itemActions: {
    flexDirection: "row",
    gap: 8,
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },

  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  modalTitle: {
    color: COLORS.onSurface,
    fontSize: 16,
    fontFamily: FONTS.mono,
    fontWeight: "900",
  },

  closeText: {
    color: COLORS.onSurface,
    fontSize: 26,
    fontWeight: "900",
  },

  inputLabel: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
  },

  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.onSurface,
    fontSize: 15,
    marginBottom: 14,
  },

  saveButton: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },

  saveButtonText: {
    color: COLORS.onBrandPrimary,
    fontSize: 13,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.6,
  },
});
