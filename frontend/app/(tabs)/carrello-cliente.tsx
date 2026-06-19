import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '@/src/theme';
import { useClienteStore } from '@/src/clienteStore';

export default function CarrelloClienteScreen() {
  const carrello = useClienteStore((state) => state.carrello);
  const rimuoviCarrello = useClienteStore((state) => state.rimuoviCarrello);

  const totale = carrello.reduce((somma, item) => {
    return somma + Number(item.prezzo || 0) * Number(item.quantitaCarrello || 1);
  }, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>CLIENTE</Text>
        <Text style={styles.title}>CARRELLO</Text>

        {carrello.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>CARRELLO VUOTO</Text>
            <Text style={styles.emptyText}>
              I prodotti aggiunti dalla scheda prodotto compariranno qui.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {carrello.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.productTitle}>{item.descrizione}</Text>

                  {!!item.marca && (
                    <Text style={styles.productMeta}>{item.marca}</Text>
                  )}

                  {!!item.codice_prodotto && (
                    <Text style={styles.productCode}>
                      Codice: {item.codice_prodotto}
                    </Text>
                  )}

                  <View style={styles.row}>
                    <Text style={styles.qty}>
                      QTA {item.quantitaCarrello}
                    </Text>

                    <Text style={styles.price}>
                      € {Number(item.prezzo || 0).toFixed(2).replace('.', ',')}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.removeButton}
                    onPress={() => rimuoviCarrello(item.id)}
                  >
                    <Text style={styles.removeButtonText}>RIMUOVI</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>TOTALE</Text>
              <Text style={styles.totalValue}>
                € {totale.toFixed(2).replace('.', ',')}
              </Text>
            </View>

            <Pressable
              style={styles.buyButton}
              onPress={() =>
                Alert.alert(
                  'Acquista',
                  'Pagamento da collegare nel prossimo passaggio.'
                )
              }
            >
              <Text style={styles.buyButtonText}>ACQUISTA</Text>
            </Pressable>
          </>
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
    paddingBottom: 120,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  qty: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 1,
    color: COLORS.onSurface,
    fontWeight: '900',
  },
  price: {
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.onSurface,
    fontWeight: '900',
  },
  removeButton: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.onSurface,
    fontWeight: '900',
  },
  totalBox: {
    marginTop: 18,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 18,
  },
  totalLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 3,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 8,
  },
  totalValue: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.onSurface,
    fontWeight: '900',
  },
  buyButton: {
    marginTop: 14,
    borderWidth: 2,
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brand,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buyButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    letterSpacing: 2,
    color: COLORS.surface,
    fontWeight: '900',
  },
});