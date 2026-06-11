import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';

import { COLORS, FONTS } from '@/src/theme';
import { useAppStore } from '@/src/store';

export default function TabsLayout() {
  const mode = useAppStore((s) => s.mode);
  const isCliente = mode === 'cliente';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.onSurfaceSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 2,
          borderTopColor: COLORS.borderStrong,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catalogo',
          tabBarIcon: ({ color, size }) => <Feather name="package" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vendita"
        options={{
          title: 'Vendita',
          tabBarIcon: ({ color, size }) => <Feather name="shopping-cart" size={size} color={color} />,
          href: isCliente ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Statistiche',
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
          href: isCliente ? null : undefined,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -2, right: -10 },
});
