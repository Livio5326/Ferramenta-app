import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS, FONTS } from '@/src/theme';

export default function FornitoriScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Feather name="truck" size={42} color={COLORS.brand} />
        </View>

        <Text style={styles.title}>FORNITORI</Text>
        <Text style={styles.subtitle}>
          Qui verrà gestita la lista dei fornitori, grossisti e cataloghi.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  iconBox: {
    width: 86,
    height: 86,
    borderWidth: 1,
    borderColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
});
