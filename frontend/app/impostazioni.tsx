import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/src/theme';

export default function ImpostazioniScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={COLORS.onSurface} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>IMPOSTAZIONI</Text>
            <Text style={styles.subtitle}>Gestione preferenze e strumenti app.</Text>
          </View>
        </View>

        <Pressable
          style={styles.optionCard}
          onPress={() => router.push('/impostazioni/sinonimi-ricerca' as any)}
        >
          <View style={styles.optionIcon}>
            <Feather name="search" size={22} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Sinonimi ricerca</Text>
            <Text style={styles.optionText}>
              Aggiungi parole alternative per trovare meglio i prodotti nel Catalogo.
            </Text>
          </View>

          <Feather name="chevron-right" size={22} color={COLORS.onSurfaceSecondary} />
        </Pressable>

        <Pressable
          style={styles.optionCard}
          onPress={() => router.push('/impostazioni/promozioni' as any)}
        >
          <View style={styles.optionIcon}>
            <Feather name="tag" size={22} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Promozioni</Text>
            <Text style={styles.optionText}>
              Importa, attiva, disattiva e controlla le promozioni dei cataloghi.
            </Text>
          </View>

          <Feather name="chevron-right" size={22} color={COLORS.onSurfaceSecondary} />
        </Pressable>
       <Pressable
         style={styles.optionCard}
         onPress={() => router.push('/liste-standard' as any)}
       >
         <View style={styles.optionIcon}>
           <Feather name="list" size={22} color="#FFFFFF" />
         </View>

         <View style={{ flex: 1 }}>
           <Text style={styles.optionTitle}>Liste standard</Text>
           <Text style={styles.optionText}>
             Modifica categorie, fornitori e marche usate nell'app.
           </Text>
         </View>

         <Feather name="chevron-right" size={22} color={COLORS.onSurfaceSecondary} />
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
  container: {
    padding: 18,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 4,
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
  },
  optionCard: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.onSurface,
  },
  optionText: {
    marginTop: 4,
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
