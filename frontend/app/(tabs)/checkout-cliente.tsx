import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '@/src/theme';
import { useClienteStore } from '@/src/clienteStore';

type TipoConsegna = 'ritiro' | 'spedizione';

export default function CheckoutClienteScreen() {
  const router = useRouter();
  const carrello = useClienteStore((state) => state.carrello);

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [tipoConsegna, setTipoConsegna] = useState<TipoConsegna>('ritiro');

  const [indirizzo, setIndirizzo] = useState('');
  const [citta, setCitta] = useState('');
  const [cap, setCap] = useState('');
  const [provincia, setProvincia] = useState('');

  const [intestatarioCarta, setIntestatarioCarta] = useState('');
  const [numeroCarta, setNumeroCarta] = useState('');
  const [scadenzaCarta, setScadenzaCarta] = useState('');
  const [cvv, setCvv] = useState('');

  const totale = useMemo(() => {
    return carrello.reduce((somma, item) => {
      return somma + Number(item.prezzo || 0) * Number(item.quantitaCarrello || 1);
    }, 0);
  }, [carrello]);

  const confermaPagamento = () => {
    if (carrello.length === 0) {
      Alert.alert('Carrello vuoto', 'Aggiungi almeno un prodotto prima di procedere.');
      return;
    }

    if (!nome.trim() || !telefono.trim()) {
      Alert.alert('Dati mancanti', 'Inserisci nome e telefono.');
      return;
    }

    if (tipoConsegna === 'spedizione' && (!indirizzo.trim() || !citta.trim() || !cap.trim())) {
      Alert.alert('Indirizzo mancante', 'Inserisci indirizzo, città e CAP per la spedizione.');
      return;
    }

    if (!intestatarioCarta.trim() || !numeroCarta.trim() || !scadenzaCarta.trim() || !cvv.trim()) {
      Alert.alert('Carta mancante', 'Inserisci i dati della carta per completare il pagamento.');
      return;
    }

    Alert.alert(
      'Pagamento da collegare',
      'Qui collegheremo il pagamento reale. Dopo il pagamento riuscito verrà creato l’ordine cliente.'
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>CLIENTE</Text>
        <Text style={styles.title}>CHECKOUT</Text>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>TOTALE CARRELLO</Text>
          <Text style={styles.totalValue}>€ {totale.toFixed(2).replace('.', ',')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATI CLIENTE</Text>

          <TextInput
            style={styles.input}
            placeholder="Nome e cognome"
            placeholderTextColor={COLORS.onSurfaceSecondary}
            value={nome}
            onChangeText={setNome}
          />

          <TextInput
            style={styles.input}
            placeholder="Telefono"
            placeholderTextColor={COLORS.onSurfaceSecondary}
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.onSurfaceSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONSEGNA</Text>

          <View style={styles.choiceRow}>
            <Pressable
              style={[styles.choiceButton, tipoConsegna === 'ritiro' && styles.choiceButtonActive]}
              onPress={() => setTipoConsegna('ritiro')}
            >
              <Text style={[styles.choiceText, tipoConsegna === 'ritiro' && styles.choiceTextActive]}>
                RITIRO IN NEGOZIO
              </Text>
            </Pressable>

            <Pressable
              style={[styles.choiceButton, tipoConsegna === 'spedizione' && styles.choiceButtonActive]}
              onPress={() => setTipoConsegna('spedizione')}
            >
              <Text style={[styles.choiceText, tipoConsegna === 'spedizione' && styles.choiceTextActive]}>
                SPEDIZIONE
              </Text>
            </Pressable>
          </View>

          {tipoConsegna === 'spedizione' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Indirizzo"
                placeholderTextColor={COLORS.onSurfaceSecondary}
                value={indirizzo}
                onChangeText={setIndirizzo}
              />

              <TextInput
                style={styles.input}
                placeholder="Città"
                placeholderTextColor={COLORS.onSurfaceSecondary}
                value={citta}
                onChangeText={setCitta}
              />

              <View style={styles.twoCols}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="CAP"
                  placeholderTextColor={COLORS.onSurfaceSecondary}
                  value={cap}
                  onChangeText={setCap}
                  keyboardType="number-pad"
                />

                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Provincia"
                  placeholderTextColor={COLORS.onSurfaceSecondary}
                  value={provincia}
                  onChangeText={setProvincia}
                  autoCapitalize="characters"
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAGAMENTO</Text>

          <TextInput
            style={styles.input}
            placeholder="Intestatario carta"
            placeholderTextColor={COLORS.onSurfaceSecondary}
            value={intestatarioCarta}
            onChangeText={setIntestatarioCarta}
          />

          <TextInput
            style={styles.input}
            placeholder="Numero carta"
            placeholderTextColor={COLORS.onSurfaceSecondary}
            value={numeroCarta}
            onChangeText={setNumeroCarta}
            keyboardType="number-pad"
          />

          <View style={styles.twoCols}>
            <TextInput
              style={[styles.input, styles.flexInput]}
              placeholder="MM/AA"
              placeholderTextColor={COLORS.onSurfaceSecondary}
              value={scadenzaCarta}
              onChangeText={setScadenzaCarta}
            />

            <TextInput
              style={[styles.input, styles.flexInput]}
              placeholder="CVV"
              placeholderTextColor={COLORS.onSurfaceSecondary}
              value={cvv}
              onChangeText={setCvv}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>

          <Text style={styles.note}>
            I dati carta sono provvisori per la schermata. Il pagamento reale verrà collegato a un servizio sicuro.
          </Text>
        </View>

        <Pressable style={styles.payButton} onPress={confermaPagamento}>
          <Text style={styles.payButtonText}>PAGA E CONFERMA ORDINE</Text>
        </Pressable>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>TORNA AL CARRELLO</Text>
        </Pressable>
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
  totalBox: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 18,
    marginBottom: 14,
  },
  totalLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 8,
  },
  totalValue: {
    fontFamily: FONTS.display,
    fontSize: 34,
    color: COLORS.onSurface,
    fontWeight: '900',
  },
  section: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    letterSpacing: 2,
    color: COLORS.onSurface,
    fontWeight: '900',
    marginBottom: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.onSurface,
  },
  twoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  flexInput: {
    flex: 1,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  choiceButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    alignItems: 'center',
  },
  choiceButtonActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  choiceText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.onSurface,
    fontWeight: '900',
    textAlign: 'center',
  },
  choiceTextActive: {
    color: COLORS.surface,
  },
  note: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.onSurfaceSecondary,
    marginTop: 2,
  },
  payButton: {
    borderWidth: 2,
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brand,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  payButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    letterSpacing: 2,
    color: COLORS.surface,
    fontWeight: '900',
    textAlign: 'center',
  },
  backButton: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 1,
    color: COLORS.onSurface,
    fontWeight: '900',
  },
});