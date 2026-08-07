import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, FONTS, TESTO } from '@/src/theme';
import { Asse } from '@/src/components/materiale/Asse';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  style?: ViewStyle;
};

export function ScreenHeader({ title, subtitle, right, style }: ScreenHeaderProps) {
  if (title === 'FERRAMENTA') {
    return (
      <>
        <View style={[styles.homeWrap, style]}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.homeLogo}
            resizeMode="contain"
          />

          {subtitle ? (
            <Text style={styles.homeAddress}>{subtitle}</Text>
          ) : null}

          {right ? (
            <View style={styles.homeToggle}>
              {right}
            </View>
          ) : null}
        </View>
        <Asse style={styles.assettina} />
      </>
    );
  }

  return (
    <>
      <View style={[styles.wrap, style]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} testID="screen-title">{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>

        {right}
      </View>
      <Asse style={styles.assettina} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    gap: 12,
  },

  homeWrap: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },

  homeLogo: { width: '95%', height: 90, marginBottom: 18 },

  homeAddress: {
    width: '100%',
    ...TESTO.cassetto,
    fontSize: 13,
    lineHeight: 22,
    color: COLORS.onSurfaceSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },

  homeToggle: { width: '100%', alignItems: 'flex-end' },

  // Fraunces porta già il suo peso: niente fontWeight, su Android non
  // funziona con i caratteri personalizzati.
  title: {
    fontFamily: FONTS.displayForte,
    fontSize: 26,
    color: COLORS.onSurface,
    letterSpacing: -0.4,
    textTransform: 'none',
  },

  sub: {
    ...TESTO.cassetto,
    color: COLORS.onSurfaceSecondary,
    marginTop: 6,
  },

  // La striscia sotto l'intestazione e' legno, ma piatto: spegne l'ombra e
  // il bordo di luce che Asse porta con se', pensati per la tavola da 90
  // pixel del Task 4. Su tre pixel farebbero un gradino in rilievo invece
  // di un filo.
  assettina: {
    height: 3,
    width: '100%',
    borderRadius: 0,
    borderTopWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
});