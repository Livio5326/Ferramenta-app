import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '@/src/theme';

import AppButton from '@/src/components/AppButton';
export default function StatisticheProdottiScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppButton style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← INDIETRO</Text>
        </AppButton>

        <Text style={styles.kicker}>GESTIONE MAGAZZINO</Text>
        <Text style={styles.title}>STATISTICHE PRODOTTI</Text>

        <Text style={styles.subtitle}>
          Analizza quali prodotti girano di più e quali restano fermi in magazzino.
        </Text>

        <View style={styles.grid}>
          <AppButton
            style={styles.card}
            onPress={() => router.push('/statistiche-prodotti/piu-venduti')}
          >
            <Text style={styles.cardTitle}>PIÙ VENDUTI</Text>
            <Text style={styles.cardSub}>
              Prodotti con più vendite registrate.
            </Text>
          </AppButton>

          <AppButton
            style={styles.card}
            onPress={() => router.push('/statistiche-prodotti/meno-venduti')}
          >
            <Text style={styles.cardTitle}>MENO VENDUTI</Text>
            <Text style={styles.cardSub}>
              Prodotti fermi o con poche vendite.
            </Text>
          </AppButton>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>A COSA SERVE</Text>
          <Text style={styles.noteText}>
            Questa sezione ti aiuta a capire cosa riordinare, cosa spingere in vendita
            e cosa occupa spazio inutilmente in magazzino.
          </Text>
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

  grid: {
    gap: 14,
  },

  card: {
    minHeight: 120,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 18,
    justifyContent: 'center',
  },

  cardTitle: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    letterSpacing: 3,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 10,
  },

  cardSub: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.onSurfaceSecondary,
  },

  noteBox: {
    marginTop: 22,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    padding: 16,
  },

  noteTitle: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 2,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 8,
  },

  noteText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.onSurfaceSecondary,
  },
});