import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '@/src/theme';

import AppButton from '@/src/components/AppButton';
import { leggiAuthToken } from '@/src/api';
import { BACKEND_URL } from '@/src/config/backend';
type ProdottoRichiesto = {
  id?: string;
  descrizione?: string;
  nome?: string;
  foto?: string;
  codice_prodotto?: string;
  marca_standard?: string;
  marca?: string;
  prezzo_vendita?: number;
  prezzo_promo?: number;
  promo_attiva?: boolean;
  quantita_venduta?: number;
  totale_venduto?: number;
};

const API_BASE = BACKEND_URL;

export default function PiuRichiestiScreen() {
  const router = useRouter();

  const [prodotti, setProdotti] = useState<ProdottoRichiesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    caricaProdotti();
  }, []);

  async function caricaProdotti() {
    try {
      setLoading(true);
      setErrore('');

      const token = await leggiAuthToken();
      const res = await fetch(`${API_BASE}/api/stats/best-sellers?limit=20`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        throw new Error('Errore nel caricamento dei prodotti più richiesti');
      }

      const data = await res.json();
      setProdotti(Array.isArray(data) ? data : []);
    } catch {
      setErrore('Impossibile caricare i prodotti più richiesti.');
      setProdotti([]);
    } finally {
      setLoading(false);
    }
  }

  function prezzoDaMostrare(p: ProdottoRichiesto) {
    if (p.promo_attiva && p.prezzo_promo) {
      return p.prezzo_promo;
    }

    return p.prezzo_vendita;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppButton style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← INDIETRO</Text>
        </AppButton>

        <Text style={styles.kicker}>FERRAMENTA LOPERFIDO</Text>
        <Text style={styles.title}>I PIÙ RICHIESTI</Text>

        <Text style={styles.subtitle}>
          I prodotti più venduti vengono calcolati automaticamente dalle vendite registrate.
        </Text>

        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator />
            <Text style={styles.stateText}>Caricamento prodotti...</Text>
          </View>
        )}

        {!loading && errore !== '' && (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{errore}</Text>

            <AppButton style={styles.reloadBtn} onPress={caricaProdotti}>
              <Text style={styles.reloadTxt}>RIPROVA</Text>
            </AppButton>
          </View>
        )}

        {!loading && errore === '' && prodotti.length === 0 && (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>NESSUN PRODOTTO ANCORA</Text>
            <Text style={styles.stateText}>
              Quando registrerai vendite dall’app, qui compariranno automaticamente i prodotti più venduti.
            </Text>
          </View>
        )}

        {!loading && errore === '' && prodotti.map((p, index) => {
          const prezzo = prezzoDaMostrare(p);

          return (
            <AppButton
  key={p.id || String(index)}
  style={styles.productCard}
  onPress={() => {
    if (p.id) {
      router.push(`/product/${p.id}` as any);
    }
  }}
>
              <View style={styles.rankBox}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>

              <View style={styles.productInfo}>
                <Text style={styles.productTitle}>
                  {p.descrizione || p.nome || 'Prodotto senza descrizione'}
                </Text>

                <Text style={styles.productMeta}>
                  {p.marca_standard || p.marca || 'Marca non indicata'}
                </Text>

                {!!p.codice_prodotto && (
                  <Text style={styles.productCode}>
                    Codice: {p.codice_prodotto}
                  </Text>
                )}

                <View style={styles.row}>
                  <Text style={styles.soldText}>
                    Venduti: {p.quantita_venduta || 0}
                  </Text>

                  {typeof prezzo === 'number' && (
                    <Text style={styles.priceText}>
                      € {prezzo.toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            </AppButton>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  content: {
    padding: 18,
    paddingBottom: 40,
  },

  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
  },

  backTxt: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.onSurface,
    fontWeight: '800',
  },

  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 3,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 8,
  },

  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 10,
  },

  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 22,
  },

  stateBox: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 18,
    gap: 12,
  },

  stateTitle: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    letterSpacing: 2,
    color: COLORS.onSurface,
    fontWeight: '900',
  },

  stateText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.onSurfaceSecondary,
  },

  errorText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.error,
    fontWeight: '800',
  },

  reloadBtn: {
    minHeight: 48,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reloadTxt: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 2,
    color: COLORS.surface,
    fontWeight: '900',
  },

  productCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
  },

  rankBox: {
    width: 42,
    height: 42,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },

  rankText: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: COLORS.onSurface,
    fontWeight: '900',
  },

  productInfo: {
    flex: 1,
  },

  productTitle: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 8,
  },

  productMeta: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 4,
  },

  productCode: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  soldText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.onSurface,
    fontWeight: '800',
  },

  priceText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.onSurface,
    fontWeight: '900',
  },
  imageBox: {
  width: 78,
  height: 78,
  borderWidth: 2,
  borderColor: COLORS.borderStrong,
  backgroundColor: COLORS.surface,
  alignItems: 'center',
  justifyContent: 'center',
},

productImage: {
  width: '100%',
  height: '100%',
},

noImageText: {
  fontFamily: FONTS.mono,
  fontSize: 9,
  color: COLORS.onSurfaceSecondary,
  fontWeight: '800',
},
});
