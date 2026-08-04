import {
  api } from "../../src/api";
import React,
  { useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAppStore } from "../../src/store";
import { BACKEND_URL } from "../../src/config/backend";

import AppButton from '@/src/components/AppButton';
const PAGE_SIZE = 30;

const COLORS = {
  surface: "#F4EFE7",
  card: "#FFF9EF",
  text: "#2F2A22",
  muted: "#7A6B5B",
  border: "#D7C7AF",
  green: "#315C3A",
  greenDark: "#213F28",
  red: "#8B1E1E",
  orange: "#9B4E18",
  chip: "#EFE5D6",
  white: "#FFFFFF",
};

const CATEGORIE_STANDARD = [
  "Utensili manuali",
  "Strumenti di misura",
  "Utensili a filo",
  "Utensili a batteria",
  "Accessori",
  "Portautensili",
  "Ferramenta",
  "Fissaggio",
  "Giardinaggio",
  "Vernici",
  "Idraulica",
  "Elettrico",
  "Antinfortunistica",
  "Auto",
  "Casa",
  "Chiavi",
  "Altro",
];

const MARCHE_STANDARD = [
  "Tutte",
  "Ambrovit",
  "Stanley",
  "Black & Decker",
  "DeWalt",
  "USAG",
  "Beta",
  "Bosch",
  "Makita",
  "Einhell",
  "Fischer",
  "Arexons",
  "Saratoga",
  "Vileda",
  "Mapei",
  "Cisa",
  "Mottura",
  "Yale",
  "Tesa",
  "Wolfcraft",
  "Kapriol",
  "Sika",
  "Pattex",
  "Henkel",
  "Bostik",
  "WD-40",
  "Svitol",
];

type Product = {
  id?: string;
  _id?: string;
  barcode?: string;
  codice_prodotto?: string;
  codice_fornitore?: string;
  nome?: string;
  descrizione?: string;
  categoria?: string;
  marca?: string;
  marca_standard?: string;
  fornitore?: string;
  quantita?: number | null;
  soglia_scorta?: number | null;
  prezzo_acquisto?: number | null;
  prezzo_vendita?: number | null;
  prezzo_promo?: number | null;
  promo_attiva?: boolean;
  foto?: string;
  image_url?: string;
  immagine?: string;
  immagine_url?: string;
  note?: string;
};

function prezzoFinaleProdotto(p: Product): number {
  const prezzoPromo = Number(p.prezzo_promo || 0);
  if (p.promo_attiva && prezzoPromo > 0) return prezzoPromo;
  return Number(p.prezzo_vendita || 0);
}

function haPromoProdotto(p: Product): boolean {
  return Boolean(p.promo_attiva && Number(p.prezzo_promo || 0) > 0);
}

