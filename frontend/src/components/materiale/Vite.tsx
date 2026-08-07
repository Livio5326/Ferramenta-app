import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { PALETTE } from '@/src/theme';

// La vite d'acciaio. Sull'insegna vera ce ne sono due per asse, agli estremi.
// Il sito usa una luce circolare per darle volume; React Native non ce l'ha
// senza librerie, quindi qui è acciaio pieno con il taglio inciso. A dieci
// pixel la differenza non si vede.

export function Vite({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.vite, style]} pointerEvents="none">
      <View style={styles.taglio} />
    </View>
  );
}

const styles = StyleSheet.create({
  vite: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.acciaio,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.acciaioBordo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglio: {
    width: 6,
    height: 1.5,
    backgroundColor: PALETTE.acciaioTaglio,
    transform: [{ rotate: '-28deg' }],
  },
});
