import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS, FONTS } from '@/src/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  style?: ViewStyle;
};

export function ScreenHeader({ title, subtitle, right, style }: ScreenHeaderProps) {
  if (title === 'FERRAMENTA') {
    return (
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
    );
  }

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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    gap: 12,
  },

  homeWrap: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },

  homeLogo: {
    width: '95%',
    height: 90,
    marginBottom: 18,
  },

  homeAddress: {
    width: '100%',
    fontFamily: FONTS.mono,
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.onSurface,
    textAlign: 'center',
    marginBottom: 18,
  },

  homeToggle: {
    width: '100%',
    alignItems: 'flex-end',
  },

  title: {
    fontFamily: FONTS.display,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },

  sub: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.onSurface,
    opacity: 0.75,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
});