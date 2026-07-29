import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '@/src/theme';

import AppButton from '@/src/components/AppButton';
export default function PromoScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppButton style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← INDIETRO</Text>
        </AppButton>

        <Text style={styles.kicker}>FERRAMENTA LOPERFIDO</Text>
        <Text style={styles.title}>PROMO</Text>

        <Text style={styles.subtitle}>
          Offerte, occasioni e prodotti in promozione disponibili in ferramenta.
        </Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>PRODOTTI IN PROMO</Text>

          <Text style={styles.boxText}>
            Questa sarà la pagina dedicata alle promozioni. Qui poi mostreremo i prodotti con promozione attiva.
          </Text>

          <AppButton
            style={styles.catalogBtn}
            onPress={() =>
  router.push({
    pathname: '/catalogo',
    params: { categoria: 'Promo' },
  } as any)
}
          >
            <Text style={styles.catalogBtnText}>APRI CATALOGO</Text>
          </AppButton>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: 18, paddingBottom: 40 },
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
    fontSize: 38,
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
  box: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 18,
  },
  boxTitle: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    letterSpacing: 2,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 8,
  },
  boxText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 18,
  },
  catalogBtn: {
    minHeight: 52,
    backgroundColor: COLORS.brand,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    letterSpacing: 2,
    color: COLORS.surface,
    fontWeight: '900',
  },
});