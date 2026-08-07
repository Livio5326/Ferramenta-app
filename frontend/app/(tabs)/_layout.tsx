import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';

import { COLORS, FONTS, PALETTE } from '@/src/theme';
import { useAppStore } from '@/src/store';

export default function TabsLayout() {
  const mode = useAppStore((s) => s.mode);
  const isCliente = mode === 'cliente';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: COLORS.warning,
        tabBarInactiveTintColor: PALETTE.carta3,

        tabBarStyle: {
          backgroundColor: PALETTE.verdeScuro,
          borderTopWidth: 2,
          borderTopColor: COLORS.brandPrimary,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingTop: 3,
          paddingBottom: Platform.OS === 'ios' ? 24 : 9,
          elevation: 10,
          shadowColor: PALETTE.noce3,
          shadowOpacity: 0.16,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -3 },
        },

        tabBarLabelStyle: {
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: 0.9,
          textTransform: 'uppercase',
        },

        tabBarIconStyle: {
          marginBottom: 0,
        },

        tabBarItemStyle: {
          paddingVertical: 0,
          transform: [{ translateY: 0 }],
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
        name="catalogo-vendita"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
  name="lista-desideri-cliente"
  options={{
    title: 'Desideri',
    href: isCliente ? undefined : null,
    tabBarIcon: ({ color, size }) => (
      <Feather name="heart" size={size} color={color} />
    ),
  }}
/>

<Tabs.Screen
  name="carrello-cliente"
  options={{
    title: 'Carrello',
    href: isCliente ? undefined : null,
    tabBarIcon: ({ color, size }) => (
      <Feather name="shopping-cart" size={size} color={color} />
    ),
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
        name="fornitori"
        options={{
          title: 'Fornitori',
          href: isCliente ? null : undefined,
          tabBarIcon: ({ color, size }) => <Feather name="truck" size={size} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="statistiche"
        options={{
          title: 'Statistiche',
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />,
          href: isCliente ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="checkout-cliente"
        options={{
          href: null,
        }}
      />
      </Tabs>
      );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -2, right: -10 },
});
