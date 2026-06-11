import { View, Text, StyleSheet, ViewStyle } from 'react-native';

import { COLORS, FONTS } from '@/src/theme';

export function ScreenHeader({ title, subtitle, right, style }: { title: string; subtitle?: string; right?: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} testID="screen-title">{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    gap: 12,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  sub: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.onSurfaceSecondary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
