import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '@/src/components/BackButton';
import { useAuth } from '@/src/auth';
import { COLORS } from '@/src/theme';

import AppButton from '@/src/components/AppButton';
export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const iniziale = (user?.username?.[0] ?? '?').toUpperCase();

  return (
    <View style={styles.container}>
      <View
        style={{
          position: 'absolute',
          top: insets.top + 18,
          left: 16,
          zIndex: 10,
        }}
      >
        <BackButton />
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{iniziale}</Text>
      </View>

      <Text style={styles.username}>
        {user?.nome || user?.username}
      </Text>

      <Text style={styles.realUsername}>
        @{user?.username}
      </Text>

      <Text style={styles.role}>
        {user?.ruolo === 'amministratore'
          ? 'Amministratore'
          : 'Dipendente'}
      </Text>

      <AppButton style={styles.item}
        onPress={() => router.push('/edit-profile')}
      >
        <Feather
          name="edit-2"
          size={20}
          color={COLORS.brand}
        />

        <Text style={styles.itemText}>
          Modifica profilo
        </Text>

        <Feather
          name="chevron-right"
          size={18}
          color="#999"
        />
      </AppButton>

      <AppButton
        style={styles.item}
        onPress={() => router.push('/change-password')}
      >
        <Feather
          name="lock"
          size={20}
          color={COLORS.brand}
        />

        <Text style={styles.itemText}>
          Cambia password
        </Text>

        <Feather
          name="chevron-right"
          size={18}
          color="#999"
        />
      </AppButton>

      <AppButton
        style={styles.item}
        onPress={() =>
          Alert.alert(
            'Conferma uscita',
            'Esci dal profilo',
            [{
                text: 'No',
                style: 'cancel',
              }, {
                text: 'Si',
                style: 'destructive',
                onPress: async () => {
                  await logout();
                  router.dismissAll();
                  router.replace('/'); }, }, ], )}>

        <Feather
          name="log-out"
          size={20}
          color="#C0392B"
        />

        <Text
          style={[
            styles.itemText,
            { color: '#C0392B' },
          ]}
        >
          Esci
        </Text>
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 24,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.brand,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 34,
    fontWeight: '700',
  },
  realUsername: {
    textAlign: 'center',
    color: '#666',
    fontSize: 15,
    marginTop: 4,
  },
  username: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 18,
  },
  role: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 40,
    marginTop: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
