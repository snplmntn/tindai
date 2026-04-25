import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CommandSource } from '@/features/commands/localCommandService';
import { useLocalData } from '@/features/local-data/LocalDataContext';
import type { ParserResult } from '@/features/parser/offlineParser';

type SpeechRecognitionStartOptions = {
  lang?: string;
  interimResults?: boolean;
  maxAlternatives?: number;
  continuous?: boolean;
};

type SpeechRecognitionModuleRuntime = {
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: () => boolean;
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    start: (options?: SpeechRecognitionStartOptions) => void;
    stop: () => void;
  };
  useSpeechRecognitionEvent: (eventName: string, listener: (event: any) => void) => void;
};

const speechRecognitionRuntime: SpeechRecognitionModuleRuntime | null = (() => {
  try {
    return require('expo-speech-recognition') as SpeechRecognitionModuleRuntime;
  } catch {
    return null;
  }
})();

const ExpoSpeechRecognitionModule = speechRecognitionRuntime?.ExpoSpeechRecognitionModule ?? {
  isRecognitionAvailable: () => false,
  requestPermissionsAsync: async () => ({ granted: false }),
  start: (_options?: SpeechRecognitionStartOptions) => undefined,
  stop: () => undefined,
};

const useSpeechRecognitionEvent =
  speechRecognitionRuntime?.useSpeechRecognitionEvent ??
  ((_eventName: string, _listener: (event: any) => void) => undefined);

