import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@/src/theme';
import { useClienteStore } from '@/src/clienteStore';
import { Image } from 'expo-image';

const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

function getFotoUrl(foto?: string) {
  if (!foto) return null;

  if (foto.startsWith('http')) {
    return foto;
  }

  const nomeFile = foto.replace(/^\/+/, '');

  if (nomeFile.startsWith('uploads/')) {
    return `${BACKEND_URL}/${nomeFile}`;
  }

  return `${BACKEND_URL}/uploads/cropped/${nomeFile}`;
}

export default function ListaDesideriClienteScreen() {
  const listaDesideri = useClienteStore((state) => state.listaDesideri);
  const rimuoviDesideri = useClienteStore((state) => state.rimuoviDesideri);
  const aggiungiCarrello = useClienteStore((state) => state.aggiungiCarrello);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>CLIENTE</Text>
        <Text style={styles.title}>LISTA DESIDERI</Text>

        {listaDesideri.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>NESSUN PRODOTTO SALVATO</Text>
            <Text style={styles.emptyText}>
              I prodotti aggiunti dalla scheda prodotto compariranno qui.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {listaDesideri.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.imageBox}>
  {getFotoUrl(item.foto) ? (
    <Image
      source={{ uri: getFotoUrl(item.foto)! }}
      style={styles.productImage}
      contentFit="contain"
    />
  ) : (
    <Text style={styles.noImageText}>NO FOTO</Text>
  )}
</View>
                <Text style={styles.productTitle}>{item.descrizione}</Text>

                {!!item.marca && (
                  <Text style={styles.productMeta}>{item.marca}</Text>
                )}

                {!!item.codice_prodotto && (
                  <Text style={styles.productCode}>
                    Codice: {item.codice_prodotto}
                  </Text>
                )}

                <Text style={styles.price}>
                  € {Number(item.prezzo || 0).toFixed(2).replace('.', ',')}
                </Text>

                <View style={styles.actions}>
                  <Pressable
  style={styles.cartButton}
  onPress={() => {
    aggiungiCarrello(item, item.quantitaCarrello || 1);

    Alert.alert(
      'Carrello',
      'Prodotto aggiunto al carrello'
    );
  }}
>
  <Text style={styles.cartButtonText}>AGGIUNGI AL CARRELLO</Text>
</Pressable>
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => rimuoviDesideri(item.id)}
                  >
                    <Text style={styles.removeButtonText}>RIMUOVI</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  content: {
    padding: 18,
    paddingBottom: 110,
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 3,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 18,
  },
  emptyBox: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 18,
  },
  emptyTitle: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    letterSpacing: 2,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.onSurfaceSecondary,
  },
  list: {
    gap: 14,
  },
  card: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 16,
  },
  productTitle: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 8,
  },
  productMeta: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 6,
  },
  productCode: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 10,
  },
  price: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cartButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brand,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cartButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.surface,
    fontWeight: '900',
    textAlign: 'center',
  },
  removeButton: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  removeButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.onSurface,
    fontWeight: '900',
  },
  imageBox: {
  width: '100%',
  height: 130,
  borderWidth: 2,
  borderColor: COLORS.borderStrong,
  backgroundColor: COLORS.surface,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 14,
},

productImage: {
  width: '100%',
  height: '100%',
},

noImageText: {
  fontFamily: FONTS.mono,
  fontSize: 11,
  color: COLORS.onSurfaceSecondary,
  fontWeight: '900',
},
});