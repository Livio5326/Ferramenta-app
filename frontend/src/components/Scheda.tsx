import type { ReactNode } from 'react';
import { StyleSheet, StyleProp, View, ViewStyle } from 'react-native';

import { COLORS, OMBRE, RADIUS, SPACING } from '@/src/theme';

// La scheda ricorrente: prodotti, fornitori, righe di lista. Prima di questo
// componente ogni schermata si inventava la propria, ed erano tutte diverse
// di qualche pixel.

type Props = {
  variante?: 'carta' | 'noce';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function Scheda({ variante = 'carta', style, children }: Props) {
  return <View style={[styles.base, styles[variante], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    ...OMBRE.scheda,
  },
  carta: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  noce: {
    backgroundColor: COLORS.surfaceInverse,
    borderColor: COLORS.brandSecondary,
  },
});
