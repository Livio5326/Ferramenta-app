module.exports = ({ config }) => {
  if (process.env.EXPO_LOCAL_PREVIEW !== '1') {
    return config;
  }

  const extra = { ...(config.extra || {}) };

  // Il projectId EAS appartiene alla configurazione remota originale e
  // richiede un certificato dell'account proprietario. L'anteprima LAN
  // non usa EAS, quindi lo escludiamo soltanto durante l'avvio locale.
  delete extra.eas;

  return {
    ...config,
    extra,
  };
};
