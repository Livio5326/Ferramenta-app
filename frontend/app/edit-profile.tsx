import {
  useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { COLORS } from '@/src/theme';
import BackButton from '@/src/components/BackButton';

import AppButton, { TESTO_BOTTONE } from '@/src/components/AppButton';
export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [nome, setNome] = useState(user?.nome ?? '');
  const [username, setUsername] = useState(user?.username ?? '');

  const salva = async () => {
    try {
      await api.updateProfile(nome, username);

      await refreshUser();

      Alert.alert(
        'Operazione completata',
        'Profilo aggiornato.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('Errore', e.message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top - 15 }]}>
      <BackButton />

      <Text style={styles.title}>Profilo Utente</Text>      
      <Text style={styles.label}>Nome e cognome</Text>

      <TextInput
        style={styles.input}
        value={nome}
        onChangeText={setNome}
      />

      <Text style={styles.label}>Username</Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

      <AppButton
        variante="pieno"
        style={styles.button}
        onPress={salva}
      >
        <Text style={TESTO_BOTTONE.pieno}>
          SALVA
        </Text>
      </AppButton>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: COLORS.surface,
  },
  label: {
    marginTop: 16,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
  },
  button: {
    marginTop: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,},
});
