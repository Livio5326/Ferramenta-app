import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '@/src/theme';

import AppButton from '@/src/components/AppButton';
export default function BackButton() {
  return (
    <AppButton
      style={styles.container}
      onPress={() => router.back()}
    >
      <Feather
        name="arrow-left"
        size={30}
        color={COLORS.brand}
      />
    </AppButton>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 0
  },
  text: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.brand,
  },
});
