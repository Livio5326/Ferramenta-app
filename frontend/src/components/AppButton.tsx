import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

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
          baseStyle,
          effectivelyDisabled && {
            opacity: 0.55,
          },
          state.pressed &&
            !effectivelyDisabled && {
              transform: [{ scale: 0.96 }],
              opacity: 0.88,
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