export function DashboardScreen() {
  const {
    appState,
    store,
    inventoryItems,
    customers,
    assistantInteractions,
    pendingTransactions,
    isLoading,
    error,
    refresh,
    submitLocalCommand,
    confirmLocalCommand,
    applyManualAdjustment,
    submitFallbackCommand,
    createLocalCustomer,
    submitAssistantQuestion,
  } = useLocalData();
  const [commandText, setCommandText] = useState('');
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [isSubmittingCommand, setIsSubmittingCommand] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingParserResult, setPendingParserResult] = useState<ParserResult | null>(null);
  const [pendingCustomerName, setPendingCustomerName] = useState('');
  const [pendingAction, setPendingAction] = useState(false);
  const [manualAdjustingItemId, setManualAdjustingItemId] = useState<string | null>(null);
  const [isFallbackVisible, setIsFallbackVisible] = useState(false);
  const [fallbackIntent, setFallbackIntent] = useState<'sale' | 'restock' | 'utang'>('sale');
  const [fallbackItemId, setFallbackItemId] = useState<string>('');
  const [fallbackQuantity, setFallbackQuantity] = useState(1);
  const [fallbackCustomerName, setFallbackCustomerName] = useState('');
  const [isSavingFallback, setIsSavingFallback] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const hasSpeechRecognitionNative = speechRecognitionRuntime !== null;

  const lowStockItems = useMemo(
    () => inventoryItems.filter((item) => item.currentStock <= item.lowStockThreshold),
    [inventoryItems],
  );
  const inventoryValue = useMemo(
    () => inventoryItems.reduce((total, item) => total + item.currentStock * item.price, 0),
    [inventoryItems],
  );

  const selectedFallbackItem = useMemo(
    () => inventoryItems.find((item) => item.id === fallbackItemId) ?? inventoryItems[0] ?? null,
    [fallbackItemId, inventoryItems],
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

  const openFallback = useCallback(
    (options?: { parserResult?: ParserResult }) => {
      const parserResult = options?.parserResult;
      const defaultItemId = inventoryItems[0]?.id ?? '';
      const inferredItemId = parserResult?.items[0]?.item_id ?? (fallbackItemId || defaultItemId);
      const inferredQuantity = parserResult?.items[0]?.quantity ?? 1;
      const inferredIntent =
        parserResult?.intent === 'sale' || parserResult?.intent === 'restock' || parserResult?.intent === 'utang'
          ? parserResult.intent
          : fallbackIntent;

      setFallbackIntent(inferredIntent);
      setFallbackItemId(inferredItemId);
      setFallbackQuantity(Math.max(1, Math.floor(inferredQuantity)));
      setFallbackCustomerName(parserResult?.credit.customer_name ?? pendingCustomerName.trim());
      setIsFallbackVisible(true);
    },
    [fallbackIntent, fallbackItemId, inventoryItems, pendingCustomerName],
  );

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
          setIsSubmittingQuestion(true);
          const answer = await submitAssistantQuestion(rawText, source === 'voice' ? 'voice' : 'text');
          setAssistantAnswer(answer.answerText);
          setCommandMessage('Nasagot na ang tanong mo.');
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
        openFallback();
      } catch (caughtError) {
        setCommandMessage(caughtError instanceof Error ? caughtError.message : 'Hindi naitala. Subukan ulit.');
      } finally {
        setIsSubmittingCommand(false);
        setIsSubmittingQuestion(false);
      }
    },
    [openFallback, submitAssistantQuestion, submitLocalCommand],
  );

  const pendingNeedsCustomer =
    pendingParserResult?.intent === 'utang' &&
    pendingParserResult?.notes.includes('missing_customer_name') &&
    !pendingCustomerName.trim();

  const handleConfirmPending = useCallback(async () => {
    if (!pendingParserResult) {
      return;
    }

    if (pendingNeedsCustomer) {
      setCommandMessage('Ilagay muna kung kanino ang utang.');
      openFallback({ parserResult: pendingParserResult });
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
  }, [confirmLocalCommand, openFallback, pendingCustomerName, pendingNeedsCustomer, pendingParserResult]);

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
    if (!hasSpeechRecognitionNative) {
      setCommandMessage('Voice input needs a development build. You can type your command instead.');
      return;
    }

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
  }, [hasSpeechRecognitionNative, isListening]);

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

  const saveFallback = useCallback(async () => {
    if (!selectedFallbackItem) {
      setCommandMessage('Pumili muna ng produkto.');
      return;
    }

    setIsSavingFallback(true);
    setCommandMessage(null);
    try {
      await submitFallbackCommand({
        intent: fallbackIntent,
        itemId: selectedFallbackItem.id,
        quantity: fallbackQuantity,
        customerName: fallbackIntent === 'utang' ? fallbackCustomerName : undefined,
      });
      setIsFallbackVisible(false);
      setPendingParserResult(null);
      setPendingCustomerName('');
      setCommandText('');
      setCommandMessage('Naitala na.');
    } catch (caughtError) {
      setCommandMessage(caughtError instanceof Error ? caughtError.message : 'Hindi naitala. Subukan ulit.');
    } finally {
      setIsSavingFallback(false);
    }
  }, [
    fallbackCustomerName,
    fallbackIntent,
    fallbackQuantity,
    selectedFallbackItem,
    submitFallbackCommand,
  ]);

  const handleSaveCustomer = useCallback(async () => {
    const trimmed = fallbackCustomerName.trim();

    if (!trimmed) {
      setCommandMessage('Ilagay muna ang pangalan.');
      return;
    }

    setIsSavingCustomer(true);
    setCommandMessage(null);
    try {
      const customer = await createLocalCustomer(trimmed);
      setFallbackCustomerName(customer.name);
      setCommandMessage('Naidagdag na ang pangalan.');
    } catch (caughtError) {
      setCommandMessage(caughtError instanceof Error ? caughtError.message : 'Hindi naidagdag ang pangalan.');
    } finally {
      setIsSavingCustomer(false);
    }
  }, [createLocalCustomer, fallbackCustomerName]);

  const showPendingStrip = appState?.mode === 'authenticated' && pendingTransactions.length > 0;

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
          <Text style={styles.statusText}>{appState?.mode === 'authenticated' ? 'May account' : 'Walang account'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {showPendingStrip ? (
          <View style={styles.pendingStrip}>
            <ActivityIndicator color="#00604c" size="small" />
            <Text style={styles.pendingStripText}>
              {pendingTransactions.length} tala ang naghihintay ng internet
            </Text>
          </View>
        ) : null}

        <View style={styles.voiceSection}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => void startListening()} style={styles.voiceButton}>
            <Ionicons color="#ffffff" name={isListening ? 'stop-outline' : 'mic-outline'} size={56} />
          </TouchableOpacity>
          <Text style={styles.voiceLabel}>{isListening ? 'NAKIKINIG...' : 'BOSIS'}</Text>
          <Text style={styles.voiceTitle}>Tap para magsalita ng utos</Text>
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
          <TouchableOpacity activeOpacity={0.85} onPress={() => openFallback()} style={styles.fallbackButton}>
            <Ionicons color="#00604c" name="create-outline" size={20} />
          </TouchableOpacity>
        </View>

        {isSubmittingQuestion ? (
          <View style={styles.assistantCard}>
            <Text style={styles.assistantTitle}>Sumasagot si Tinday...</Text>
            <ActivityIndicator color="#00604c" size="small" />
          </View>
        ) : null}

        {assistantAnswer ? (
          <View style={styles.assistantCard}>
            <Text style={styles.assistantTitle}>Sagot ni Tinday</Text>
            <Text style={styles.assistantText}>{assistantAnswer}</Text>
          </View>
        ) : null}

        {pendingParserResult ? (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmText}>{buildConfirmationText(pendingParserResult)}</Text>
            {pendingNeedsCustomer ? <Text style={styles.helperText}>Kulang ang pangalan ng may utang.</Text> : null}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={pendingAction}
                onPress={() => void handleConfirmPending()}
                style={[styles.confirmButton, pendingAction && styles.commandButtonDisabled]}
              >
                <Text style={styles.confirmButtonText}>{pendingAction ? 'Tinatala...' : 'Itala'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openFallback({ parserResult: pendingParserResult })}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Ayusin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setPendingParserResult(null);
                  setPendingCustomerName('');
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Kanselahin</Text>
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
            <Text style={styles.summaryLabel}>Produkto</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{lowStockItems.length}</Text>
            <Text style={styles.summaryLabel}>Malapit maubos</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>P{inventoryValue.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Halaga ng paninda</Text>
          </View>
        </View>

        {inventoryItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons color="#00604c" name="cube-outline" size={28} />
            <Text style={styles.emptyTitle}>Wala pang paninda</Text>
            <Text style={styles.emptyText}>
              Maglagay muna ng paninda para makapagtala ka ng benta at utang.
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
                    {item.currentStock} {item.unit} {item.currentStock <= item.lowStockThreshold ? '- Malapit maubos' : ''}
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

        {assistantInteractions.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.recentTitle}>Mga huling tanong</Text>
            {assistantInteractions.slice(0, 4).map((entry, index) => (
              <View
                key={entry.clientInteractionId}
                style={[
                  styles.activityItem,
                  index < Math.min(assistantInteractions.length, 4) - 1 ? styles.activityDivider : undefined,
                ]}
              >
                <View style={styles.activityBody}>
                  <Text style={styles.activityLabel}>{entry.questionText}</Text>
                  <Text style={styles.activityTime}>{entry.answerText ?? 'Walang sagot pa.'}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

      </ScrollView>

      <Modal animationType="slide" transparent visible={isFallbackVisible} onRequestClose={() => setIsFallbackVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Mabilis na tala</Text>
            <View style={styles.intentRow}>
              {[
                { key: 'sale', label: 'Bawas' },
                { key: 'restock', label: 'Dagdag' },
                { key: 'utang', label: 'Utang' },
              ].map((intent) => (
                <TouchableOpacity
                  key={intent.key}
                  onPress={() => setFallbackIntent(intent.key as 'sale' | 'restock' | 'utang')}
                  style={[styles.intentChip, fallbackIntent === intent.key && styles.intentChipActive]}
                >
                  <Text style={[styles.intentChipText, fallbackIntent === intent.key && styles.intentChipTextActive]}>
                    {intent.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Produkto</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemPickerRow}>
              {inventoryItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setFallbackItemId(item.id)}
                  style={[styles.itemChip, (fallbackItemId || inventoryItems[0]?.id) === item.id && styles.itemChipActive]}
                >
                  <Text style={styles.itemChipText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Dami</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                onPress={() => setFallbackQuantity((current) => Math.max(1, current - 1))}
                style={styles.qtyButton}
              >
                <Ionicons color="#ffffff" name="remove" size={16} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{fallbackQuantity}</Text>
              <TouchableOpacity onPress={() => setFallbackQuantity((current) => current + 1)} style={styles.qtyButton}>
                <Ionicons color="#ffffff" name="add" size={16} />
              </TouchableOpacity>
            </View>

            {fallbackIntent === 'utang' ? (
              <>
                <Text style={styles.modalLabel}>May utang</Text>
                <TextInput
                  autoCapitalize="words"
                  placeholder="Pangalan"
                  placeholderTextColor="#7a847e"
                  style={styles.customerInput}
                  value={fallbackCustomerName}
                  onChangeText={setFallbackCustomerName}
                />
                <TouchableOpacity
                  onPress={() => void handleSaveCustomer()}
                  style={[styles.addNameButton, isSavingCustomer && styles.commandButtonDisabled]}
                  disabled={isSavingCustomer}
                >
                  {isSavingCustomer ? (
                    <ActivityIndicator color="#00604c" size="small" />
                  ) : (
                    <Text style={styles.addNameText}>Idagdag ang pangalan</Text>
                  )}
                </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemPickerRow}>
                  {customers.map((customer) => (
                    <TouchableOpacity key={customer.id} onPress={() => setFallbackCustomerName(customer.name)} style={styles.itemChip}>
                      <Text style={styles.itemChipText}>{customer.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsFallbackVisible(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Kanselahin</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void saveFallback()} style={styles.confirmButton} disabled={isSavingFallback}>
                <Text style={styles.confirmButtonText}>{isSavingFallback ? 'Tinatala...' : 'Itala'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  pendingStrip: {
    backgroundColor: '#e9f6f1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0ebe1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingStripText: {
    color: '#00604c',
    fontSize: 12,
    fontWeight: '700',
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
  fallbackButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d8dbd9',
    backgroundColor: '#ffffff',
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
  assistantCard: {
    backgroundColor: '#f1fbf6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8eee4',
    padding: 12,
    gap: 6,
  },
  assistantTitle: {
    color: '#00604c',
    fontSize: 12,
    fontWeight: '800',
  },
  assistantText: {
    color: '#1f2925',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
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
  helperText: {
    color: '#6c5f00',
    fontSize: 12,
    fontWeight: '600',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 10,
    maxHeight: '85%',
  },
  modalTitle: {
    color: '#181d1b',
    fontSize: 18,
    fontWeight: '800',
  },
  modalLabel: {
    color: '#3e4945',
    fontSize: 12,
    fontWeight: '700',
  },
  intentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intentChip: {
    borderWidth: 1,
    borderColor: '#d8dbd9',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  intentChipActive: {
    backgroundColor: '#00604c',
    borderColor: '#00604c',
  },
  intentChipText: {
    color: '#3e4945',
    fontSize: 12,
    fontWeight: '700',
  },
  intentChipTextActive: {
    color: '#ffffff',
  },
  itemPickerRow: {
    gap: 8,
    paddingVertical: 2,
  },
  itemChip: {
    borderWidth: 1,
    borderColor: '#d8dbd9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemChipActive: {
    borderColor: '#00604c',
    backgroundColor: '#e3f8f0',
  },
  itemChipText: {
    color: '#181d1b',
    fontSize: 12,
    fontWeight: '700',
  },
  addNameButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c4e8dc',
    backgroundColor: '#f2fbf7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNameText: {
    color: '#00604c',
    fontSize: 12,
    fontWeight: '700',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00604c',
  },
  qtyValue: {
    minWidth: 36,
    textAlign: 'center',
    color: '#181d1b',
    fontSize: 22,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
});
