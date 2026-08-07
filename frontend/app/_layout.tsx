import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/src/auth';
import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { initLocalDb } from '@/src/local/db';
import { COLORS } from '@/src/theme';

SplashScreen.preventAutoHideAsync();
initLocalDb();

function AppNavigator() {
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      SplashScreen.hideAsync();
    }
  }, [authLoading]);

  if (authLoading) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: COLORS.surface,
          },
        }}
      >
        <Stack.Screen
          name="login"
          options={{ presentation: 'modal' }}
        />

        <Stack.Screen name="(tabs)" />

        <Stack.Screen
          name="profile"
          options={{ presentation: 'card' }}
        />

        <Stack.Screen
          name="edit-profile"
          options={{ presentation: 'card' }}
        />

        <Stack.Screen
          name="users"
          options={{ presentation: 'card' }}
        />

        <Stack.Screen
          name="user-detail"
          options={{ presentation: 'card' }}
        />

        <Stack.Screen
          name="change-password"
          options={{ presentation: 'card' }}
        />

        <Stack.Screen
          name="product/[id]"
          options={{ presentation: 'card', animation: 'slide_from_right', gestureEnabled: true, }}
        />

        <Stack.Screen
          name="product/new"
          options={{ presentation: 'modal' }}
        />

        <Stack.Screen
          name="scanner"
          options={{ presentation: 'modal' }}
        />

        <Stack.Screen
          name="import"
          options={{ presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useIconFonts();
  // Caratteri del restyling (Fraunces, Archivo, IBM Plex Mono): usati dal
  // Task 3 nei token del tema. Attesi qui insieme alle icone perché
  // _layout.tsx già blocca il rendering finché queste non sono pronte, ma
  // l'attesa ha una via d'uscita: se il caricamento fallisce (errore),
  // l'app parte comunque e degrada al carattere di sistema, invece di
  // restare bloccata su schermo bianco.
  const [caratteriPronti, erroreCaratteri] = useFonts({
    Fraunces_700Bold: require('../assets/fonts/Fraunces_700Bold.ttf'),
    Fraunces_900Black: require('../assets/fonts/Fraunces_900Black.ttf'),
    Archivo_400Regular: require('../assets/fonts/Archivo_400Regular.ttf'),
    Archivo_700Bold: require('../assets/fonts/Archivo_700Bold.ttf'),
    IBMPlexMono_400Regular: require('../assets/fonts/IBMPlexMono_400Regular.ttf'),
    IBMPlexMono_500Medium: require('../assets/fonts/IBMPlexMono_500Medium.ttf'),
  });

  if ((!fontsLoaded && !fontsError) || (!caratteriPronti && !erroreCaratteri)) {
    return null;
  }

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
      }}
    >
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
