import {
  useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { PasswordInput } from '@/src/components/PasswordInput';
import { COLORS } from '@/src/theme';
import BackButton from '@/src/components/BackButton';

import AppButton, { TESTO_BOTTONE } from '@/src/components/AppButton';
export default function ChangePasswordScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const salva = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Attenzione', 'Compila tutti i campi.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Attenzione', 'Le nuove password non coincidono.');
      return;
    }

    try {
      setLoading(true);

      await api.changePassword(currentPassword, newPassword);

      Alert.alert('Operazione completata', 'Password aggiornata con successo.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      Alert.alert(
        'Errore',
        e?.message ?? 'Impossibile aggiornare la password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      <BackButton />

      <Text style={styles.title}>Cambio password</Text>

      <Text style={styles.label}>Nome utente</Text>

      <TextInput
        editable={false}
        value={user?.username ?? ''}
        style={styles.readOnly}
      />

      <Text style={styles.label}>Password attuale</Text>

      <PasswordInput
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Password attuale"
        editable={!loading}
        containerStyle={styles.field}
      />

      <Text style={styles.label}>Nuova password</Text>

      <PasswordInput
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="Nuova password"
        editable={!loading}
        containerStyle={styles.field}
      />

      <Text style={styles.label}>Conferma nuova password</Text>

      <PasswordInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Conferma nuova password"
        editable={!loading}
        containerStyle={styles.field}
      />

      <AppButton
        variante="pieno"
        style={styles.button}
        disabled={loading}
        onPress={salva}
      >
        <Text style={TESTO_BOTTONE.pieno}>
          AGGIORNA PASSWORD
        </Text>
      </AppButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  readOnly: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    backgroundColor: COLORS.surface,
  },
  field: {
    marginBottom: 8,
  },
  button: {
    marginTop: 28,
  },
});
