import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/navigation/colors';

export function GoogleSignInMark() {
  return (
    <View style={styles.badge}>
      <Text style={styles.letter}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(31, 122, 99, 0.24)',
    backgroundColor: colors.surface,
  },
  letter: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '800',
  },
});
