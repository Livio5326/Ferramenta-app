import {
  useCallback,
  useState } from 'react';
import { ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import { api, AuthUser } from '@/src/api';
import { COLORS } from '@/src/theme';
import BackButton from '@/src/components/BackButton';

import AppButton from '@/src/components/AppButton';
export default function UsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 },]}>
      <View style={{ marginLeft: 16 }}>
        <BackButton />
      </View>
 
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Gestione utenti</Text>

            <AppButton style={styles.newButton}
              onPress={() => router.push('/user-detail')}>
              <Text style={styles.newButtonText}>+ Nuovo utente</Text>
            </AppButton>
          </>
        }
        renderItem={({ item }) => (
          <AppButton style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/user-detail',
                params: { id: item.id },
              })
            }
          > 
            <Text style={styles.name}>
              {item.nome || item.username}
            </Text>

            <Text style={styles.username}>
              @{item.username}
            </Text>

            <View style={styles.row}>
              <Text style={styles.role}>
                {item.ruolo === 'amministratore'
                  ? 'Amministratore'
                  : 'Dipendente'}
              </Text>

              <Text
                style={[
                  styles.status,
                  {
                    color: item.attivo ? '#2E7D32' : '#C62828',
                  },
                ]}
              >
                {item.attivo ? '● Attivo' : '● Disattivato'}
              </Text>
            </View>
          </AppButton>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
  },
  newButton: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  newButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
  },
  username: {
    color: '#666',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  role: {
    fontWeight: '600',
  },
  status: {
    fontWeight: '700',
  },
});
