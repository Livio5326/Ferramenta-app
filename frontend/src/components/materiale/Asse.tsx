import type { ReactNode } from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PALETTE, RADIUS, VENATURA, VENATURA_TAPPE } from '@/src/theme';
import { Vite } from './Vite';
import { Filetto } from './Filetto';

// L'asse di legno: il modulo che ricorre in tutto il sito, tradotto in
// React Native. Il sito ci mette sopra una grana di rumore in sovrapposizione
// che qui non è riproducibile: questa versione è a sole sfumature, quindi un
// po' più pulita e uniforme. Somiglia, non è identica.

type Props = {
  style?: StyleProp<ViewStyle>;
  viti?: boolean;
  filetto?: boolean;
  testID?: string;
  children?: ReactNode;
};

export function Asse({ style, viti = false, filetto = false, testID, children }: Props) {
  return (
    <LinearGradient
      colors={VENATURA}
      locations={VENATURA_TAPPE}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.asse, style]}
      testID={testID}
    >
      {children}
      {filetto && <Filetto />}
      {viti && (
        <>
          <Vite style={{ top: 6, left: 6 }} />
          <Vite style={{ top: 6, right: 6 }} />
          <Vite style={{ bottom: 6, left: 6 }} />
          <Vite style={{ bottom: 6, right: 6 }} />
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  asse: {
    borderRadius: RADIUS.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 224, 195, 0.55)',
    shadowColor: PALETTE.noce3,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
