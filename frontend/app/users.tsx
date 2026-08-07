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
import { Scheda } from '@/src/components/Scheda';

import AppButton, { TESTO_BOTTONE } from '@/src/components/AppButton';
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

            <AppButton
              variante="pieno"
              style={styles.newButton}
              onPress={() => router.push('/user-detail')}
            >
              <Text style={TESTO_BOTTONE.pieno}>+ Nuovo utente</Text>
            </AppButton>
          </>
        }
        renderItem={({ item }) => (
          <AppButton
            style={styles.cardWrap}
            onPress={() =>
              router.push({
                pathname: '/user-detail',
                params: { id: item.id },
              })
            }
          >
            <Scheda>
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
                      color: item.attivo ? COLORS.success : COLORS.error,
                    },
                  ]}
                >
                  {item.attivo ? '● Attivo' : '● Disattivato'}
                </Text>
              </View>
            </Scheda>
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
    marginBottom: 20,
  },
  cardWrap: {
    marginBottom: 14,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
  },
  username: {
    color: COLORS.onSurfaceSecondary,
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