function testoProdottoFiltro(p: Product) {
  return [
    p.descrizione,
    p.nome,
    p.categoria,
    p.marca,
    p.marca_standard,
    p.fornitore,
    p.note,
    p.codice_prodotto,
    p.codice_fornitore,
    p.barcode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getProductId(p: Product) {
  return String(p.id || p._id || p.codice_prodotto || p.barcode || "");
}

function getProductTitle(p: Product) {
  return String(p.descrizione || p.nome || "Prodotto senza descrizione");
}

function getProductPhoto(p: Product) {
  return p.foto || p.image_url || p.immagine || p.immagine_url || "";
}

function buildImageUri(foto: string) {
  const value = String(foto || "").trim();

  if (
    value.startsWith("data:image/") ||
    value.startsWith("file://") ||
    value.startsWith("content://")
  ) {
    return value;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const filename = value.split("/uploads/").pop() || "";
    return filename ? `${BACKEND_URL}/uploads/${filename}` : value;
  }

  if (value) {
    return `${BACKEND_URL}/uploads/${value.replace(/^\/+/, "")}`;
  }

  return "";
}

export default function CatalogoScreen() {
  const params = useLocalSearchParams<{
    categoria?: string;
    sotto_scorta?: string;
    vendita?: string;
  }>();

  const mode = useAppStore((s: any) => s.mode);
  const addToCart = useAppStore((s: any) => s.addToCart);
  const isCliente = mode === "cliente";

  const categoriaDaPagina = typeof params.categoria === "string" ? params.categoria : "";
  const catalogoFiltratoDaPagina = categoriaDaPagina.length > 0;

  const soloSottoScorta = params.sotto_scorta === "true";
  const soloVendita = params.vendita === "true";

  const [q, setQ] = useState("");
  const [searchMode, setSearchMode] = useState<"descrizione" | "codice" | "barcode">("descrizione");

  const [categoria, setCategoria] = useState<string | null>(
    catalogoFiltratoDaPagina ? categoriaDaPagina : null
  );

  const [marcaStandard, setMarcaStandard] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [brandFilterOpen, setBrandFilterOpen] = useState(false);
  const [brandsReali, setBrandsReali] = useState<string[]>([]);

  const [filtroPrezzoAttivo, setFiltroPrezzoAttivo] = useState(false);
  const [prezzoMin, setPrezzoMin] = useState(0);
  const [prezzoMax, setPrezzoMax] = useState(1000);
  const [priceFilterOpen, setPriceFilterOpen] = useState(false);
  const [filtroDaCompletare, setFiltroDaCompletare] = useState(false);
  const [categorieStandardBackend, setCategorieStandardBackend] = useState<string[]>([]);

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const skipRef = useRef(0);
  const loadedCountRef = useRef(PAGE_SIZE);
  const lastOpenedProductIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const requestRef = useRef(0);
  const listaRef = useRef<FlatList<Product>>(null);
  const scrollOffsetRef = useRef(0);

  const cats = catalogoFiltratoDaPagina ? [categoriaDaPagina] : (categorieStandardBackend.length > 0 ? categorieStandardBackend : CATEGORIE_STANDARD);

  const brands = brandsReali.length > 0 ? brandsReali : MARCHE_STANDARD;
  const filteredBrands = brands.filter((m) =>
    m.toLowerCase().includes(brandSearch.toLowerCase())
  );

  useFocusEffect(
  useCallback(() => {
    let active = true;

    const loadStandardLists = async () => {
      try {
        const res = await api.getStandardLists();

        if (!active) return;

        setCategorieStandardBackend(
          (res.categorie || []).filter(
            (v: string) => v && v !== "Tutte"
          )
        );

        setBrandsReali([
          "Tutte",
          ...(res.marche || []).filter(
            (m: string) => m && m !== "Tutte"
          ),
        ]);
      } catch (e) {
        console.warn("Errore caricamento liste standard", e);
      }
    };

    loadStandardLists();

    return () => {
      active = false;
    };
  }, [])
);

  useEffect(() => {
    if (!catalogoFiltratoDaPagina) return;
    setCategoria(categoriaDaPagina);
    setQ("");
  }, [catalogoFiltratoDaPagina, categoriaDaPagina]);

  const loadInitial = useCallback(async (options?: { scrollToTop?: boolean; keepLoaded?: boolean }) => {
    const requestId = ++requestRef.current;

    loadingRef.current = true;
    setLoading(true);
    setHasMore(true);
    hasMoreRef.current = true;
    skipRef.current = 0;

    try {
      const requestedLimit = options?.keepLoaded
  ? Math.max(loadedCountRef.current, PAGE_SIZE)
  : PAGE_SIZE;

const res = await api.listProductsPage({
  search_mode: searchMode,
  q: q || undefined,
  categoria: categoria || undefined,
  marca_standard: marcaStandard || undefined,
  vendibile: soloVendita || undefined,
  sotto_scorta: soloSottoScorta || undefined,
  da_completare: filtroDaCompletare || undefined,
  prezzo_min: filtroPrezzoAttivo ? Number(prezzoMin) : undefined,
  prezzo_max: filtroPrezzoAttivo ? Number(prezzoMax) : undefined,
  limit: requestedLimit,
  skip: 0,
});
     
      if (requestId !== requestRef.current) return;

      const data = (Array.isArray(res?.items) ? res.items : []) as Product[];

      const prodottiVisibili = soloVendita
        ? data.filter((p) => Number(p.quantita ?? 0) > 0)
        : data;

      setItems(prodottiVisibili);
      loadedCountRef.current = prodottiVisibili.length;
      const more = Boolean(res.hasMore);
      setHasMore(more);
      hasMoreRef.current = more;
      skipRef.current = data.length;
      loadedCountRef.current = prodottiVisibili.length;

      setTimeout(() => {
        if (options?.scrollToTop !== false) {
      listaRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
      }, 50);
    } catch (e: any) {
      console.warn("Errore caricamento catalogo", e);
      Alert.alert("Errore", e?.message || "Errore caricamento catalogo");
      setItems([]);
      setHasMore(false);
      hasMoreRef.current = false;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [
    searchMode,
    q,
    categoria,
    marcaStandard,
    soloSottoScorta,
    soloVendita,
    filtroPrezzoAttivo,
    prezzoMin,
    prezzoMax,
    filtroDaCompletare,
  ]);

  
  useFocusEffect(
    useCallback(() => {
      const returningFromProduct = !!lastOpenedProductIdRef.current;

      if (returningFromProduct) {
        loadInitial({ scrollToTop: false, keepLoaded: true });
      } else {
        loadedCountRef.current = PAGE_SIZE;
        scrollOffsetRef.current = 0;
        loadInitial({ scrollToTop: true, keepLoaded: false });
      }
    }, [loadInitial])
  );


  const scrollToLastOpenedProduct = useCallback(() => {
    const productId = lastOpenedProductIdRef.current;
    if (!productId || items.length === 0) {
      return;
    }

    const targetIndex = items.findIndex((p) => getProductId(p) === productId);

    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    setTimeout(() => {
      try {
        listaRef.current?.scrollToIndex({
          index: targetIndex,
          animated: false,
          viewPosition: 0.12,
        });
        lastOpenedProductIdRef.current = null;
      } catch (e) {
        const fallbackOffset = Math.max(0, targetIndex * 220 - 80);
        listaRef.current?.scrollToOffset({
          offset: fallbackOffset,
          animated: false,
        });
        lastOpenedProductIdRef.current = null;
      }
    }, 500);
  }, [items]);

  useEffect(() => {
    scrollToLastOpenedProduct();
  }, [scrollToLastOpenedProduct]);

const loadMore = useCallback(async () => {
    if (loadingRef.current || loadingMore || refreshing || !hasMoreRef.current) return;

    loadingRef.current = true;
    setLoadingMore(true);

    try {
      const currentSkip = skipRef.current;
      
      const res = await api.listProductsPage({
  search_mode: searchMode,
  q: q || undefined,
  categoria: categoria || undefined,
  marca_standard: marcaStandard || undefined,
  vendibile: soloVendita || undefined,
  sotto_scorta: soloSottoScorta || undefined,
  da_completare: filtroDaCompletare || undefined,
  prezzo_min: filtroPrezzoAttivo ? Number(prezzoMin) : undefined,
  prezzo_max: filtroPrezzoAttivo ? Number(prezzoMax) : undefined,
  limit: PAGE_SIZE,
  skip: currentSkip,
});
    
      const data = (Array.isArray(res?.items) ? res.items : []) as Product[];

      const prodottiVisibili = soloVendita
        ? data.filter((p) => Number(p.quantita ?? 0) > 0)
        : data;

      setItems((prev) => {
        const already = new Set(prev.map((p) => getProductId(p)));
        const nuovi = prodottiVisibili.filter((p) => {
          const id = getProductId(p);
          if (!id) return true;
          return !already.has(id);
        });

        return [...prev, ...nuovi];
      });

      const more = Boolean(res.hasMore);
      setHasMore(more);
      hasMoreRef.current = more;
      skipRef.current = currentSkip + data.length;
    } catch (e: any) {
      console.warn("Errore caricamento altri prodotti", e);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    refreshing,
    searchMode,
    q,
    categoria,
    marcaStandard,
    soloSottoScorta,
    soloVendita,
    filtroPrezzoAttivo,
    prezzoMin,
    prezzoMax,
    filtroDaCompletare,
  ]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInitial();
    } finally {
      setRefreshing(false);
    }
  }, [loadInitial]);

  const cambiaCategoria = useCallback((nuovaCategoria: string | null) => {
    setCategoria(nuovaCategoria);
    setQ("");
    setItems([]);
    setHasMore(true);
    hasMoreRef.current = true;
    skipRef.current = 0;
  }, []);

  const cambiaMarca = useCallback((marca: string | null) => {
    setMarcaStandard(marca && marca !== "Tutte" ? marca : null);
    setItems([]);
    setHasMore(true);
    hasMoreRef.current = true;
    skipRef.current = 0;
  }, []);

  const changeSearchMode = useCallback((modeValue: "descrizione" | "codice" | "barcode") => {
    setSearchMode(modeValue);
    setQ("");
    setItems([]);
    setHasMore(true);
    hasMoreRef.current = true;
    skipRef.current = 0;
  }, []);

  const renderCard = useCallback(
    ({ item }: { item: Product }) => {
      const low = Number(item.quantita ?? 0) <= Number(item.soglia_scorta ?? 0);
      const prezzo = prezzoFinaleProdotto(item);
      const hasPromo = haPromoProdotto(item);
      const foto = getProductPhoto(item);
      const uri = buildImageUri(foto);
      console.log("URI FOTO:", uri.substring(0, 50), uri.length);
      const productId = getProductId(item);

      return (
        <AppButton
          style={styles.card}
          onPress={() => {
            if (!productId) return;
            lastOpenedProductIdRef.current = productId;
        router.push(`/product/${encodeURIComponent(productId)}`);
          }}
          testID={`product-card-${productId}`}
        >
          <View style={styles.cardImgWrap}>
            {uri ? (
              <Image source={{ uri }} style={styles.cardImg} resizeMode="contain" />
            ) : (
              <View style={styles.placeholderImg}>
                <Text style={styles.placeholderText}>NO FOTO</Text>
              </View>
            )}
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardBrand} numberOfLines={1}>
              {item.marca_standard || item.marca || item.fornitore || "Senza marca"}
            </Text>

            <Text style={styles.cardTitle} numberOfLines={3}>
              {getProductTitle(item)}
            </Text>

            <Text style={styles.cardCode} numberOfLines={1}>
              Cod: {item.codice_prodotto || item.codice_fornitore || item.barcode || "N/D"}
            </Text>

            <Text style={styles.cardCategory} numberOfLines={1}>
              {item.categoria || "Da classificare"}
            </Text>

            <View style={styles.cardBottom}>
              <View>
                <Text style={[styles.price, hasPromo && styles.pricePromo]}>
                  € {prezzo.toFixed(2)}
                </Text>

                {hasPromo ? (
                  <Text style={styles.promoBadge}>PROMO</Text>
                ) : null}
              </View>

              <View style={styles.qtyBox}>
                <Text style={[styles.qty, low && styles.qtyLow]}>
                  QTA {Number(item.quantita ?? 0)}
                </Text>
              </View>
            </View>

            {isCliente ? (
              <AppButton
                style={styles.addButton}
                onPress={(event) => {
                  event.stopPropagation();
                  addToCart?.(item);
                  Alert.alert("Carrello", "Prodotto aggiunto al carrello.");
                }}
              >
                <Text style={styles.addButtonText}>AGGIUNGI</Text>
              </AppButton>
            ) : null}
          </View>
        </AppButton>
      );
    },
    [addToCart, isCliente]
  );

  const headerSubtitle = useMemo(() => {
    if (catalogoFiltratoDaPagina) return categoriaDaPagina;
    if (categoria) return categoria;
    return "Tutti i prodotti";
  }, [catalogoFiltratoDaPagina, categoriaDaPagina, categoria]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Catalogo</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>

        <AppButton style={styles.filterButton} onPress={() => setFiltersOpen(true)}>
          <Text style={styles.filterButtonText}>Filtri</Text>
        </AppButton>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={
            searchMode === "barcode"
              ? "Cerca barcode"
              : searchMode === "codice"
                ? "Cerca codice"
                : "Cerca"
          }
          placeholderTextColor={COLORS.muted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <View style={styles.searchModeRow}>
        <AppButton
          style={[styles.modeChip, searchMode === "descrizione" && styles.modeChipActive]}
          onPress={() => changeSearchMode("descrizione")}
        >
          <Text
            style={[
              styles.modeChipText,
              searchMode === "descrizione" && styles.modeChipTextActive,
            ]}
          >
            Descrizione
          </Text>
        </AppButton>

        <AppButton
          style={[styles.modeChip, searchMode === "codice" && styles.modeChipActive]}
          onPress={() => changeSearchMode("codice")}
        >
          <Text
            style={[
              styles.modeChipText,
              searchMode === "codice" && styles.modeChipTextActive,
            ]}
          >
            Codice
          </Text>
        </AppButton>

        <AppButton
          style={[styles.modeChip, searchMode === "barcode" && styles.modeChipActive]}
          onPress={() => changeSearchMode("barcode")}
        >
          <Text
            style={[
              styles.modeChipText,
              searchMode === "barcode" && styles.modeChipTextActive,
            ]}
          >
            Barcode
          </Text>
        </AppButton>
      </View>

      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {!catalogoFiltratoDaPagina ? (
            <AppButton
              style={[styles.chip, !categoria && styles.chipActive]}
              onPress={() => cambiaCategoria(null)}
              testID="chip-tutti"
            >
              <Text style={[styles.chipTxt, !categoria && styles.chipTxtActive]}>
                TUTTI
              </Text>
            </AppButton>
          ) : null}

          {cats.map((c) => (
            <AppButton
              key={c}
              style={[styles.chip, categoria === c && styles.chipActive]}
              onPress={() => cambiaCategoria(c)}
              testID={`chip-${c}`}
            >
              <Text style={[styles.chipTxt, categoria === c && styles.chipTxtActive]}>
                {c.toUpperCase()}
              </Text>
            </AppButton>
          ))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Caricamento prodotti...</Text>
        </View>
      ) : (
        <FlatList
          key={`catalogo-${categoria ?? "tutti"}-${marcaStandard ?? "tutte-marche"}-${soloSottoScorta}-${soloVendita}`}
          ref={listaRef}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              const safeIndex = Math.max(0, Math.min(info.index, items.length - 1));
              listaRef.current?.scrollToOffset({
                offset: Math.max(0, info.averageItemLength * safeIndex - 80),
                animated: false,
              });
            }, 500);
          }}
          data={items}
          numColumns={2}
          keyExtractor={(it, index) => `${getProductId(it)}-${index}`}
          renderItem={renderCard}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={30}
          windowSize={5}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.7}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ padding: 16 }} />
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Nessun prodotto trovato</Text>
                <Text style={styles.emptyText}>
                  Cambia ricerca o filtri per visualizzare altri prodotti.
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
        />
      )}

      <Modal
        visible={filtersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filtersPanel}>
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>Filtri</Text>
              <AppButton onPress={() => setFiltersOpen(false)}>
                <Text style={styles.closeText}>CHIUDI</Text>
              </AppButton>
            </View>

            <ScrollView
              style={styles.filtersScroll}
              contentContainerStyle={styles.filtersScrollContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >

            <AppButton
              style={[
                styles.priceToggle,
                (brandFilterOpen || marcaStandard) && styles.completeToggleActive,
              ]}
              onPress={() => setBrandFilterOpen((prev) => !prev)}
            >
              <Text
                style={[
                  styles.priceToggleText,
                  (brandFilterOpen || marcaStandard) && styles.completeToggleTextActive,
                ]}
              >
                Marca: {marcaStandard || "Tutte"} {brandFilterOpen ? "▲" : "▼"}
              </Text>
            </AppButton>

            {brandFilterOpen ? (
              <>
                <Text style={styles.filterLabel}>Cerca marca</Text>

                <TextInput
                  value={brandSearch}
                  onChangeText={setBrandSearch}
                  placeholder="Scrivi marca..."
                  placeholderTextColor={COLORS.muted}
                  style={styles.brandSearch}
                />

                <Text style={styles.filterLabel}>Seleziona marca</Text>

                <ScrollView
                  style={[styles.brandList, styles.brandListExpanded]}
                  nestedScrollEnabled
                >
                  {filteredBrands.map((m) => {
                    const active =
                      (!marcaStandard && m === "Tutte") || marcaStandard === m;

                    return (
                      <AppButton
                        key={m}
                        style={[styles.brandRow, active && styles.brandRowActive]}
                        onPress={() => cambiaMarca(m)}
                      >
                        <Text
                          style={[
                            styles.brandText,
                            active && styles.brandTextActive,
                          ]}
                        >
                          {m}
                        </Text>
                      </AppButton>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <AppButton
              style={[
                styles.completeToggle,
                filtroDaCompletare && styles.completeToggleActive,
              ]}
              onPress={() => setFiltroDaCompletare((prev) => !prev)}
            >
              <Text
                style={[
                  styles.completeToggleText,
                  filtroDaCompletare && styles.completeToggleTextActive,
                ]}
              >
                {'"Da completare"'}
              </Text>
            </AppButton>

            <AppButton
              style={[
                styles.priceToggle,
                (priceFilterOpen || filtroPrezzoAttivo) && styles.completeToggleActive,
              ]}
              onPress={() => setPriceFilterOpen((prev) => !prev)}
            >
              <Text
                style={[
                  styles.priceToggleText,
                  (priceFilterOpen || filtroPrezzoAttivo) && styles.completeToggleTextActive,
                ]}
              >
                Filtro prezzo {priceFilterOpen ? "▲" : "▼"}
              </Text>
            </AppButton>

            {priceFilterOpen ? (
              <View style={styles.priceBox}>
                <Text style={styles.filterLabel}>Prezzo minimo</Text>
                <TextInput
                  value={String(prezzoMin)}
                  onChangeText={(v) => setPrezzoMin(Number(v.replace(",", ".")) || 0)}
                  keyboardType="numeric"
                  style={styles.priceInput}
                />

                <Text style={styles.filterLabel}>Prezzo massimo</Text>
                <TextInput
                  value={String(prezzoMax)}
                  onChangeText={(v) => setPrezzoMax(Number(v.replace(",", ".")) || 0)}
                  keyboardType="numeric"
                  style={styles.priceInput}
                />

                <AppButton
                  style={[
                    styles.applyPrice,
                    filtroPrezzoAttivo && styles.applyPriceActive,
                  ]}
                  onPress={() => setFiltroPrezzoAttivo((prev) => !prev)}
                >
                  <Text
                    style={[
                      styles.applyPriceText,
                      filtroPrezzoAttivo && styles.applyPriceTextActive,
                    ]}
                  >
                    {filtroPrezzoAttivo ? "DISATTIVA PREZZO" : "ATTIVA PREZZO"}
                  </Text>
                </AppButton>
              </View>
            ) : null}

            <AppButton
              style={styles.resetButton}
              onPress={() => {
                setMarcaStandard(null);
                setBrandSearch("");
                setBrandFilterOpen(false);
                setFiltroPrezzoAttivo(false);
                setPrezzoMin(0);
                setPrezzoMax(1000);
                setFiltersOpen(false);
                setFiltroDaCompletare(false);
              }}
            >
              <Text style={styles.resetButtonText}>RESET FILTRI</Text>
            </AppButton>
            </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: "700",
  },

  filterButton: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },

  filterButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.6,
  },

  searchBox: {
    marginHorizontal: 18,
    marginBottom: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 14,
  },

  searchInput: {
    height: 48,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  searchModeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
  },

  modeChip: {
    backgroundColor: COLORS.chip,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  modeChipActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },

  modeChipText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 11,
  },

  modeChipTextActive: {
    color: COLORS.white,
  },

  chipsWrap: {
    marginBottom: 8,
  },

  chipsContent: {
    paddingHorizontal: 18,
    gap: 8,
  },

  chip: {
    backgroundColor: COLORS.chip,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  chipActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },

  chipTxt: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 0.5,
  },

  chipTxtActive: {
    color: COLORS.white,
  },

  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.muted,
    fontWeight: "700",
  },

  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },

  columnWrapper: {
    gap: 10,
  },

  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
  },

  cardImgWrap: {
    height: 110,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },

  cardImg: {
    width: "100%",
    height: "100%",
  },

  placeholderImg: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEAE0",
  },

  placeholderText: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
  },

  cardBody: {
    padding: 10,
  },

  cardBrand: {
    fontSize: 10,
    color: COLORS.orange,
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.text,
    minHeight: 48,
    lineHeight: 16,
  },

  cardCode: {
    marginTop: 5,
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "700",
  },

  cardCategory: {
    marginTop: 3,
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "700",
  },

  cardBottom: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  price: {
    color: COLORS.greenDark,
    fontSize: 17,
    fontWeight: "900",
  },

  pricePromo: {
    color: COLORS.red,
  },

  promoBadge: {
    marginTop: 2,
    fontSize: 9,
    color: COLORS.red,
    fontWeight: "900",
  },

  qtyBox: {
    backgroundColor: "#EFE5D6",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },

  qty: {
    color: COLORS.greenDark,
    fontSize: 10,
    fontWeight: "900",
  },

  qtyLow: {
    color: COLORS.red,
  },

  addButton: {
    marginTop: 9,
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
  },

  addButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "900",
  },

  emptyBox: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  filtersPanel: {
    maxHeight: "90%",
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
  },

  filtersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  filtersTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
  },

  closeText: {
    color: COLORS.red,
    fontWeight: "900",
  },

  filterLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 8,
  },

  brandSearch: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    color: COLORS.text,
    fontWeight: "700",
  },

  brandList: {
    marginTop: 10,
    maxHeight: 220,
  },

  brandRow: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  brandRowActive: {
    backgroundColor: COLORS.green,
  },

  brandText: {
    fontWeight: "800",
    color: COLORS.text,
  },

  brandTextActive: {
    color: COLORS.white,
  },
  
  completeToggle: {
    marginTop: 14,
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  completeToggleActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },

  completeToggleText: {
    color: COLORS.text,
    fontWeight: "900",
  },

  completeToggleTextActive: {
    color: COLORS.white,
  },

  priceToggle: {
    marginTop: 14,
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },

  priceToggleText: {
    color: COLORS.text,
    fontWeight: "900",
  },

  priceBox: {
    marginTop: 10,
  },

  priceInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontWeight: "700",
  },

  applyPrice: {
    marginTop: 12,
    backgroundColor: COLORS.chip,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 10,
  },

  applyPriceActive: {
    backgroundColor: COLORS.green,
  },

  applyPriceText: {
    color: COLORS.text,
    fontWeight: "900",
  },

  applyPriceTextActive: {
    color: COLORS.white,
  },

  resetButton: {
    marginTop: 16,
    backgroundColor: COLORS.red,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },

  resetButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  brandListExpanded: {
    maxHeight: 260,
    marginTop: 6,
    marginBottom: 14,
  },

  filtersScroll: {
    width: "100%",
  },

  filtersScrollContent: {
    paddingBottom: 34,
  },

});
