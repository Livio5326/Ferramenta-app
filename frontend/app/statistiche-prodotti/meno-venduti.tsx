import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '@/src/theme';

export default function MenoVendutiScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← INDIETRO</Text>
        </Pressable>

        <Text style={styles.kicker}>STATISTICHE PRODOTTI</Text>
        <Text style={styles.title}>MENO VENDUTI</Text>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>DA COLLEGARE ALLE VENDITE</Text>
          <Text style={styles.boxText}>
            Qui mostreremo i prodotti fermi o venduti pochissimo.
          </Text>
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
    fontSize: 34,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 20,
  },
  box: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 18,
  },
  boxTitle: {
    fontFamily: FONTS.mono,
    fontSize: 15,
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
  },
});