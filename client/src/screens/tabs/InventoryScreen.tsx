import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/config/supabase';
import { ClientTabLayout } from '@/components/ClientTabLayout';
import { ReceiptCaptureFlow } from '@/features/receipt-scan/ReceiptCaptureFlow';
import { ReceiptReviewPanel } from '@/features/receipt-scan/ReceiptReviewPanel';
import {
  cleanupReceiptImageDraft,
  formatReceiptFileSize,
  type ReceiptImageDraft,
} from '@/features/receipt-scan/receiptCapture';
import {
  matchReceiptOnBackend,
  parseReceiptOnBackend,
  sendReceiptOcrToBackend,
} from '@/features/receipt-scan/receiptApi';
import {
  assessReceiptOcrText,
  extractReceiptText,
  type ReceiptProcessingState,
} from '@/features/receipt-scan/receiptOcr';
import {
  createReceiptReviewSession,
  getReceiptReviewSummary,
  type ReceiptReviewItemDraft,
  type ReceiptReviewSession,
} from '@/features/receipt-scan/receiptReview';
import { useLocalData } from '@/features/local-data/LocalDataContext';
import { colors } from '@/navigation/colors';

function formatPendingLine(createdAt: string, source: string, intent: string | null) {
  const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const kind = intent === 'restock' ? 'dagdag' : intent === 'utang' ? 'utang' : 'bawas';
  const from = source === 'voice' ? 'boses' : source === 'manual' ? 'pindot' : 'sulat';

  return `${time} - ${kind} - ${from}`;
}

