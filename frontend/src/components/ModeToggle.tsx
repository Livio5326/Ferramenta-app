import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS, OMBRE, PALETTE, RADIUS, TESTO } from '@/src/theme';
import { useAppStore } from '@/src/store';
import { Asse } from '@/src/components/materiale/Asse';
import { Vite } from '@/src/components/materiale/Vite';
import AppButton from '@/src/components/AppButton';

// La leva dei due mondi, presa dal sito. Lì cambia il terreno sotto i piedi:
// noce dentro casa, verde fuori. Qui i due mondi sono Gestore e Cliente.

export function ModeToggle() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const gestore = mode === 'gestore';

  return (
    <Asse style={styles.asse} testID="mode-toggle">
      <Vite style={{ top: 5, left: 5 }} />
      <Vite style={{ top: 5, right: 5 }} />
      <Vite style={{ bottom: 5, left: 5 }} />
      <Vite style={{ bottom: 5, right: 5 }} />

      <View
        style={[
          styles.cursore,
          gestore
            ? { left: 6, right: '50%', backgroundColor: PALETTE.noce }
            : { left: '50%', right: 6, backgroundColor: PALETTE.verdeScuro },
        ]}
        pointerEvents="none"
      />

      <AppButton style={styles.meta} onPress={() => setMode('gestore')} testID="mode-gestore-btn">
        <Feather name="tool" size={14} color={gestore ? COLORS.onSurfaceInverse : PALETTE.noce2} />
        <Text style={[styles.txt, gestore && styles.txtAttivo]}>GESTORE</Text>
      </AppButton>

      <AppButton style={styles.meta} onPress={() => setMode('cliente')} testID="mode-cliente-btn">
        <Feather name="user" size={14} color={!gestore ? COLORS.onSurfaceInverse : PALETTE.noce2} />
        <Text style={[styles.txt, !gestore && styles.txtAttivo]}>CLIENTE</Text>
      </AppButton>
    </Asse>
  );
}

const styles = StyleSheet.create({
  asse: {
    flexDirection: 'row',
    padding: 6,
    alignItems: 'center',
    // L'ombra di serie di Asse (raggio 14, scarto 8, opacità .45) è tarata
    // sulla tavola grande del Task 4: qui sotto è una tavoletta di ~50px,
    // e con quell'ombra sembrava sospesa a mezz'aria. La sostituiamo con
    // OMBRE.scheda, la stessa usata dalle schede di lista — stesso colore
    // (noce3), ma pensata per elementi di questa taglia.
    ...OMBRE.scheda,
  },
  cursore: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderRadius: RADIUS.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 240, 190, 0.5)',
  },
  meta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  txt: { ...TESTO.cassetto, color: PALETTE.noce2 },
  txtAttivo: { color: COLORS.onSurfaceInverse },
});
