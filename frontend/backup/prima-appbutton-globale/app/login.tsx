import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { PasswordInput } from '@/src/components/PasswordInput';
import { useAuth } from '@/src/auth';
import { COLORS, FONTS } from '@/src/theme';

const CREDENTIALS_KEY = 'ferramenta_saved_credentials';
const LAST_USERNAME_KEY = 'ferramenta_last_username';

type CredenzialeSalvata = {
  username: string;
  password: string;
};

type CredenzialiSalvate = Record<string, CredenzialeSalvata>;

const normalizzaUsername = (username: string) =>
  username.trim().toLowerCase();

export default function LoginScreen() {
  const { login, user, loading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardKey, setKeyboardKey] = useState(0);  
  const [rememberPassword, setRememberPassword] = useState(false);
  const [savedCredentials, setSavedCredentials] =
    useState<CredenzialiSalvate>({});
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);

  const versioneApp = Constants.expoConfig?.version ?? '1.0.0';

  useEffect(() => {
    const caricaCredenziali = async () => {
      try {
        const credenzialiJson = await SecureStore.getItemAsync(
          CREDENTIALS_KEY
        );

        const ultimoUsername = await SecureStore.getItemAsync(
          LAST_USERNAME_KEY
        ); 
 
        if (!credenzialiJson) {
          return;
        }

        const credenziali: CredenzialiSalvate =
          JSON.parse(credenzialiJson);
 
        setSavedCredentials(credenziali);

        if (ultimoUsername) {
          const credenziale =
            credenziali[normalizzaUsername(ultimoUsername)];

          if (credenziale) {
            setUsername(credenziale.username);
            setPassword(credenziale.password);
            setRememberPassword(true);
          }
        }
      } catch (error) {
        console.error(
          'Errore durante il caricamento delle credenziali:',
          error
        );
      } finally {
        setCredentialsLoaded(true);
      }
    };

    caricaCredenziali();
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/(tabs)');
    }
  }, [authLoading, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        Keyboard.dismiss();
        return;
      }

      setTimeout(() => {
        setKeyboardKey(value => value + 1);
      }, 150);
    });

    return () => subscription.remove();
  }, []);

  const handleUsernameChange = (value: string) => {
    setUsername(value);

    const chiaveUsername = normalizzaUsername(value);
    const credenziale = savedCredentials[chiaveUsername];

    if (credenziale) {
      setPassword(credenziale.password);
      setRememberPassword(true);
    } else {
      setPassword('');
      setRememberPassword(false);
    }
  };

  const handleLogin = async () => {
    const usernamePulito = username.trim();

    if (!usernamePulito || !password) {
      Alert.alert('Dati mancanti', 'Inserisci username e password.');
      return;
    }

    try {
      setLoading(true);

      await login(usernamePulito, password);
  
      const chiaveUsername = normalizzaUsername(usernamePulito);

      if (rememberPassword) {
        const nuoveCredenziali: CredenzialiSalvate = {
          ...savedCredentials,
          [chiaveUsername]: {
            username: usernamePulito,
            password,
          },
        };

        await SecureStore.setItemAsync(
          CREDENTIALS_KEY,
          JSON.stringify(nuoveCredenziali)
        );

        await SecureStore.setItemAsync(
          LAST_USERNAME_KEY,
          usernamePulito
        );

        setSavedCredentials(nuoveCredenziali); 
      } else {
        const nuoveCredenziali = { ...savedCredentials };

        delete nuoveCredenziali[chiaveUsername];

        if (Object.keys(nuoveCredenziali).length > 0) {
          await SecureStore.setItemAsync(
            CREDENTIALS_KEY,
            JSON.stringify(nuoveCredenziali)
          );
        } else {
          await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
        }

        const ultimoUsername = await SecureStore.getItemAsync(
          LAST_USERNAME_KEY
        );

        if (
          ultimoUsername &&
          normalizzaUsername(ultimoUsername) === chiaveUsername
        ) {
          await SecureStore.deleteItemAsync(LAST_USERNAME_KEY);
        }

        setSavedCredentials(nuoveCredenziali); 
      }

      router.replace('/(tabs)');

    } catch (error) {
      const messaggio =
        error instanceof Error && error.message.includes('401')
          ? 'Username o password errati.'
          : 'Impossibile effettuare il login. Controlla la connessione al server.';

      Alert.alert('Accesso non riuscito', messaggio);
    } finally {
      setLoading(false);
    }
  };

  const tornaCliente = () => {
    router.replace('/(tabs)');
  };

  if (authLoading || ! credentialsLoaded || user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      key={keyboardKey}
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          contentFit="contain"
        />

        <View style={styles.card}>
          <Text style={styles.title}>Accesso gestionale</Text>

          <Text style={styles.subtitle}>
            Inserisci le credenziali per accedere.
          </Text>

          <TextInput
            value={username}
            onChangeText={handleUsernameChange}
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="next"
            style={styles.input}
          />

          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            editable={!loading}
            onSubmitEditing={handleLogin}
            containerStyle={styles.passwordInput}
          />

          <Pressable
            style={styles.rememberRow}
            onPress={() =>
              setRememberPassword(value => !value)
            }
            disabled={loading}
          >
            <View
              style={[
                styles.checkbox,
                rememberPassword && styles.checkboxSelected,
              ]}
            >
              {rememberPassword && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>

            <Text style={styles.rememberText}>
              Ricorda username e password
            </Text>
          </Pressable>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && !loading && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>ACCEDI</Text>
            )}
          </Pressable>

          <Pressable
            onPress={tornaCliente}
            disabled={loading}
            style={({ pressed }) => [
              styles.clientButton,
              pressed && !loading && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.clientButtonText}>ENTRA NELL’APP CLIENTE</Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>
          Versione {versioneApp}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },

  logo: {
    width: '100%',
    height: 150,
    marginBottom: 24,
  },

  card: {
    borderRadius: 18,
    padding: 24,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  title: {
    fontFamily: FONTS.mono,
    fontSize: 24,
    fontWeight: '800',
    color: '#263B2B',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: '#5F665F',
    textAlign: 'center',
    marginBottom: 26,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D6D8D6',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 14,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },

  passwordInput: {
    marginBottom: 18,
  },

  loginButton: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brand,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.mono,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },

  clientButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263B2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: '#FFFFFF',
  },

  clientButtonText: {
    color: '#263B2B',
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  versionText: {
    marginTop: 20,
    textAlign: 'center',
    color: '#7B817C',
    fontSize: 12,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  buttonDisabled: {
    opacity: 0.6,
  },
 
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 20,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#8A908B',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },

  checkboxSelected: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brand,
  },

  checkmark: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18, 
  },

  rememberText: {
    color: '#4F5751',
    fontSize: 14,
  },
});