export function InventoryScreen() {
  const { appState, inventoryItems, pendingTransactions } = useLocalData();
  const [isReceiptFlowVisible, setIsReceiptFlowVisible] = useState(false);
  const [savedReceiptDraft, setSavedReceiptDraft] = useState<ReceiptImageDraft | null>(null);
  const [receiptProcessingState, setReceiptProcessingState] = useState<ReceiptProcessingState>({ status: 'idle' });
  const [receiptReview, setReceiptReview] = useState<ReceiptReviewSession | null>(null);
  const showPending = appState?.mode === 'authenticated';
  const showPendingPanel = showPending && pendingTransactions.length > 0;
  const reviewSummary = useMemo(
    () => (receiptReview ? getReceiptReviewSummary(receiptReview.items) : null),
    [receiptReview],
  );

  function updateReviewItem(receiptItemId: string, updater: (item: ReceiptReviewItemDraft) => ReceiptReviewItemDraft) {
    setReceiptReview((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        items: current.items.map((item) => (item.receiptItemId === receiptItemId ? updater(item) : item)),
      };
    });
  }

  function setMatchPickerOpen(receiptItemId: string, open: boolean) {
    updateReviewItem(receiptItemId, (item) => ({
      ...item,
      isMatchPickerOpen: open,
      isCreateProductOpen: open ? false : item.isCreateProductOpen,
      matchSearchText: open ? item.matchSearchText || item.rawName : item.matchSearchText,
      resolution: item.resolution === 'SKIP' && open ? 'UNRESOLVED' : item.resolution,
    }));
  }

  function setCreateProductOpen(receiptItemId: string, open: boolean) {
    updateReviewItem(receiptItemId, (item) => ({
      ...item,
      isCreateProductOpen: open,
      isMatchPickerOpen: open ? false : item.isMatchPickerOpen,
      resolution: open ? 'UNRESOLVED' : item.resolution,
    }));
  }

  async function handleSaveReceiptDraft(draft: ReceiptImageDraft) {
    try {
      if (savedReceiptDraft) {
        void cleanupReceiptImageDraft(savedReceiptDraft);
      }

      setSavedReceiptDraft(draft);
      setReceiptReview(null);
      setReceiptProcessingState({
        status: 'running_ocr',
        receiptId: draft.id,
      });

      const extraction = await extractReceiptText(draft);
      const assessment = assessReceiptOcrText(extraction.rawText);
      if (assessment.status === 'weak') {
        setReceiptProcessingState({
          status: 'weak_text',
          receiptId: draft.id,
          extraction,
          message: assessment.message ?? 'Kaunti pa lang ang nabasa mula sa resibo.',
        });
        setIsReceiptFlowVisible(false);
        return;
      }

      setReceiptProcessingState({
        status: 'uploading_ocr',
        receiptId: draft.id,
      });

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setReceiptProcessingState({
          status: 'failed',
          receiptId: draft.id,
          message: 'Mag-sign in muna bago iproseso ang laman ng resibo.',
        });
        setIsReceiptFlowVisible(false);
        return;
      }

      const response = await sendReceiptOcrToBackend({
        accessToken,
        receiptId: draft.id,
        payload: {
          rawText: extraction.rawText,
          ocrBlocks: extraction.ocrBlocks,
          imageMeta: extraction.imageMeta,
          provider: extraction.provider,
        },
      });

      if (response.ocrQuality === 'weak') {
        setReceiptProcessingState({
          status: 'weak_text',
          receiptId: draft.id,
          extraction,
          message: 'Kaunti pa lang ang nabasang detalye. Pwede kang kumuha ulit ng mas malinaw na resibo.',
        });
      } else {
        setReceiptProcessingState({
          status: 'parsing_receipt',
          receiptId: draft.id,
        });

        const parsedReceipt = await parseReceiptOnBackend({
          accessToken,
          receiptId: draft.id,
          payload: {
            rawText: extraction.rawText,
          },
        });

        setReceiptProcessingState({
          status: 'matching_items',
          receiptId: draft.id,
        });

        const matchedReceipt = await matchReceiptOnBackend({
          accessToken,
          receiptId: draft.id,
          payload: {
            items: parsedReceipt.items,
          },
        });

        setReceiptReview(
          createReceiptReviewSession({
            receiptId: draft.id,
            merchantName: parsedReceipt.merchantName,
            receiptDate: parsedReceipt.receiptDate,
            subtotalAmount: parsedReceipt.subtotalAmount,
            taxAmount: parsedReceipt.taxAmount,
            totalAmount: parsedReceipt.totalAmount,
            items: matchedReceipt.items,
          }),
        );

        setReceiptProcessingState({
          status: 'succeeded',
          receiptId: draft.id,
          extraction,
          reviewStatus: 'ready_for_parse',
          message: 'Ayusin muna ang mga item bago ito ituloy.',
        });
      }

      setIsReceiptFlowVisible(false);
    } catch (error) {
      setReceiptProcessingState({
        status: 'failed',
        receiptId: draft.id,
        message: error instanceof Error ? error.message : 'Hindi natuloy ang pagbasa ng resibo.',
      });
      throw error;
    }
  }

  return (
    <>
      <ClientTabLayout
        label="Paninda"
        title="Dito mo mababantayan ang paninda."
        subtitle="Makikita mo rito ang bilang, malapit maubos, at mga naghihintay maipadala."
        highlights={[
          `${inventoryItems.length} produktong naka-lista`,
          showPending
            ? pendingTransactions.length > 0
              ? `${pendingTransactions.length} tala ang naghihintay ng internet`
              : 'Lahat ng tala ay naipadala na'
            : 'Mag-login para maipadala ang mga tala kapag may internet',
          'Pwede ka ring maghanda ng litrato ng resibo bago ito iproseso',
        ]}
      >
        <View style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <View style={styles.receiptIconWrap}>
              <Ionicons color={colors.primaryDeep} name="receipt-outline" size={20} />
            </View>
            <View style={styles.receiptHeaderBody}>
              <Text style={styles.receiptTitle}>Ihanda ang resibo ng restock</Text>
              <Text style={styles.receiptBody}>
                Kumuha o pumili ng malinaw na litrato ng resibo. Isi-save muna ito sa phone bago ang susunod na hakbang.
              </Text>
            </View>
          </View>

          <Pressable onPress={() => setIsReceiptFlowVisible(true)} style={styles.receiptButton}>
            <Ionicons color="#ffffff" name="camera-outline" size={18} />
            <Text style={styles.receiptButtonLabel}>
              {savedReceiptDraft ? 'Palitan ang resibo' : 'Kuhanan ang resibo'}
            </Text>
          </Pressable>

          {savedReceiptDraft ? (
            <View style={styles.savedReceiptCard}>
              <Text style={styles.savedReceiptTitle}>Huling larawang naihanda</Text>
              <Text style={styles.savedReceiptMeta}>
                {savedReceiptDraft.source === 'camera' ? 'Kinuha sa camera' : 'Galing sa gallery'}
              </Text>
              <Text style={styles.savedReceiptMeta}>
                {savedReceiptDraft.width} x {savedReceiptDraft.height} - {formatReceiptFileSize(savedReceiptDraft.fileSize)}
              </Text>
              <Text style={styles.savedReceiptMeta}>
                {savedReceiptDraft.qualityIssues.length > 0
                  ? `${savedReceiptDraft.qualityIssues.length} paalala bago iproseso`
                  : 'Mukhang malinaw ang kuha'}
              </Text>
            </View>
          ) : null}

          {receiptProcessingState.status === 'running_ocr' ||
          receiptProcessingState.status === 'uploading_ocr' ||
          receiptProcessingState.status === 'parsing_receipt' ||
          receiptProcessingState.status === 'matching_items' ? (
            <View style={styles.processingCard}>
              <Text style={styles.processingTitle}>
                {receiptProcessingState.status === 'running_ocr'
                  ? 'Binabasa ang resibo'
                  : receiptProcessingState.status === 'uploading_ocr'
                    ? 'Ipinapadala ang nabasang laman'
                    : receiptProcessingState.status === 'parsing_receipt'
                      ? 'Hinahanap ang mga item'
                      : 'Inuugnay sa listahan ng paninda'}
              </Text>
              <Text style={styles.processingBody}>Sandali lang habang inihahanda ang susunod na hakbang.</Text>
            </View>
          ) : null}

          {receiptProcessingState.status === 'succeeded' ? (
            <View style={styles.processingSuccessCard}>
              <Text style={styles.processingSuccessTitle}>Handa na ang unang basa ng resibo</Text>
              <Text style={styles.processingBody}>
                {receiptProcessingState.message ?? 'Naihanda na ang detalye ng resibo.'}
              </Text>
            </View>
          ) : null}

          {receiptProcessingState.status === 'weak_text' ? (
            <View style={styles.processingWarningCard}>
              <Text style={styles.processingWarningTitle}>Kulangan ang nabasang detalye</Text>
              <Text style={styles.processingBody}>{receiptProcessingState.message}</Text>
            </View>
          ) : null}

          {receiptProcessingState.status === 'failed' ? (
            <View style={styles.processingErrorCard}>
              <Text style={styles.processingErrorTitle}>Hindi natuloy ang pagbasa ng resibo</Text>
              <Text style={styles.processingBody}>{receiptProcessingState.message}</Text>
            </View>
          ) : null}
        </View>

        {receiptReview ? (
          <ReceiptReviewPanel
            review={receiptReview}
            inventoryItems={inventoryItems}
            onUpdateItem={updateReviewItem}
            onToggleMatchPicker={setMatchPickerOpen}
            onToggleCreateProduct={setCreateProductOpen}
          />
        ) : null}

        {reviewSummary && reviewSummary.unresolvedCount === 0 ? (
          <View style={styles.reviewReadyCard}>
            <Text style={styles.reviewReadyTitle}>Handa na ang listahan ng item</Text>
            <Text style={styles.processingBody}>
              Napili na ang gagawing paninda, bagong item, o mga hindi isasama. Ang susunod na hakbang ay pag-save ng napiling listahan.
            </Text>
          </View>
        ) : null}

        {showPendingPanel ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Naghihintay maipadala</Text>
            {pendingTransactions.slice(0, 5).map((transaction, index) => (
              <View
                key={transaction.id}
                style={[styles.row, index < Math.min(pendingTransactions.length, 5) - 1 ? styles.rowDivider : undefined]}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{transaction.rawText}</Text>
                  <Text style={styles.rowMeta}>{formatPendingLine(transaction.createdAt, transaction.source, transaction.intent)}</Text>
                  {transaction.primaryItemName && typeof transaction.primaryQuantityDelta === 'number' ? (
                    <Text style={styles.rowMeta}>
                      {transaction.primaryItemName} {transaction.primaryQuantityDelta > 0 ? '+' : ''}
                      {transaction.primaryQuantityDelta}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ClientTabLayout>

      <ReceiptCaptureFlow
        visible={isReceiptFlowVisible}
        onClose={() => setIsReceiptFlowVisible(false)}
        onSaveDraft={handleSaveReceiptDraft}
      />
    </>
  );
}

const styles = StyleSheet.create({
  receiptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d6ebe1',
    padding: 16,
    gap: 14,
  },
  receiptHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  receiptIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#edf7f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptHeaderBody: {
    flex: 1,
    gap: 4,
  },
  receiptTitle: {
    color: '#181d1b',
    fontSize: 16,
    fontWeight: '800',
  },
  receiptBody: {
    color: '#4d5a53',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  receiptButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#145746',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  receiptButtonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  savedReceiptCard: {
    borderRadius: 16,
    backgroundColor: '#f4faf6',
    borderWidth: 1,
    borderColor: '#d6ebe1',
    padding: 14,
    gap: 3,
  },
  savedReceiptTitle: {
    color: '#145746',
    fontSize: 13,
    fontWeight: '800',
  },
  savedReceiptMeta: {
    color: '#4d5a53',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  processingCard: {
    borderRadius: 16,
    backgroundColor: '#f2f7ff',
    borderWidth: 1,
    borderColor: '#c8daf8',
    padding: 14,
    gap: 4,
  },
  processingTitle: {
    color: '#164277',
    fontSize: 13,
    fontWeight: '800',
  },
  processingBody: {
    color: '#4d5a53',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  processingSuccessCard: {
    borderRadius: 16,
    backgroundColor: '#eef9f2',
    borderWidth: 1,
    borderColor: '#cfe6d7',
    padding: 14,
    gap: 4,
  },
  processingSuccessTitle: {
    color: '#145746',
    fontSize: 13,
    fontWeight: '800',
  },
  processingWarningCard: {
    borderRadius: 16,
    backgroundColor: '#fff6e6',
    borderWidth: 1,
    borderColor: '#f0d9a9',
    padding: 14,
    gap: 4,
  },
  processingWarningTitle: {
    color: '#6c4d00',
    fontSize: 13,
    fontWeight: '800',
  },
  processingErrorCard: {
    borderRadius: 16,
    backgroundColor: '#ffebe8',
    borderWidth: 1,
    borderColor: '#f4c7c0',
    padding: 14,
    gap: 4,
  },
  processingErrorTitle: {
    color: '#9b1c12',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewReadyCard: {
    borderRadius: 16,
    backgroundColor: '#eef9f2',
    borderWidth: 1,
    borderColor: '#cfe6d7',
    padding: 14,
    gap: 4,
  },
  reviewReadyTitle: {
    color: '#145746',
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ecebea',
    overflow: 'hidden',
  },
  cardTitle: {
    color: '#181d1b',
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f2f1f0',
  },
  rowBody: {
    gap: 3,
  },
  rowTitle: {
    color: '#181d1b',
    fontSize: 13,
    fontWeight: '700',
  },
  rowMeta: {
    color: '#4d5a53',
    fontSize: 12,
    fontWeight: '500',
  },
});
