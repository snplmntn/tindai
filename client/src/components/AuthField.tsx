import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Pressable } from 'react-native';

import { colors } from '@/navigation/colors';

export function AuthField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
  autoComplete,
  textContentType,
  hasError = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  hasError?: boolean;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const shouldShowPasswordToggle = Boolean(secureTextEntry);
  const effectiveSecureTextEntry = shouldShowPasswordToggle ? !isPasswordVisible : secureTextEntry;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={effectiveSecureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          style={[styles.input, shouldShowPasswordToggle && styles.inputWithIcon, hasError && styles.inputError]}
        />
        {shouldShowPasswordToggle ? (
          <Pressable onPress={() => setIsPasswordVisible((current) => !current)} style={styles.iconButton}>
            <Feather name={isPasswordVisible ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputWithIcon: {
    paddingRight: 46,
  },
  iconButton: {
    position: 'absolute',
    top: 11,
    right: 14,
    height: 32,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  inputError: {
    borderColor: '#BA1A1A',
  },
});
