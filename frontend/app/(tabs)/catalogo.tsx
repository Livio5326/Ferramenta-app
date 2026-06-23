import { useRef } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, FlatList, Pressable, ScrollView, ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { COLORS, FONTS, fmtEUR } from '@/src/theme';
import { api } from '@/src/api';
import { Product, useAppStore } from '@/src/store';
import Slider from '@react-native-community/slider';

function prezzoFinaleProdotto(p: any): number {
  const prezzoPromo = Number(p?.prezzo_promo || 0);
  if (p?.promo_attiva && prezzoPromo > 0) return prezzoPromo;
  return Number(p?.prezzo_vendita || 0);
}

function haPromoProdotto(p: any): boolean {
  return Boolean(p?.promo_attiva && Number(p?.prezzo_promo || 0) > 0);
}

const CATEGORIE_STANDARD = [
  'Utensili manuali',
  'Strumenti di misura',
  'Utensili a filo',
  'Utensili a batteria',
  'Accessori',
  'Portautensili',
  'Ferramenta',
  'Fissaggio',
  'Giardinaggio',
  'Vernici',
  'Idraulica',
  'Elettrico',
  'Antinfortunistica',
  'Auto',
  'Casa',
  'Chiavi',
  'Altro',
];


function testoProdottoFiltro(p: any) {
  return [
    p.descrizione,
    p.nome,
    p.categoria,
    p.marca,
    p.fornitore,
    p.note,
    p.codice_prodotto,
    p.barcode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}


const MARCHE_STANDARD = [
  'STANLEY',
  'BLACK+DECKER',
  'DEWALT',
  'BOSCH',
  'MAKITA',
  'MILWAUKEE',
  'METABO',
  'HIKOKI',
  'RYOBI',
  'EINHELL',
  'DREMEL',
  'FESTOOL',
  'FEIN',
  'AEG',
  'SKIL',
  'PARKSIDE',
  'WERA',
  'KNIPEX',
  'USAG',
  'BETA',
  'FACOM',
  'IRWIN',
  'BAHCO',
  'GEDORE',
  'WIHA',
  'HAZET',
  'RUBI',
  'VALEX',
  'FERVI',
  'KRINO',
  'MAURER',
  'MUNDIAL',
  'NORTON',
  'TYROLIT',
  'SAIT',
  'RHODIUS',
  'ABRACUT',
  'FISCHER',
  'SPIT',
  'HILTI',
  'WURTH',
  'RAWLPLUG',
  'PATTEX',
  'BOSTIK',
  'SARATOGA',
  'MAPEI',
  'SIKA',
  'LOCTITE',
  'AREXONS',
  'SVITOL',
  'WD-40',
  'TANGIT',
  'MAXMEYER',
  'BOERO',
  'DUCO',
  'TIXE',
  'SAYERLACK',
  'V33',
  'OSRAM',
  'VIMAR',
  'BTICINO',
  'LEGRAND',
  'GEWISS',
  'AVE',
  'PHILIPS',
  'BEGHELLI',
  'LIFE',
  'FANTON',
  '3M',
  'SINGER SAFETY',
  'DELTA PLUS',
  'DIADORA',
  'U-POWER',
  'BASE',
  'COFRA',
  'PORTWEST',
  'CISA',
  'YALE',
  'VIRO',
  'ISEO',
  'MOTTURA',
  'PREFER',
  'ABUS',
  'MASTER LOCK',
  'SECUREMME',
  'GROHE',
  'FAR',
  'GEBERIT',
  'CALEFFI',
  'FERRARI',
  'TECE',
  'GARDENA',
  'CLABER',
  'FISKARS',
  'STIHL',
  'HUSQVARNA',
  'AL-KO',
  'GIMI',
  'VILEDA',
  'FARAONE',
  'SICOS',
  'MELICONI',
  'PAPILLON',
  'AMBROVIT',
  'ALTRO',
];

function categoriaStandardDaImportata(p: any): string {
  const standard = String(p.categoria_standard || '').trim();

  if (standard) {
    return standard;
  }

  const categoriaImportata = String(p.categoria || '').toLowerCase();
  const marca = String(p.marca || '').toLowerCase();
  const fornitore = String(p.fornitore || '').toLowerCase();
  const descrizione = String(p.descrizione || '').toLowerCase();
  const note = String(p.note || '').toLowerCase();
  const codice = String(p.codice_prodotto || '').toUpperCase();

  const testo = `${categoriaImportata} ${descrizione} ${note} ${codice}`;

  const haWattaggio = /\b\d{2,4}\s*(w|watt|watts)\b/.test(testo);
  const haBatteria =
    testo.includes('batteria') ||
    testo.includes('batterie') ||
    testo.includes('cordless') ||
    testo.includes('18v') ||
    testo.includes('20v') ||
    testo.includes('12v') ||
    testo.includes('54v') ||
    testo.includes('v20') ||
    testo.includes('li-ion') ||
    testo.includes('litio');

  if (categoriaImportata.includes('portautensili')) return 'Portautensili';
  if (categoriaImportata.includes('strumenti di misura') || categoriaImportata.includes('strumentazione elettronica')) return 'Strumenti di misura';
  if (categoriaImportata.includes('utensileria manuale') || categoriaImportata.includes('utensileria meccanica')) return 'Utensili manuali';
  if (categoriaImportata.includes('giardino') || categoriaImportata.includes('gamma giardino')) return 'Giardinaggio';
  if (categoriaImportata.includes('batterie e caricabatterie')) return 'Accessori';
  if (categoriaImportata.includes('cura della casa')) return 'Casa';

  if (categoriaImportata.includes('elettroutensili a batteria')) return 'Utensili a batteria';
  if (categoriaImportata.includes('elettroutensili a filo')) return 'Utensili a filo';

  if (categoriaImportata.includes('elettroutensili')) {
    if (haBatteria && !haWattaggio) return 'Utensili a batteria';
    return 'Utensili a filo';
  }

  if (categoriaImportata.includes('accessori')) {
    if (codice.startsWith('FME') || codice.startsWith('SFME') || codice.startsWith('SFMEE') || codice.startsWith('SM') || codice.startsWith('FMEG')) {
      return 'Utensili a filo';
    }

    if (codice.startsWith('SFMC') || codice.startsWith('SCMW') || codice.startsWith('SFMCMW') || codice.startsWith('SCOEP')) {
      if (testo.includes('rasaerba') || testo.includes('giardino') || testo.includes('taglia')) {
        return 'Giardinaggio';
      }

      return 'Utensili a batteria';
    }

    return 'Accessori';
  }

  if (categoriaImportata.includes('fissaggio')) return 'Fissaggio';
  if (categoriaImportata.includes('vernici') || categoriaImportata.includes('pittura')) return 'Vernici';
  if (categoriaImportata.includes('idraulica')) return 'Idraulica';
  if (categoriaImportata.includes('elettrico')) return 'Elettrico';
  if (categoriaImportata.includes('antinfortunistica') || categoriaImportata.includes('dpi')) return 'Antinfortunistica';
  if (categoriaImportata.includes('auto')) return 'Auto';
  if (categoriaImportata.includes('casa')) return 'Casa';

  if (marca.includes('black') || fornitore.includes('black')) {
    if (haBatteria && !haWattaggio) return 'Utensili a batteria';
    if (haWattaggio || categoriaImportata.includes('elettroutensili')) return 'Utensili a filo';
  }

  return 'Altro';
}

function prodottoInCategoriaStandard(p: any, categoria: string) {
  return categoriaStandardDaImportata(p) === categoria;
}
 const PAGE_SIZE = 30;
 
export default function Catalogo() {
  const router = useRouter();
  const params = useLocalSearchParams();


const categoriaParam = params.categoria;

const categoriaDaPagina = Array.isArray(categoriaParam)
  ? categoriaParam[0]
  : typeof categoriaParam === 'string'
    ? categoriaParam
    : '';

const catalogoFiltratoDaPagina = categoriaDaPagina.length > 0;

  const soloSottoScorta = params.sotto_scorta === 'true';
  const soloVendita = params.vendita === 'true';
  const mode = useAppStore((s) => s.mode);
  const addToCart = useAppStore((s) => s.addToCart);
  const isCliente = mode === 'cliente';

  const [q, setQ] = useState('');
  const [searchMode, setSearchMode] = useState<'descrizione' | 'codice' | 'barcode'>('descrizione');
  const [categoria, setCategoria] = useState<string | null>(null);
  useEffect(() => {
  if (!categoriaDaPagina) return;

  setCategoria(categoriaDaPagina as any);
  setQ('');
}, [categoriaDaPagina]);
  const [marcaStandard, setMarcaStandard] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandsReali, setBrandsReali] = useState<string[]>([]);
  const [filtroPrezzoAttivo, setFiltroPrezzoAttivo] = useState(false);
  const [prezzoMin, setPrezzoMin] = useState(0);
  const [prezzoMax, setPrezzoMax] = useState(1000);
  const cats = catalogoFiltratoDaPagina 
  ? [categoriaDaPagina]
  : CATEGORIE_STANDARD;
  const brands = brandsReali.length > 0 ? brandsReali : MARCHE_STANDARD;
  const filteredBrands = brands.filter((m) => m.toLowerCase().includes(brandSearch.trim().toLowerCase()));

  useEffect(() => {
    let alive = true;

    api.listStandardBrands()
      .then((res) => {
        if (!alive) return;
        setBrandsReali(res.items || []);
      })
      .catch((err) => {
        console.warn('Errore caricamento marche standard', err);
      });

    return () => {
      alive = false;
    };
  }, []);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const richiestaCatalogoRef = useRef(0);
  const listaRef = useRef<FlatList<Product>>(null);
  const cambiaCategoria = useCallback((nuovaCategoria: string | null) => {
    richiestaCatalogoRef.current += 1;
    setCategoria(nuovaCategoria);
}, []);


  const load = useCallback(async () => {
    const richiestaId = ++richiestaCatalogoRef.current;
    setLoading(true);
    try {
      const res = await api.listProductsPage({
        
        search_mode: searchMode,q: q || undefined,
        categoria: categoria || undefined,
        marca_standard: marcaStandard || undefined,
        prezzo_min: filtroPrezzoAttivo && (prezzoMin > 0 || prezzoMax < 1000) ? prezzoMin : undefined,
        prezzo_max: filtroPrezzoAttivo && (prezzoMin > 0 || prezzoMax < 1000) ? prezzoMax : undefined,
        sotto_scorta: soloSottoScorta || undefined,
        vendibile: soloVendita || undefined,
        limit: PAGE_SIZE,
        skip: 0,
      });
      const data = res.items;
      setHasMore(Boolean(res.has_more));
      if (richiestaId !== richiestaCatalogoRef.current) return;
      const prodottiVisibili = soloVendita
        ? data.filter((p) => Number(p.quantita ?? 0) > 0)
        : data;
    setTimeout(() => {
        // listaRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 50);

      setItems( soloSottoScorta
    ? [...prodottiVisibili].sort((a, b) => {
        const urgenzaA = (a.quantita ?? 0) / Math.max(a.soglia_scorta ?? 1, 1);
        const urgenzaB = (b.quantita ?? 0) / Math.max(b.soglia_scorta ?? 1, 1);

        if (urgenzaA !== urgenzaB) return urgenzaA - urgenzaB;
        return (a.quantita ?? 0) - (b.quantita ?? 0);
      })
    : [...prodottiVisibili].sort((a, b) => {
              const dispA = Number(a.quantita ?? 0) > 0 ? 0 : 1;
              const dispB = Number(b.quantita ?? 0) > 0 ? 0 : 1;
              if (dispA !== dispB) return dispA - dispB;

              const marca = String(a.marca ?? "").localeCompare(String(b.marca ?? ""), "it");
              if (marca !== 0) return marca;

              const descrizione = String(a.descrizione ?? "").localeCompare(String(b.descrizione ?? ""), "it");
              if (descrizione !== 0) return descrizione;

              return String(a.codice_prodotto ?? "").localeCompare(String(b.codice_prodotto ?? ""), "it");
            })
   );
    } catch (e) {
      console.warn(e);
    } finally {
      if (richiestaId === richiestaCatalogoRef.current) {
        setLoading(false);
      }
    }
  }, [q, categoria, marcaStandard, filtroPrezzoAttivo, prezzoMin, prezzoMax, soloSottoScorta, soloVendita]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || !hasMore) return;

    setLoadingMore(true);
    try {
      const res = await api.listProductsPage({
        
        search_mode: searchMode,q: q || undefined,
        categoria: categoria || undefined,
        marca_standard: marcaStandard || undefined,
        sotto_scorta: soloSottoScorta || undefined,
        prezzo_min: filtroPrezzoAttivo && (prezzoMin > 0 || prezzoMax < 1000) ? prezzoMin : undefined,
        prezzo_max: filtroPrezzoAttivo && (prezzoMin > 0 || prezzoMax < 1000) ? prezzoMax : undefined,
        vendibile: soloVendita || undefined,
        limit: PAGE_SIZE,
        skip: items.length,
      });

      const data = res.items;
      const prodottiVisibili = soloVendita
        ? data.filter((p) => Number(p.quantita ?? 0) > 0)
        : data;

      setItems((prev) => [...prev, ...prodottiVisibili]);
      setHasMore(Boolean(res.has_more));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, refreshing, hasMore, q, categoria, marcaStandard, soloSottoScorta, soloVendita, items.length]);

  const renderCard = ({ item }: { item: Product }) => {
    const low = item.quantita <= item.soglia_scorta;
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/product/${item.id}`)}
        testID={`product-card-${item.id}`}
      >
        <View style={styles.cardImgWrap}>
          {item.foto ? (
<Image
  source={{
    uri: String(item.foto).startsWith('http') || String(item.foto).startsWith('data:')
      ? item.foto
      : ((process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '') + '/uploads/cropped/' + item.foto),
  }}
  style={styles.cardImg}
  contentFit="contain"
/>
          ) : (
            <View style={styles.cardPlaceholder}>
              <Feather name="package" size={32} color={COLORS.brandTertiary} />
            </View>
          )}
          {low && !isCliente && (
            <View style={styles.lowBadge}>
              <Text style={styles.lowBadgeText}>LOW</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
  <Text style={styles.cardBrand}>{item.marca || '-'}</Text>

  <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
    {item.descrizione}
  </Text>

  {!!item.codice_prodotto && (
    <Text style={styles.cardSub} numberOfLines={1} ellipsizeMode="tail">
      {item.codice_prodotto}
    </Text>
  )}
</View> 

           <View style={styles.cardFoot}>
           <Text style={styles.cardPrice}>{fmtEUR(prezzoFinaleProdotto(item))}</Text>
            {!isCliente && Number(item.quantita ?? 0) > 0 && (
              <Text style={[styles.cardQty, low && { color: COLORS.error }]}>QTA {item.quantita}</Text>
            )}
          </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="catalogo-screen">
      <View style={styles.searchBar}>
        <Pressable
            style={styles.searchModeButton}
            onPress={() =>
              Alert.alert('Modalità ricerca', 'Scegli dove cercare il prodotto.', [
                { text: 'Descrizione', onPress: () => setSearchMode('descrizione') },
                { text: 'Codice prodotto', onPress: () => setSearchMode('codice') },
                { text: 'Codice a barre', onPress: () => setSearchMode('barcode') },
                { text: 'Annulla', style: 'cancel' },
              ])
            }
          >
            <Feather name="search" size={16} color={COLORS.surface} />
            <Text style={styles.searchModeButtonText}>
              {searchMode === 'codice' ? 'Cod.' : searchMode === 'barcode' ? 'Bar.' : 'Desc.'}
            </Text>
            <Feather name="chevron-down" size={13} color={COLORS.surface} />
          </Pressable>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Cerca" 
          placeholderTextColor={COLORS.onSurfaceSecondary}
          style={styles.searchInput}
          testID="search-input"
        />
        {searchMode === 'barcode' && (
          <Pressable
            onPress={() => router.push('/scanner')}
            testID="scan-btn"
            style={styles.scanBtn}
          >
            <Feather name="maximize" size={17} color="#FFFFFF" />
            <Text style={styles.scanBtnText}>Scan</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setFiltersOpen(true)} style={styles.filterIconBtn} testID="filters-btn">
          <Feather name="sliders" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
      {/* Category chips */}
      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
          {!catalogoFiltratoDaPagina && (
  <Pressable
    style={[styles.chip, !categoria && styles.chipActive]}
    onPress={() => cambiaCategoria(null)}
    testID="chip-tutti"
  >
    <Text style={[styles.chipTxt, !categoria && styles.chipTxtActive]}>
      
    </Text>
  </Pressable>
)}
          {cats.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, categoria === c && styles.chipActive]}
              onPress={() => cambiaCategoria(c)}
              testID={`chip-${c}`}
            >
              <Text style={[styles.chipTxt, categoria === c && styles.chipTxtActive]}>{c.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>
</View>

      <Modal
        visible={filtersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filtersPanel}>
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>FILTRI</Text>
              <Pressable onPress={() => setFiltersOpen(false)}>
                <Feather name="x" size={22} color={COLORS.onSurface} />
              </Pressable>
            </View>

            <Text style={styles.filterLabel}>CATEGORIA</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <Pressable
                style={[styles.chip, !categoria && styles.chipActive]}
                onPress={() => cambiaCategoria(null)}
              >
                <Text style={[styles.chipTxt, !categoria && styles.chipTxtActive]}>TUTTE</Text>
              </Pressable>

              {cats.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.chip, categoria === c && styles.chipActive]}
                  onPress={() => cambiaCategoria(c)}
                >
                  <Text style={[styles.chipTxt, categoria === c && styles.chipTxtActive]}>
                    {c.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>MARCA</Text>
            <View style={styles.brandSearchBox}>
              <Feather name="search" size={15} color={COLORS.onSurfaceSecondary} />
              <TextInput
                value={brandSearch}
                onChangeText={setBrandSearch}
                placeholder="Cerca marca..."
                placeholderTextColor={COLORS.onSurfaceSecondary}
                style={styles.brandSearchInput}
              />
              {brandSearch.length > 0 && (
                <Pressable onPress={() => setBrandSearch('')}>
                  <Feather name="x" size={16} color={COLORS.onSurfaceSecondary} />
                </Pressable>
              )}
            </View>
            <View style={styles.priceFilterBox}>
  <Pressable
    style={[
      styles.priceFilterToggle,
      filtroPrezzoAttivo && styles.priceFilterToggleActive,
    ]}
    onPress={() => setFiltroPrezzoAttivo(!filtroPrezzoAttivo)}
  >
    <Text
      style={[
        styles.priceFilterToggleText,
        filtroPrezzoAttivo && styles.priceFilterToggleTextActive,
      ]}
    >
      FILTRO PREZZO
    </Text>
  </Pressable>

  <Text style={styles.priceFilterTitle}>
    Da {prezzoMin} € a {prezzoMax} €
  </Text>

  <Text style={styles.priceFilterLabel}>Prezzo minimo</Text>
  <Slider
    minimumValue={0}
    maximumValue={1000}
    step={5}
    value={prezzoMin}
    onValueChange={(value) => {
      const nuovoMin = Math.min(value, prezzoMax);
      setPrezzoMin(nuovoMin);
    }}
  />

  <Text style={styles.priceFilterLabel}>Prezzo massimo</Text>
  <Slider
    minimumValue={0}
    maximumValue={1000}
    step={5}
    value={prezzoMax}
    onValueChange={(value) => {
      const nuovoMax = Math.max(value, prezzoMin);
      setPrezzoMax(nuovoMax);
    }}
  />

  <Pressable
    style={styles.priceFilterReset}
    onPress={() => {
      setFiltroPrezzoAttivo(false);
      setPrezzoMin(0);
      setPrezzoMax(1000);
    }}
  >
    <Text style={styles.priceFilterResetText}>RESET PREZZO</Text>
  </Pressable>
</View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <Pressable
                style={[styles.chip, !marcaStandard && styles.chipActive]}
                onPress={() => setMarcaStandard(null)}
              >
                <Text style={[styles.chipTxt, !marcaStandard && styles.chipTxtActive]}>
                  TUTTE MARCHE
                </Text>
              </Pressable>

              {filteredBrands.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.chip, marcaStandard === m && styles.chipActive]}
                  onPress={() => setMarcaStandard(m)}
                >
                  <Text style={[styles.chipTxt, marcaStandard === m && styles.chipTxtActive]}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.filterActions}>
              <Pressable
                style={styles.filterClearBtn}
                onPress={() => {
                  cambiaCategoria(null);
                  setMarcaStandard(null);
                  setBrandSearch('');
                }}
              >
                <Text style={styles.filterClearTxt}>RESET</Text>
              </Pressable>

              <Pressable
                style={styles.filterApplyBtn}
                onPress={() => setFiltersOpen(false)}
              >
                <Text style={styles.filterApplyTxt}>APPLICA</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.brand} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={48} color={COLORS.brandTertiary} />
          <Text style={styles.emptyText}>NESSUN PRODOTTO TROVATO</Text>
          {!isCliente && (
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/product/new')} testID="empty-add-btn">
              <Text style={styles.emptyBtnTxt}>+ AGGIUNGI PRODOTTO</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          key={`catalogo-${categoria ?? 'tutti'}-${marcaStandard ?? 'tutte-marche'}-${soloSottoScorta}-${soloVendita}-${q}`}
          ref={listaRef}
          refreshing={refreshing}
          onRefresh={onRefresh}
        
        
        
        
          data={items}
          numColumns={2}
          keyExtractor={(it, index) => `${it.id}-${index}`}
          renderItem={renderCard}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={30}
          windowSize={5}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={1.2}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} /> : null}
          contentContainerStyle={{ paddingBottom: 24 }}
          columnWrapperStyle={{ borderBottomWidth: 0 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  searchModeButton: {
    minWidth: 74,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    borderWidth: 1,
    borderColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    elevation: 4,
  },
  searchModeButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.surface,
    letterSpacing: 0.4,
  },
  scanBtn: {
    minWidth: 76,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#9B1C31',
    borderWidth: 0,
    borderColor: '#9B1C31',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginLeft: 0,
    paddingHorizontal: 10,
    elevation: 4,
  },
  scanBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    borderWidth: 1,
    borderColor: '#1B5E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    elevation: 4,
  },




  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
  },
  searchInput: { flex: 1, fontFamily: FONTS.mono, fontSize: 13, color: COLORS.onSurface, paddingVertical: 4 },
  chipsRow: { height: 56, borderBottomWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface, justifyContent: 'center' },
  chipsContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  chips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  chip: { height: 36, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface, flexShrink: 0 },
  chipActive: { backgroundColor: COLORS.surfaceInverse, borderColor: COLORS.surfaceInverse },
  chipTxt: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurface, letterSpacing: 1, fontWeight: '700' },
  chipTxtActive: { color: COLORS.onSurfaceInverse },
  card: {
    width: '50%',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
  },
  cardImgWrap: { width: '100%', aspectRatio: 1.25, backgroundColor: COLORS.surfaceSecondary, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  lowBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.error, paddingHorizontal: 6, paddingVertical: 2 },
  lowBadgeText: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onError, fontWeight: '900', letterSpacing: 1 },
  cardBody: { padding: 6, gap: 3 },
  cardBrand: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5, marginBottom: 2 },
  cardTitle: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.onSurface, fontWeight: '800', marginBottom: 4 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardSub: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.onSurfaceTertiary,
  },

  cardPrice: { fontFamily: FONTS.mono, fontSize: 13, textAlign: 'left', marginLeft: 6, fontWeight: '900', color: COLORS.brand },
  qtyBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 },
  qtyNumberBadge: { alignItems: 'center', justifyContent: 'center' },
qtyLabelSmall: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, fontWeight: '700' },
qtyValueBig: { fontFamily: FONTS.mono, fontSize: 18, lineHeight: 20, color: COLORS.onSurface, fontWeight: '900', transform: [{ scale: 1.12 }] },
  cardQty: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurface, fontWeight: '700' },
  cardQtyNumber: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurface, fontWeight: '700' },
  addBtn: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.brand, paddingVertical: 6 },
  addBtnTxt: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onBrandPrimary, fontWeight: '900', letterSpacing: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  emptyBtn: { borderWidth: 2, borderColor: COLORS.borderStrong, backgroundColor: COLORS.brand, paddingHorizontal: 18, paddingVertical: 12 },
  emptyBtnTxt: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.onBrandPrimary, fontWeight: '900', letterSpacing: 1 },
  filterIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    borderWidth: 1,
    borderColor: '#1B5E20',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
    elevation: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-start', paddingTop: 95, paddingHorizontal: 12 },
  filtersPanel: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.brand, borderRadius: 14, padding: 12, gap: 8 },
  filtersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  filtersTitle: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.onSurface, fontWeight: '900', letterSpacing: 1.5 },
filterLabel: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, marginTop: 6, marginBottom: 2, letterSpacing: 1.5 },
  filterActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  filterClearBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.brand, paddingVertical: 10, alignItems: 'center' },
  filterApplyBtn: { flex: 1, backgroundColor: COLORS.brand, paddingVertical: 10, alignItems: 'center' },
  filterClearTxt: { fontFamily: FONTS.mono, color: COLORS.brand, fontWeight: '800' },
  filterApplyTxt: { fontFamily: FONTS.mono, color: COLORS.surface, fontWeight: '800' },
  brandSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  brandSearchInput: { flex: 1, fontFamily: FONTS.mono, fontSize: 13, color: COLORS.onSurface, padding: 0 },

cardNote: {
  fontFamily: FONTS.mono,
  fontSize: 11,
  lineHeight: 16,
  color: COLORS.onSurfaceSecondary,
  marginTop: 6,
},

text: {
  fontFamily: FONTS.mono,
  fontSize: 14,
  color: COLORS.onSurface,
},

textMuted: {
  fontFamily: FONTS.mono,
  fontSize: 12,
  color: COLORS.onSurfaceSecondary,
},
priceFilterBox: {
  marginTop: 18,
  paddingTop: 16,
  borderTopWidth: 2,
  borderTopColor: COLORS.borderStrong,
},

priceFilterToggle: {
  borderWidth: 2,
  borderColor: COLORS.borderStrong,
  backgroundColor: COLORS.surface,
  paddingVertical: 12,
  paddingHorizontal: 14,
  alignItems: 'center',
  marginBottom: 14,
},

priceFilterToggleActive: {
  backgroundColor: COLORS.brand,
},

priceFilterToggleText: {
  fontFamily: FONTS.mono,
  fontSize: 13,
  color: COLORS.onSurface,
  fontWeight: '900',
  letterSpacing: 2,
},

priceFilterToggleTextActive: {
  color: COLORS.surface,
},

priceFilterTitle: {
  fontFamily: FONTS.mono,
  fontSize: 15,
  color: COLORS.onSurface,
  fontWeight: '900',
  marginBottom: 14,
},

priceFilterLabel: {
  fontFamily: FONTS.mono,
  fontSize: 12,
  color: COLORS.onSurfaceSecondary,
  fontWeight: '900',
  marginTop: 10,
  marginBottom: 4,
  letterSpacing: 1,
},

priceFilterReset: {
  marginTop: 14,
  borderWidth: 2,
  borderColor: COLORS.borderStrong,
  backgroundColor: COLORS.surfaceSecondary,
  paddingVertical: 10,
  alignItems: 'center',
},

priceFilterResetText: {
  fontFamily: FONTS.mono,
  fontSize: 12,
  color: COLORS.onSurface,
  fontWeight: '900',
  letterSpacing: 1,
},
});

