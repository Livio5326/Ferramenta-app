import Constants from 'expo-constants';

const removeTrailingSlash = (value: string) => value.replace(/\/+$/, '');

function getExpoDevelopmentHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) {
    return null;
  }

  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(hostUri) ? hostUri : `http://${hostUri}`,
    );
    return url.hostname || null;
  } catch {
    return null;
  }
}

const configuredBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
const developmentHost = getExpoDevelopmentHost();
const automaticallyDiscoveredBackendUrl =
  __DEV__ && developmentHost ? `http://${developmentHost}:8000` : null;

if (!__DEV__ && !configuredBackendUrl) {
  throw new Error(
    'EXPO_PUBLIC_BACKEND_URL deve essere configurato per le build di produzione.',
  );
}

/** Un solo indirizzo backend per tutte le schermate dell'app. */
export const BACKEND_URL = removeTrailingSlash(
  automaticallyDiscoveredBackendUrl || configuredBackendUrl || 'http://localhost:8000',
);

export const API_URL = `${BACKEND_URL}/api`;

if (__DEV__) {
  console.info(`[Ferramenta] Backend: ${BACKEND_URL}`);
}
