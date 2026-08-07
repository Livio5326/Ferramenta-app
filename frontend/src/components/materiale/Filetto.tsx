import { View, StyleSheet } from 'react-native';

// Il filetto inciso: la riga chiara che corre dentro il bordo dell'asse.

export function Filetto() {
  return <View style={styles.filetto} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  filetto: {
    position: 'absolute',
    top: 9,
    right: 9,
    bottom: 9,
    left: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 232, 205, 0.34)',
    borderRadius: 2,
  },
});
