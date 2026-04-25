import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors } from '@/navigation/colors';

export function PrimaryButton({
  label,
  onPress,
  variant = 'solid',
  leadingIcon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'ghost';
  leadingIcon?: ReactNode;
  disabled?: boolean;
}) {
  const ghost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        ghost ? styles.ghost : styles.solid,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {leadingIcon}
        <Text style={[styles.label, ghost && styles.ghostLabel]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  } satisfies ViewStyle,
  solid: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDeep,
  },
  ghost: {
    borderWidth: 1,
    borderColor: 'rgba(31, 122, 99, 0.24)',
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ghostLabel: {
    color: colors.primaryDeep,
  },
});
