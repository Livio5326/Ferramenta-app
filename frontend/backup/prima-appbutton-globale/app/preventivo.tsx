import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '@/src/theme';

export default function PreventivoScreen() {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [cellulare, setCellulare] = useState('');
  const [email, setEmail] = useState('');
  const [prodotti, setProdotti] = useState('');

  const handleInvia = () => {
    if (!nome.trim() || !cognome.trim() || !cellulare.trim() || !prodotti.trim()) {
      Alert.alert(
        'Dati mancanti',
        'Inserisci almeno nome, cognome, cellulare e prodotti di interesse.'
      );
      return;
    }

    Alert.alert(
      'Richiesta preventivo',
      'Richiesta compilata correttamente. Il prossimo passo sarà salvarla o inviarla al negozio.'
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>← INDIETRO</Text>
          </Pressable>

          <Text style={styles.kicker}>FERRAMENTA LOPERFIDO</Text>
          <Text style={styles.title}>RICHIEDI PREVENTIVO</Text>

          <Text style={styles.subtitle}>
            Compila i dati e indica i prodotti che ti interessano.
          </Text>

          <View style={styles.formBox}>
            <Text style={styles.label}>NOME</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Es. Mario"
              placeholderTextColor={COLORS.onSurfaceSecondary}
            />

            <Text style={styles.label}>COGNOME</Text>
            <TextInput
              style={styles.input}
              value={cognome}
              onChangeText={setCognome}
              placeholder="Es. Rossi"
              placeholderTextColor={COLORS.onSurfaceSecondary}
            />

            <Text style={styles.label}>CELLULARE</Text>
            <TextInput
              style={styles.input}
              value={cellulare}
              onChangeText={setCellulare}
              placeholder="Es. 3331234567"
              placeholderTextColor={COLORS.onSurfaceSecondary}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Es. cliente@email.it"
              placeholderTextColor={COLORS.onSurfaceSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>PRODOTTI DI INTERESSE</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={prodotti}
              onChangeText={setProdotti}
              placeholder="Scrivi qui i prodotti, quantità, misure o marche..."
              placeholderTextColor={COLORS.onSurfaceSecondary}
              multiline
              textAlignVertical="top"
            />

            <Pressable style={styles.submitBtn} onPress={handleInvia}>
              <Text style={styles.submitTxt}>INVIA RICHIESTA</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  flex: {
    flex: 1,
  },

  content: {
    padding: 18,
    paddingBottom: 40,
  },

  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
  },

  backTxt: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.onSurface,
    fontWeight: '800',
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
    marginBottom: 10,
  },

  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 22,
  },

  formBox: {
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSecondary,
    padding: 16,
  },

  label: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.onSurfaceSecondary,
    marginBottom: 8,
    marginTop: 12,
    fontWeight: '800',
  },

  input: {
    minHeight: 50,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    color: COLORS.onSurface,
    paddingHorizontal: 12,
    fontFamily: FONTS.mono,
    fontSize: 15,
  },

  textArea: {
    minHeight: 130,
    paddingTop: 12,
  },

  submitBtn: {
    marginTop: 22,
    minHeight: 56,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
  },

  submitTxt: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    letterSpacing: 2,
    color: COLORS.surface,
    fontWeight: '900',
  },
});