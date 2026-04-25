import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalData } from '@/features/local-data/LocalDataContext';

export function DashboardScreen() {
  const { store, inventoryItems, isLoading, error, refresh, submitLocalCommand } = useLocalData();
  const [commandText, setCommandText] = useState('');
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [isSubmittingCommand, setIsSubmittingCommand] = useState(false);
  const pulseScale = useRef(new Animated.Value(0.95)).current;
  const pulseOpacity = useRef(new Animated.Value(0.35)).current;

  const lowStockItems = useMemo(
    () => inventoryItems.filter((item) => item.currentStock <= item.lowStockThreshold),
    [inventoryItems],
  );
  const inventoryValue = useMemo(
    () => inventoryItems.reduce((total, item) => total + item.currentStock * item.price, 0),
    [inventoryItems],
  );

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.3,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 0.95,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.35,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    pulse.start();
    return () => pulse.stop();
  }, [pulseOpacity, pulseScale]);

  const handleSubmitCommand = async () => {
    setIsSubmittingCommand(true);
    setCommandMessage(null);

    try {
      const result = await submitLocalCommand(commandText);

      if (result.status === 'applied') {
        setCommandText('');
        setCommandMessage('Applied locally. Sync is still pending.');
        return;
      }

      if (result.status === 'online_required') {
        setCommandMessage('Question detected. Online assistant is required in a later milestone.');
        return;
      }

      if (result.status === 'needs_confirmation') {
        setCommandMessage('Parser needs confirmation before changing inventory.');
        return;
      }

      setCommandMessage('Command was not parsed. Try the demo command format.');
    } catch (caughtError) {
      setCommandMessage(caughtError instanceof Error ? caughtError.message : 'Unable to apply command.');
    } finally {
      setIsSubmittingCommand(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => void refresh()} style={styles.iconButton}>
            {isLoading ? (
              <ActivityIndicator color="#1f7a63" size="small" />
            ) : (
              <Ionicons color="#1f7a63" name="refresh-outline" size={22} />
            )}
          </TouchableOpacity>
          <Text numberOfLines={1} style={styles.storeName}>
            {store?.name ?? 'Tindai Store'}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{store ? 'Local Ready' : 'No Store'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.voiceSection}>
          <View style={styles.voiceButtonWrap}>
            <Animated.View
              style={[
                styles.voicePulse,
                {
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
            <TouchableOpacity activeOpacity={0.85} style={styles.voiceButton}>
              <Ionicons color="#ffffff" name="mic-outline" size={56} />
            </TouchableOpacity>
          </View>
          <Text style={styles.voiceLabel}>TINDAY IS LISTENING</Text>
          <Text style={styles.voiceTitle}>Tap to Speak Sales Command</Text>
        </View>

        <View style={styles.commandCard}>
          <TextInput
            autoCapitalize="sentences"
            editable={!isSubmittingCommand}
            onChangeText={setCommandText}
            placeholder="Nakabenta ako ng dalawang Coke Mismo."
            placeholderTextColor="#7a847e"
            style={styles.commandInput}
            value={commandText}
          />
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isSubmittingCommand}
            onPress={() => void handleSubmitCommand()}
            style={[styles.commandButton, isSubmittingCommand && styles.commandButtonDisabled]}
          >
            {isSubmittingCommand ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Ionicons color="#ffffff" name="send-outline" size={20} />
            )}
          </TouchableOpacity>
        </View>
        {commandMessage ? <Text style={styles.commandMessage}>{commandMessage}</Text> : null}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons color="#ba1a1a" name="alert-circle-outline" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{inventoryItems.length}</Text>
            <Text style={styles.summaryLabel}>Items</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{lowStockItems.length}</Text>
            <Text style={styles.summaryLabel}>Low Stock</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>P{inventoryValue.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Stock Value</Text>
          </View>
        </View>

        {inventoryItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons color="#00604c" name="cube-outline" size={28} />
            <Text style={styles.emptyTitle}>No inventory synced yet</Text>
            <Text style={styles.emptyText}>
              Add or seed inventory in Supabase for this account, then refresh to cache it for offline use.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.lowStockTopRow}>
                <Ionicons color={lowStockItems.length > 0 ? '#ba1a1a' : '#1f7a63'} name="warning-outline" size={20} />
                <View style={styles.lowStockChip}>
                  <Text style={styles.lowStockChipText}>
                    {lowStockItems.length > 0 ? 'Low Stock' : 'Stock Healthy'}
                  </Text>
                </View>
              </View>
              <Text style={styles.lowStockItem}>{lowStockItems[0]?.name ?? 'No low-stock items'}</Text>
              <View style={styles.lowStockBottomRow}>
                <Text style={styles.lowStockCount}>
                  {lowStockItems[0]?.currentStock ?? 0}{' '}
                  <Text style={styles.lowStockCountMuted}>{lowStockItems[0]?.unit ?? 'items'}</Text>
                </Text>
                <Text style={styles.orderMore}>Offline alert</Text>
              </View>
            </View>

            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Inventory</Text>
              <Text style={styles.viewAll}>{inventoryItems.length} synced</Text>
            </View>

            <View style={styles.activityCard}>
              {inventoryItems.slice(0, 6).map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.activityItem, index < Math.min(inventoryItems.length, 6) - 1 ? styles.activityDivider : undefined]}
                >
                  <View style={styles.activityIconWrap}>
                    <Ionicons color="#1f7a63" name="cube-outline" size={20} />
                  </View>
                  <View style={styles.activityBody}>
                    <Text style={styles.activityLabel}>{item.name}</Text>
                    <Text style={styles.activityTime}>
                      {item.aliases.length > 0 ? item.aliases.join(', ') : 'No aliases yet'}
                    </Text>
                  </View>
                  <Text style={styles.activityAmount}>
                    {item.currentStock} {item.unit}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fdfbf7',
  },
  topBar: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    backgroundColor: '#fdfbf7',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    color: '#1f7a63',
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: '#e3f8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    color: '#1f7a63',
    fontSize: 12,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 18,
  },
  voiceSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  voiceButtonWrap: {
    width: 172,
    height: 172,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  voicePulse: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#1f7a63',
  },
  voiceButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00604c',
    shadowColor: '#00604c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  voiceLabel: {
    color: '#00604c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  voiceTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#181d1b',
    textAlign: 'center',
    lineHeight: 34,
    paddingHorizontal: 20,
  },
  commandCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  commandInput: {
    flex: 1,
    minHeight: 44,
    color: '#181d1b',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 10,
  },
  commandButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00604c',
  },
  commandButtonDisabled: {
    opacity: 0.65,
  },
  commandMessage: {
    color: '#3e4945',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    gap: 3,
  },
  summaryValue: {
    color: '#00604c',
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#4d5a53',
    fontSize: 11,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#ffdad6',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#93000a',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    gap: 8,
  },
  emptyTitle: {
    color: '#181d1b',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: '#4d5a53',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    gap: 10,
  },
  lowStockTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lowStockChip: {
    backgroundColor: '#ffdad6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lowStockChipText: {
    color: '#93000a',
    fontSize: 12,
    fontWeight: '600',
  },
  lowStockItem: {
    color: '#181d1b',
    fontSize: 16,
    fontWeight: '700',
  },
  lowStockBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  lowStockCount: {
    color: '#00604c',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 34,
  },
  lowStockCountMuted: {
    color: '#3e4945',
    fontSize: 14,
    fontWeight: '400',
  },
  orderMore: {
    color: '#00604c',
    fontSize: 14,
    fontWeight: '700',
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentTitle: {
    color: '#181d1b',
    fontSize: 22,
    fontWeight: '700',
  },
  viewAll: {
    color: '#00604c',
    fontSize: 14,
    fontWeight: '700',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    overflow: 'hidden',
  },
  activityItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  activityIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f8f0',
  },
  activityBody: {
    flex: 1,
    gap: 2,
  },
  activityLabel: {
    color: '#181d1b',
    fontSize: 15,
    fontWeight: '700',
  },
  activityTime: {
    color: '#4d5a53',
    fontSize: 12,
    fontWeight: '500',
  },
  activityAmount: {
    color: '#00604c',
    fontSize: 15,
    fontWeight: '700',
  },
});
