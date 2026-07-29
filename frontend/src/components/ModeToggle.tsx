import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS, FONTS } from '@/src/theme';
import { useAppStore } from '@/src/store';

import AppButton from '@/src/components/AppButton';
export function ModeToggle() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  return (
    <View style={styles.wrap} testID="mode-toggle">
      <AppButton
        style={[styles.btn, mode === 'gestore' && styles.btnActive]}
        onPress={() => setMode('gestore')}
        testID="mode-gestore-btn"
      >
        <Feather name="tool" size={14} color={mode === 'gestore' ? COLORS.onBrandPrimary : COLORS.onSurfaceSecondary} />
        <Text style={[styles.txt, mode === 'gestore' && styles.txtActive]}>GESTORE</Text>
      </AppButton>
      <AppButton
        style={[styles.btn, mode === 'cliente' && styles.btnActive]}
        onPress={() => setMode('cliente')}
        testID="mode-cliente-btn"
      >
        <Feather name="user" size={14} color={mode === 'cliente' ? COLORS.onBrandPrimary : COLORS.onSurfaceSecondary} />
        <Text style={[styles.txt, mode === 'cliente' && styles.txtActive]}>CLIENTE</Text>
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnActive: { backgroundColor: COLORS.brand },
  txt: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.onSurfaceSecondary,
    fontWeight: '700',
  },
  txtActive: { color: COLORS.onBrandPrimary },
});
