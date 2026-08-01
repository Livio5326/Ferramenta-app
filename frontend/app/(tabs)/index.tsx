import {
  useCallback,
  useEffect,
  useRef,
  useState } from 'react';
import { View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuth } from '@/src/auth';
import { COLORS, FONTS, fmtEUR } from '@/src/theme';
import { useAppStore } from '@/src/store';
import { api } from '@/src/api';

import AppButton from '@/src/components/AppButton';
const WOOD_BG = require('../../assets/images/wood-bg.jpg');

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const mode = useAppStore((s) => s.mode);
  const isCliente = mode === 'cliente';
  const getSaluto = () => {
  const ora = new Date().getHours();
  const nome = user?.username || '';

    if (ora < 6) {
      return `ANCORA SVEGLIO, ${nome}?`;
    }

    if (ora < 14) {
      return `BUONGIORNO, ${nome}`;
    }

    if (ora < 18) {
      return `BUON POMERIGGIO, ${nome}`;
    }

    return `BUONASERA, ${nome}`;
  };
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const requestInProgress = useRef(false);

  const load = useCallback(async () => {
    if (requestInProgress.current) {
      return;
    }

    requestInProgress.current = true;
    try {
      const data = await api.statistiche();
      setStats(data);
      setConsecutiveFailures(0);
      setBackendStatus('online');
    } catch (e) {
      setConsecutiveFailures((current) => {
        const next = current + 1;
        setBackendStatus(next >= 2 ? 'offline' : 'checking');
        return next;
      });
      console.warn("Errore caricamento dashboard", e);
    } finally {
      requestInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    if (consecutiveFailures === 0) {
      return;
    }

    const retryDelay = consecutiveFailures === 1 ? 2_500 : 5_000;
    const retryTimer = setTimeout(load, retryDelay);

    return () => clearTimeout(retryTimer);
  }, [consecutiveFailures, load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

return (
  <SafeAreaView style={styles.safe} edges={['top']} testID="dashboard-screen">

    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.brand}
        />
      }
    >

{/* Wood banner */}
<View style={styles.bannerWrap}>
  <Image source={WOOD_BG} style={styles.banner} contentFit="cover" />
  <View style={styles.bannerOverlay} />

          <AppButton
            style={styles.settingsBtn}
            onPress={() => router.push('/impostazioni' as any)}
            testID="settings-btn"
          >
            <Feather name="settings" size={22} color="#FFFFFF" />
          </AppButton>

  <View style={styles.bannerInner}>
    <Image
      source={require('../../assets/logo.png')}
      style={styles.bannerLogo}
      contentFit="contain"
    />
    <View style={styles.bannerToggle}>
      {isCliente ? (
        <AppButton
          style={styles.loginButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.loginButtonText}>ACCESSO GESTIONALE</Text>
        </AppButton>
      ) : (
        <View style={styles.loginButton}>
          <Text style={styles.loginButtonText}>
            {getSaluto()}
          </Text>
        </View>
      )}
    </View> 
    
  </View>
</View>
        {backendStatus === 'offline' && (
          <View style={styles.connectionError} testID="backend-offline-banner">
            <View style={styles.connectionErrorInfo}>
              <Feather name="wifi-off" size={24} color={COLORS.onError} />
              <View style={styles.connectionErrorCopy}>
                <Text style={styles.connectionErrorTitle}>GESTIONALE NON CONNESSO</Text>
                <Text style={styles.connectionErrorText}>
                  Controlla che il PC, Docker e il server di sviluppo siano accesi.
                </Text>
              </View>
            </View>
            <AppButton style={styles.connectionRetry} onPress={load} testID="backend-retry-button">
              <Feather name="refresh-cw" size={16} color={COLORS.error} />
              <Text style={styles.connectionRetryText}>RIPROVA</Text>
            </AppButton>
          </View>
        )}
        {/* Bento stats */}
        {!isCliente && (
          <View style={styles.bento}>
            <View style={[styles.bentoCard, styles.bentoCardLg]} testID="stat-valore">
              <Text style={styles.statLabel}>VALORE MAGAZZINO</Text>
              <Text style={styles.statValue}>{stats ? fmtEUR(stats.valore_magazzino || 0) : '—'}</Text>
              <Text style={styles.statFoot}>
                {stats ? `${stats.total_pieces || 0} PEZZI · ${stats.total_products || 0} REF` : 'DATI NON DISPONIBILI'}
              </Text>
            </View>
            <AppButton style={[styles.bentoCard, styles.bentoCardLg, { backgroundColor: stats?.sotto_scorta_count ? COLORS.error : COLORS.surfaceSecondary }]} onPress={()=> router.push('/catalogo?sotto_scorta=true')} testID="stat-scorta">

              <Text style={[styles.statValue, stats?.sotto_scorta_count && { color: COLORS.onError }]}>
                {stats ? stats.sotto_scorta_count || 0 : '—'}
              </Text>
              <Text style={[styles.statFoot, stats?.sotto_scorta_count && { color: COLORS.onError }]}>DA RIORDINARE</Text>
            </AppButton>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actionsGrid}>
          <AppButton style={styles.action} onPress={() => router.push('/scanner')} testID="action-scan">
            <Feather name="maximize" size={28} color={COLORS.onBrandPrimary} />
            <Text style={styles.actionText}>SCAN BARCODE</Text>
          </AppButton>
          <AppButton style={[styles.action, { backgroundColor: COLORS.surfaceInverse }]} onPress={() => router.push('/catalogo')} testID="action-catalog">
            <Feather name="package" size={28} color={COLORS.onSurfaceInverse} />
            <Text style={styles.actionText}>CATALOGO</Text>
          </AppButton>
          {!isCliente && (
            <>
              <AppButton style={[styles.action, { backgroundColor: COLORS.success }]} onPress={() => router.push('/vendita')} testID="action-vendita">
                <Feather name="shopping-cart" size={28} color={COLORS.onSuccess} />
                <Text style={styles.actionText}>VENDITA RAPIDA</Text>
              </AppButton>
              <AppButton style={[styles.action, { backgroundColor: COLORS.warning }]} onPress={() => router.push('/product/new')} testID="action-add">
                <Feather name="plus-square" size={28} color={COLORS.onWarning} />
                <Text style={styles.actionText}>NUOVO PRODOTTO</Text>
              </AppButton>
              <AppButton style={[styles.action, { backgroundColor: COLORS.brandSecondary }]} onPress={() => router.push('/import')} testID="action-import">
                <Feather name="upload" size={28} color={COLORS.onBrandSecondary} />
                <Text style={styles.actionText}>IMPORTA EXCEL</Text>
              </AppButton>
   <AppButton
  style={[styles.action, { backgroundColor: COLORS.brandTertiary }]}
  onPress={() => router.push('/statistiche-prodotti' as any )}
  testID="action-statistiche-prodotti"
>
  <Feather name="bar-chart-2" size={28} color={COLORS.onBrandTertiary} />
  <Text style={[styles.actionText, { color: COLORS.onBrandTertiary }]}>
    STATISTICHE PRODOTTI
  </Text>
</AppButton>
            </>
          )}
        </View>
{isCliente && (
  <View style={styles.clientHome}>
    <Text style={styles.clientSectionTitle}>REPARTI PRINCIPALI</Text>
<View style={styles.clientGrid}>
  {[
    {
      titolo: 'PROMO',
      descrizione: 'Offerte e occasioni',
      pagina: '/cliente/promo',
    },
    {
      titolo: 'I PIÙ RICHIESTI',
      descrizione: 'Articoli più cercati da voi',
      pagina: '/cliente/piu-richiesti',
    },
    {
      titolo: 'VERNICI',
      descrizione: 'Smalti, pitture, pennelli',
      pagina: '/cliente/vernici',
    },
    {
      titolo: 'GIARDINO',
      descrizione: 'Taglio, irrigazione, cura',
      pagina: '/cliente/giardino',
    },
    {
      titolo: 'UTENSILI',
      descrizione:'',
      pagina: '/cliente/utensili',
    },
    {
      titolo: 'IDRAULICA',
      descrizione: 'Raccordi, tubi, rubinetteria',
      pagina: '/cliente/idraulica',
    },
  ].map((item) => (
    <AppButton
      key={item.titolo}
      style={styles.clientTile}
      onPress={() => router.push(item.pagina as any)}
    >
      <Text style={styles.clientTileText}>{item.titolo}</Text>
      <Text style={styles.clientTileSub}>{item.descrizione}</Text>
    </AppButton>
  ))}
</View>

    <Text style={styles.clientSectionTitle}>SERVIZI</Text>

    <View style={styles.clientGrid}>
      <AppButton
        style={[styles.clientTile, styles.clientTileWide]}
        onPress={() => router.push('/preventivo')}
      >
        <Text style={styles.clientTileText}>RICHIEDI PREVENTIVO</Text>
        <Text style={styles.clientTileSub}>Scegli i prodotti dal catalogo</Text>
      </AppButton>

      <AppButton
        style={[styles.clientTile, styles.clientTileWide]}
        onPress={() => router.push('/catalogo')}
      >
        <Text style={styles.clientTileText}>CONTROLLA DISPONIBILITÀ</Text>
        <Text style={styles.clientTileSub}>Cerca articolo o barcode</Text>
      </AppButton>
    </View>
  </View>
)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modeToggleCenter: {
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 12,
  marginBottom: 18,
},
  safe: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 32 },
  connectionError: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 2,
    borderColor: COLORS.borderStrong,
  },
  connectionErrorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectionErrorCopy: { flex: 1 },
  connectionErrorTitle: {
    color: COLORS.onError,
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  connectionErrorText: {
    color: COLORS.onError,
    fontFamily: FONTS.display,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  connectionRetry: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: COLORS.onError,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectionRetryText: {
    color: COLORS.error,
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
bannerWrap: {
  height: 230,
  borderBottomWidth: 2,
  borderColor: COLORS.borderStrong,
  position: 'relative',
  overflow: 'hidden',
},

banner: {
  width: '100%',
  height: '100%',
},

bannerOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(44,34,27,0.45)',
},

bannerInner: {
  position: 'absolute',
  left: 12,
  right: 12,
  top: 0,
  bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  paddingTop: 8,
  paddingBottom: 54,
},

bannerLogo: {
  width: '118%',
  height: 200,
  transform: [{ translateY: 4}],
},

bannerAddress: {
  fontFamily: FONTS.mono,
  fontSize: 16,
  lineHeight: 22,
  color: COLORS.surface,
  textAlign: 'center',
  marginBottom: 14,
},

  settingsBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },


bannerToggle: {
  position: 'absolute',
  left: 12,
  right: 12,
  bottom: 16,
  alignItems: 'center',
  zIndex: 50,
},


loginButton: {
  minWidth: 210,
  backgroundColor: COLORS.brand,
  paddingHorizontal: 20,
  paddingVertical: 11,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#FFFFFF',
  alignItems: 'center',
},

loginButtonText: {
  color: '#FFFFFF',
  fontFamily: FONTS.mono,
  fontSize: 12,
  fontWeight: '800',
  letterSpacing: 1,
  textAlign: 'center',
},


  bento: { flexDirection: 'row', borderBottomWidth: 2, borderColor: COLORS.borderStrong },
  bentoCard: { flex: 1, padding: 16, backgroundColor: COLORS.surfaceSecondary, borderRightWidth: 2, borderColor: COLORS.borderStrong },
  bentoCardLg: { minHeight: 110 },
  statLabel: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5 },
  statValue: { fontFamily: FONTS.display, fontSize: 26, fontWeight: '900', color: COLORS.onSurface, marginTop: 8, letterSpacing: -0.5 },
  statFoot: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.onSurfaceSecondary, marginTop: 6, letterSpacing: 1 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  action: {
    width: '50%',
    minHeight: 100,
    backgroundColor: COLORS.brand,
    padding: 14,
    justifyContent: 'space-between',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.borderStrong,
  },
  actionText: { fontFamily: FONTS.mono, fontSize: 12, fontWeight: '700', color: COLORS.onBrandPrimary, letterSpacing: 1 },
  lowStockBlock: { padding: 16, gap: 8 },
  sectionTitle: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, letterSpacing: 1.5, marginBottom: 4 },
  lowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    gap: 12,
  },
  lowName: { fontFamily: FONTS.display, fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  lowMeta: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.onSurfaceSecondary, marginTop: 2 },
  qtyBadge: { backgroundColor: COLORS.error, paddingHorizontal: 10, paddingVertical: 6 },
  qtyBadgeText: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: '900', color: COLORS.onError },
  clientHome: {
  paddingHorizontal: 14,
  paddingTop: 18,
  paddingBottom: 28,
  backgroundColor: COLORS.surface,
},

clientSectionTitle: {
  fontFamily: FONTS.mono,
  fontSize: 13,
  letterSpacing: 3,
  color: COLORS.onSurfaceSecondary,
  marginBottom: 12,
  marginTop: 8,
},

clientGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  marginBottom: 18,
},

clientTile: {
  width: '48%',
  minHeight: 105,
  borderWidth: 2,
  borderColor: COLORS.borderStrong,
  backgroundColor: COLORS.surfaceSecondary,
  justifyContent: 'center',
  paddingHorizontal: 14,
  paddingVertical: 12,
},

clientTileWide: {
  width: '100%',
  minHeight: 82,
},

clientTileText: {
  fontFamily: FONTS.mono,
  fontSize: 15,
  letterSpacing: 2,
  color: COLORS.onSurface,
  fontWeight: '800',
},

clientTileSub: {
  fontFamily: FONTS.mono,
  fontSize: 11,
  lineHeight: 16,
  color: COLORS.onSurfaceSecondary,
  marginTop: 8,
},
});
