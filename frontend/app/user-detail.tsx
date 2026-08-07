import {
  useEffect,
  useState } from 'react';
import { Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/src/api';
import { PasswordInput } from '@/src/components/PasswordInput';
import { COLORS } from '@/src/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '@/src/components/BackButton';

import AppButton, { TESTO_BOTTONE } from '@/src/components/AppButton';
export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const modifica = !!id;
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!id) return;
  
    api.getUser(String(id))
      .then((user) => {
        setNome(user.nome);
        setUsername(user.username);
        setRuolo(user.ruolo);
      })
      .catch((err) => {
        Alert.alert('Errore', err.message);
        router.back();
      });
  }, [id]);
  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [ruolo, setRuolo] = useState<'amministratore' | 'dipendente'>('dipendente');

  const salva = async () => {
    if (!nome.trim() || !username.trim() || (!modifica && !password)) {
      Alert.alert('Attenzione', 'Compila tutti i campi.');
      return;
    }

    if (!modifica && password !== conferma) {
      Alert.alert('Attenzione', 'Le password non coincidono.');
      return;
    }

    try {
      if (modifica) {
        await api.updateUser(String(id), {
          username,
          nome,
          ruolo,
          attivo: true,
        });
      } else {
        await api.createUser(
          username,
          password,
          nome,
          ruolo
        );
      }

      Alert.alert(
        'Operazione completata',
        modifica
          ? 'Utente aggiornato con successo.'
          : 'Utente creato con successo.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Errore', e.message);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top  }]}
      contentContainerStyle={styles.content}
    >
      <BackButton />
 
      <Text style={styles.title}>
        {modifica ? 'Modifica utente' : 'Nuovo utente'}
      </Text>      

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

      {!modifica ? (
        <>
          <Text style={styles.label}>Password</Text>

          <PasswordInput
            value={password}
            onChangeText={setPassword}
            containerStyle={styles.field}
          />

          <Text style={styles.label}>Conferma password</Text>

          <PasswordInput
            value={conferma}
            onChangeText={setConferma}
            containerStyle={styles.field}
          />
        </>
      ) : null}


      <Text style={styles.label}>Ruolo</Text>

      <View style={styles.row}>
        <AppButton
          style={[
            styles.role,
            ruolo === 'amministratore' && styles.roleSelected,
          ]}
          onPress={() => setRuolo('amministratore')}
        >
          <Text>Amministratore</Text>
        </AppButton>

        <AppButton
          style={[
            styles.role,
            ruolo === 'dipendente' && styles.roleSelected,
          ]}
          onPress={() => setRuolo('dipendente')}
        >
          <Text>Dipendente</Text>
        </AppButton>
      </View>

      <AppButton
        variante="pieno"
        style={styles.button}
        onPress={salva}
      >
        <Text style={TESTO_BOTTONE.pieno}>
          {modifica ? 'SALVA MODIFICHE' : 'CREA UTENTE'}
        </Text>
      </AppButton>
      {modifica && (
        <AppButton
          variante="pericolo"
          style={styles.deleteButton}
          onPress={() =>
            Alert.alert(
              'Elimina utente',
              'Sei sicuro di voler eliminare questo utente?',
              [
                {
                  text: 'Annulla',
                  style: 'cancel',
                },
                {
                  text: 'Elimina',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.deleteUser(String(id));
                      Alert.alert(
                        'Operazione completata',
                        'Utente eliminato.',
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
                  },
                },
              ],
            )
          }
        >
          <Text style={TESTO_BOTTONE.pericolo}>
            ELIMINA UTENTE
          </Text>
        </AppButton>
      )}
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
    marginBottom: 20,
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
  },
  field: {
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  role: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  roleSelected: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.successSurface,
  },
  button: {
    marginTop: 30,
  },
  deleteButton: {
    marginTop: 12,
  },
});
