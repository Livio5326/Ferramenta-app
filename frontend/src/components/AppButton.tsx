import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, PALETTE, RADIUS } from '@/src/theme';

type Props = Omit<PressableProps, 'style' | 'onPress' | 'disabled'> & {
  style?: PressableProps['style'];
  pressedStyle?: StyleProp<ViewStyle>;
  onPress?: (
    event: GestureResponderEvent
  ) => unknown | Promise<unknown>;
  disabled?: boolean;
  hapticEnabled?: boolean;
  preventDoublePress?: boolean;
  pressDelay?: number;
  autoLoading?: boolean;
  loadingColor?: string;
  variante?: 'pieno' | 'pericolo' | 'scuro' | 'inciso';
};

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'then' in value &&
      typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

export default function AppButton({
  style,
  pressedStyle,
  children,
  disabled = false,
  onPress,
  hapticEnabled = true,
  preventDoublePress = true,
  pressDelay = 700,
  autoLoading = true,
  loadingColor,
  variante,
  ...props
}: Props) {
  const lastPressRef = useRef(0);
  const [internalLoading, setInternalLoading] = useState(false);

  const effectivelyDisabled = disabled || internalLoading;

  const handlePress = async (event: GestureResponderEvent) => {
    if (effectivelyDisabled) {
      return;
    }

    const now = Date.now();

    if (
      preventDoublePress &&
      now - lastPressRef.current < pressDelay
    ) {
      return;
    }

    lastPressRef.current = now;

    if (hapticEnabled) {
      void Haptics.selectionAsync().catch(() => {
        // Il pulsante continua a funzionare senza feedback aptico.
      });
    }

    try {
      const result = onPress?.(event);

      if (autoLoading && isPromiseLike(result)) {
        setInternalLoading(true);
        await result;
      }
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Pressable
      {...props}
      disabled={effectivelyDisabled}
      onPress={handlePress}
      style={(state) => {
        const baseStyle =
          typeof style === 'function'
            ? style(state)
            : style;

        return [
          { position: 'relative' },
          variante && BASE.bottone,
          variante && VARIANTI[variante],
          baseStyle,
          effectivelyDisabled && {
            opacity: 0.55,
          },
          state.pressed &&
            !effectivelyDisabled && {
              // Il tasto scende di due pixel e il bordo sotto si accorcia,
              // come un interruttore vero. È il gesto del sito.
              transform: [{ translateY: 2 }],
              borderBottomWidth: variante && variante !== 'inciso' ? 2 : undefined,
            },
          state.pressed &&
            !effectivelyDisabled &&
            pressedStyle,
        ];
      }}
      >
      {(state) => (
        <>
          {typeof children === 'function'
            ? children(state)
            : children}

          {internalLoading && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.18)',
              }}
            >
              <ActivityIndicator
                size="small"
                color={loadingColor}
              />
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

// I quattro bottoni del sito. Il pieno è legno e non minio: nel gestionale
// il rosso significa "attenzione, stai cancellando", e non può voler dire
// anche "conferma".
const VARIANTI = StyleSheet.create({
  pieno: {
    backgroundColor: COLORS.brandPrimary,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.legnoOmbra,
  },
  pericolo: {
    backgroundColor: COLORS.error,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.minioOmbra,
  },
  scuro: {
    backgroundColor: PALETTE.noce,
    borderBottomWidth: 4,
    borderBottomColor: PALETTE.noce3,
  },
  inciso: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
  },
});

const BASE = StyleSheet.create({
  bottone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.sm,
  },
});

export const TESTO_BOTTONE = {
  pieno: { fontFamily: FONTS.testoForte, fontSize: 15, color: COLORS.onBrandPrimary },
  pericolo: { fontFamily: FONTS.testoForte, fontSize: 15, color: COLORS.onError },
  scuro: { fontFamily: FONTS.testoForte, fontSize: 15, color: COLORS.onSurfaceInverse },
  inciso: { fontFamily: FONTS.testoForte, fontSize: 15, color: COLORS.brandPrimary },
} as const;
