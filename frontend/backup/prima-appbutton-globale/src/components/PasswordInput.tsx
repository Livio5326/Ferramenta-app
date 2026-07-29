import { useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

type PasswordInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

export function PasswordInput({
  containerStyle,
  style,
  editable = true,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        {...props}
        editable={editable}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, style]}
      />

      <Pressable
        onPress={() => setVisible((value) => !value)}
        disabled={!editable}
        hitSlop={10}
        style={({ pressed }) => [
          styles.eyeButton,
          pressed && editable && styles.eyeButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Nascondi password' : 'Mostra password'}
      >
        <Feather
          name={visible ? 'eye-off' : 'eye'}
          size={21}
          color={editable ? '#5F665F' : '#A7AAA7'}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D6D8D6',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingLeft: 15,
    paddingRight: 8,
    fontSize: 16,
  },
  eyeButton: {
    width: 48,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeButtonPressed: {
    opacity: 0.55,
  },
});
