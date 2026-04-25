import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CommandSource } from '@/features/commands/localCommandService';
import { useLocalData } from '@/features/local-data/LocalDataContext';
import type { ParserResult } from '@/features/parser/offlineParser';

export function DashboardScreen() {
  const {
    appState,
    store,
    inventoryItems,
    recentTransactions,
    isLoading,
    error,
    refresh,
    submitLocalCommand,
    confirmLocalCommand,
    applyManualAdjustment,
  } = useLocalData();
  const [commandText, setCommandText] = useState('');
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [isSubmittingCommand, setIsSubmittingCommand] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingParserResult, setPendingParserResult] = useState<ParserResult | null>(null);
  const [pendingCustomerName, setPendingCustomerName] = useState('');
  const [pendingAction, setPendingAction] = useState(false);
  const [manualAdjustingItemId, setManualAdjustingItemId] = useState<string | null>(null);

  const lowStockItems = useMemo(
    () => inventoryItems.filter((item) => item.currentStock <= item.lowStockThreshold),
    [inventoryItems],
  );
  const inventoryValue = useMemo(
    () => inventoryItems.reduce((total, item) => total + item.currentStock * item.price, 0),
    [inventoryItems],
  );

  const buildConfirmationText = useCallback((parserResult: ParserResult) => {
    const itemSummary = parserResult.items
      .map((item) => `${Math.abs(item.quantity_delta)} ${item.item_name}`)
      .join(' + ');

    if (parserResult.intent === 'restock') {
      return `Dagdag ${itemSummary}?`;
    }

    if (parserResult.intent === 'utang') {
      const customerName = parserResult.credit.customer_name ?? pendingCustomerName.trim();
      return customerName ? `Utang ni ${customerName}: ${itemSummary}?` : `Utang: ${itemSummary}?`;
    }

    return `Bawas ${itemSummary}?`;
  }, [pendingCustomerName]);

  const processCommand = useCallback(
    async (rawText: string, source: CommandSource) => {
      setIsSubmittingCommand(true);
      setCommandMessage(null);

      try {
        const result = await submitLocalCommand(rawText, source);

        if (result.status === 'applied') {
          setCommandText('');
          setPendingParserResult(null);
          setPendingCustomerName('');
          setCommandMessage('Naitala na. Hihintayin lang ang internet para maipadala.');
          return;
        }

        if (result.status === 'online_required') {
          setPendingParserResult(null);
          setPendingCustomerName('');
          setCommandMessage('Kailangan ng internet para masagot ito.');
          return;
        }

        if (result.status === 'needs_confirmation') {
          setPendingParserResult(result.parserResult);
          setPendingCustomerName(result.parserResult.credit.customer_name ?? '');
          setCommandMessage('Pakikumpirma muna bago itala.');
          return;
        }

        setPendingParserResult(null);
        setPendingCustomerName('');
        setCommandMessage('Hindi malinaw ang utos. Pakiulit o ayusin ang sulat.');
      } catch (caughtError) {
        setCommandMessage(caughtError instanceof Error ? caughtError.message : 'Hindi naitala. Subukan ulit.');
      } finally {
        setIsSubmittingCommand(false);
      }
    },
    [submitLocalCommand],
  );

  const handleConfirmPending = useCallback(async () => {
    if (!pendingParserResult) {
      return;
    }

    setPendingAction(true);
    setCommandMessage(null);

    try {
      await confirmLocalCommand(pendingParserResult, pendingCustomerName);
      setPendingParserResult(null);
      setPendingCustomerName('');
      setCommandText('');
      setCommandMessage('Naitala na. Hihintayin lang ang internet para maipadala.');
    } catch (caughtError) {
      setCommandMessage(caughtError instanceof Error ? caughtError.message : 'Hindi naituloy. Subukan ulit.');
    } finally {
      setPendingAction(false);
    }
  }, [confirmLocalCommand, pendingCustomerName, pendingParserResult]);

  const handleManualAdjust = useCallback(
    async (itemId: string, direction: -1 | 1) => {
      setManualAdjustingItemId(itemId);
      setCommandMessage(null);

      try {
        await applyManualAdjustment(itemId, direction);
        setCommandMessage('Nabago na ang bilang. Hihintayin lang ang internet para maipadala.');
      } catch (caughtError) {
        setCommandMessage(caughtError instanceof Error ? caughtError.message : 'Hindi nabago ang bilang. Subukan ulit.');
      } finally {
        setManualAdjustingItemId(null);
      }
    },
    [applyManualAdjustment],
  );

  const startListening = useCallback(async () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setCommandMessage('Hindi available ang voice input sa phone na ito.');
        return;
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setCommandMessage('Payagan ang mic para makapagsalita ka ng utos.');
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: 'fil-PH',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
      });
    } catch (caughtError) {
      setCommandMessage(caughtError instanceof Error ? caughtError.message : 'Hindi nagsimula ang voice input.');
      setIsListening(false);
    }
  }, [isListening]);

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    setCommandMessage(event.message || 'Hindi nakuha nang maayos ang boses.');
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal || event.results.length === 0) {
      return;
    }

    const transcript = event.results[0]?.transcript?.trim();

    if (!transcript) {
      return;
    }

    setCommandText(transcript);
    void processCommand(transcript, 'voice');
  });

  const pendingNeedsCustomer =
    pendingParserResult?.intent === 'utang' &&
    pendingParserResult?.notes.includes('missing_customer_name') &&
    !pendingCustomerName.trim();

  const formatTransactionLine = (createdAt: string, source: string, syncStatus: string, intent: string | null) => {
    const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const kind = intent === 'restock' ? 'dagdag' : intent === 'utang' ? 'utang' : 'bawas';
    const pinagmulan = source === 'voice' ? 'boses' : source === 'manual' ? 'pindot' : 'sulat';
    const estado = syncStatus === 'pending' ? 'hindi pa naipapadala' : 'naipadala';

    return `${time} - ${kind} - ${pinagmulan} - ${estado}`;
  };

  const formatDelta = (name: string | null, delta: number | null) => {
    if (!name || typeof delta !== 'number') {
      return null;
    }

    const sign = delta > 0 ? '+' : '';
    return `${name} ${sign}${delta}`;
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
          <Text style={styles.statusText}>{appState?.mode === 'authenticated' ? 'Cloud Linked' : 'Guest Mode'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.voiceSection}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => void startListening()} style={styles.voiceButton}>
            <Ionicons color="#ffffff" name={isListening ? 'stop-outline' : 'mic-outline'} size={56} />
          </TouchableOpacity>
          <Text style={styles.voiceLabel}>{isListening ? 'LISTENING...' : 'VOICE COMMAND'}</Text>
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
            onPress={() => void processCommand(commandText, 'typed')}
            style={[styles.commandButton, isSubmittingCommand && styles.commandButtonDisabled]}
          >
            {isSubmittingCommand ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Ionicons color="#ffffff" name="send-outline" size={20} />
            )}
          </TouchableOpacity>
        </View>

        {pendingParserResult ? (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmText}>{buildConfirmationText(pendingParserResult)}</Text>
            {pendingParserResult.intent === 'utang' && pendingParserResult.notes.includes('missing_customer_name') ? (
              <TextInput
                autoCapitalize="words"
                editable={!pendingAction}
                onChangeText={setPendingCustomerName}
                placeholder="Customer name"
                placeholderTextColor="#7a847e"
                style={styles.customerInput}
                value={pendingCustomerName}
              />
            ) : null}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={pendingAction || pendingNeedsCustomer}
                onPress={() => void handleConfirmPending()}
                style={[styles.confirmButton, (pendingAction || pendingNeedsCustomer) && styles.commandButtonDisabled]}
              >
                <Text style={styles.confirmButtonText}>{pendingAction ? 'Applying...' : 'Confirm'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setPendingParserResult(null);
                  setPendingCustomerName('');
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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
          <View style={styles.activityCard}>
            {inventoryItems.slice(0, 8).map((item, index) => (
              <View
                key={item.id}
                style={[styles.activityItem, index < Math.min(inventoryItems.length, 8) - 1 ? styles.activityDivider : undefined]}
              >
                <View style={styles.activityBody}>
                  <Text style={styles.activityLabel}>{item.name}</Text>
                  <Text style={styles.activityTime}>
                    {item.currentStock} {item.unit} {item.currentStock <= item.lowStockThreshold ? '• Low stock' : ''}
                  </Text>
                </View>
                <View style={styles.adjustWrap}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => void handleManualAdjust(item.id, -1)}
                    style={styles.adjustButton}
                  >
                    <Ionicons color="#ffffff" name="remove" size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => void handleManualAdjust(item.id, 1)}
                    style={styles.adjustButton}
                  >
                    {manualAdjustingItemId === item.id ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Ionicons color="#ffffff" name="add" size={16} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.recentTitle}>Recent Transactions</Text>
          {recentTransactions.length === 0 ? (
            <Text style={styles.activityTime}>No local transactions yet.</Text>
          ) : (
            recentTransactions.slice(0, 6).map((transaction, index) => (
              <View
                key={transaction.id}
                style={[styles.activityItem, index < Math.min(recentTransactions.length, 6) - 1 ? styles.activityDivider : undefined]}
              >
                <View style={styles.activityBody}>
                  <Text style={styles.activityLabel}>{transaction.rawText}</Text>
                  <Text style={styles.activityTime}>{formatTransactionLine(transaction.createdAt, transaction.source, transaction.syncStatus, transaction.intent)}</Text>
                  {formatDelta(transaction.primaryItemName, transaction.primaryQuantityDelta) ? (
                    <Text style={styles.activityTime}>{formatDelta(transaction.primaryItemName, transaction.primaryQuantityDelta)}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
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
    gap: 14,
  },
  voiceSection: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  voiceButton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00604c',
  },
  voiceLabel: {
    color: '#00604c',
    fontSize: 12,
    fontWeight: '800',
  },
  voiceTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#181d1b',
    textAlign: 'center',
    lineHeight: 30,
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
  confirmCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: 12,
    gap: 10,
  },
  confirmText: {
    color: '#181d1b',
    fontSize: 14,
    fontWeight: '700',
  },
  customerInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#dfe2e0',
    borderRadius: 10,
    paddingHorizontal: 10,
    color: '#181d1b',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#00604c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8dbd9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#3e4945',
    fontWeight: '700',
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
    gap: 6,
  },
  recentTitle: {
    color: '#181d1b',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f5f5f4',
    overflow: 'hidden',
  },
  activityItem: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  activityBody: {
    flex: 1,
    gap: 2,
  },
  activityLabel: {
    color: '#181d1b',
    fontSize: 14,
    fontWeight: '700',
  },
  activityTime: {
    color: '#4d5a53',
    fontSize: 12,
    fontWeight: '500',
  },
  adjustWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  adjustButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#00604c',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
