import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: PressableProps['style'];
  pressedStyle?: StyleProp<ViewStyle>;
};

export default function AppButton({
  style,
  pressedStyle,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={(state) => {
        const baseStyle =
          typeof style === 'function'
            ? style(state)
            : style;

        return [
          baseStyle,
          state.pressed &&
            !disabled && {
              transform: [{ scale: 0.96 }],
              opacity: 0.88,
            },
          state.pressed && !disabled && pressedStyle,
        ];
      }}
    >
      {children}
    </Pressable>
  );
}
