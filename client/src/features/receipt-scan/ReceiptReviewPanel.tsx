import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import type { LocalInventoryItem } from '@/features/local-db/types';
import {
  filterInventoryMatches,
  getReceiptReviewSummary,
  type ReceiptReviewItemDraft,
  type ReceiptReviewSession,
} from '@/features/receipt-scan/receiptReview';
import { colors } from '@/navigation/colors';

function formatMoney(amount: number | null) {
  return typeof amount === 'number' ? `PHP ${amount.toFixed(2)}` : 'Wala pa';
}

function getStatusLabel(item: ReceiptReviewItemDraft) {
  if (item.resolution === 'SKIP') return 'Hindi isasama';
  if (item.resolution === 'CREATE_PRODUCT') return 'Bagong paninda';
  if (item.resolution === 'MATCH_EXISTING') return item.matchStatus === 'HIGH_CONFIDENCE' ? 'Tugma na' : 'Pinili sa listahan';
  if (item.matchStatus === 'HIGH_CONFIDENCE') return 'Malakas ang tugma';
  if (item.matchStatus === 'NEEDS_REVIEW') return 'Paki-check';
  return 'Walang tugma';
}

function getStatusStyle(item: ReceiptReviewItemDraft) {
  if (item.resolution === 'SKIP') return styles.statusMuted;
  if (item.resolution === 'CREATE_PRODUCT' || item.resolution === 'MATCH_EXISTING' || item.matchStatus === 'HIGH_CONFIDENCE') {
    return styles.statusGood;
  }
  if (item.matchStatus === 'NEEDS_REVIEW') return styles.statusWarn;
  return styles.statusBad;
}

export function ReceiptReviewPanel({
  review,
  inventoryItems,
  onUpdateItem,
  onToggleMatchPicker,
  onToggleCreateProduct,
}: {
  review: ReceiptReviewSession;
  inventoryItems: LocalInventoryItem[];
  onUpdateItem: (receiptItemId: string, updater: (item: ReceiptReviewItemDraft) => ReceiptReviewItemDraft) => void;
  onToggleMatchPicker: (receiptItemId: string, open: boolean) => void;
  onToggleCreateProduct: (receiptItemId: string, open: boolean) => void;
}) {
  const summary = getReceiptReviewSummary(review.items);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Ayusin ang mga item sa resibo</Text>
          <Text style={styles.subtitle}>I-check ang dami, presyo, at napiling paninda bago ito ituloy.</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{review.items.length} item</Text>
        </View>
      </View>

      <Text style={styles.meta}>Tindahan: {review.merchantName ?? 'Walang pangalan'}</Text>
      <Text style={styles.meta}>Petsa: {review.receiptDate ?? 'Walang petsa'}</Text>
      <Text style={styles.meta}>Kabuuan: {formatMoney(review.totalAmount)}</Text>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>{summary.matchedCount} tugma na</Text>
        <Text style={styles.summaryText}>{summary.createCount} bagong paninda</Text>
        <Text style={styles.summaryText}>{summary.skippedCount} hindi isasama</Text>
        <Text style={[styles.summaryText, summary.unresolvedCount > 0 ? styles.summaryWarn : undefined]}>
          {summary.unresolvedCount} kailangang ayusin
        </Text>
      </View>

      {summary.unresolvedCount > 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>May mga item pang kailangang piliin</Text>
          <Text style={styles.noticeBody}>Pumili ng kasalukuyang paninda, gumawa ng bago, o markahang hindi isasama.</Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemList}>
        {review.items.map((item) => {
          const options = filterInventoryMatches(inventoryItems, item.matchSearchText || item.selectedProductName || item.rawName);

          return (
            <View key={item.receiptItemId} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemHeaderBody}>
                  <Text style={styles.itemTitle}>{item.rawName}</Text>
                  <Text style={styles.itemMeta}>Nabasa bilang: {item.normalizedName || 'wala pa'}</Text>
                </View>
                <View style={[styles.statusChip, getStatusStyle(item)]}>
                  <Text style={styles.statusText}>{getStatusLabel(item)}</Text>
                </View>
              </View>

              <TextInput
                value={item.quantityText}
                onChangeText={(value) => onUpdateItem(item.receiptItemId, (current) => ({ ...current, quantityText: value }))}
                keyboardType="decimal-pad"
                placeholder="Dami"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={item.unitPriceText}
                onChangeText={(value) => onUpdateItem(item.receiptItemId, (current) => ({ ...current, unitPriceText: value }))}
                keyboardType="decimal-pad"
                placeholder="Presyo bawat isa"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={item.lineTotalText}
                onChangeText={(value) => onUpdateItem(item.receiptItemId, (current) => ({ ...current, lineTotalText: value }))}
                keyboardType="decimal-pad"
                placeholder="Kabuuang presyo"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <View style={styles.selection}>
                <Text style={styles.selectionTitle}>
                  {item.resolution === 'CREATE_PRODUCT'
                    ? 'Gagawing bagong paninda'
                    : item.resolution === 'SKIP'
                      ? 'Hindi isasama sa save'
                      : item.selectedProductName
                        ? 'Napiling paninda'
                        : 'Wala pang napiling paninda'}
                </Text>
                <Text style={styles.selectionMeta}>
                  {item.resolution === 'CREATE_PRODUCT' ? item.newProductName : item.selectedProductName ?? 'Pumili mula sa listahan'}
                </Text>
              </View>

              <PrimaryButton label={item.isMatchPickerOpen ? 'Itago ang listahan' : 'Piliin sa listahan'} onPress={() => onToggleMatchPicker(item.receiptItemId, !item.isMatchPickerOpen)} variant="ghost" leadingIcon={<Ionicons color={colors.primaryDeep} name="search-outline" size={16} />} />
              <PrimaryButton label={item.isCreateProductOpen ? 'Itago ang bagong paninda' : 'Bagong paninda'} onPress={() => onToggleCreateProduct(item.receiptItemId, !item.isCreateProductOpen)} variant="ghost" leadingIcon={<Ionicons color={colors.primaryDeep} name="add-circle-outline" size={16} />} />
              <PrimaryButton
                label={item.resolution === 'SKIP' ? 'Ibalik sa review' : 'Huwag isama'}
                onPress={() => onUpdateItem(item.receiptItemId, (current) => ({ ...current, resolution: current.resolution === 'SKIP' ? 'UNRESOLVED' : 'SKIP', isCreateProductOpen: false, isMatchPickerOpen: false }))}
                variant="ghost"
                leadingIcon={<Ionicons color={colors.primaryDeep} name="remove-circle-outline" size={16} />}
              />

              {item.isMatchPickerOpen ? (
                <View style={styles.editor}>
                  <TextInput
                    value={item.matchSearchText}
                    onChangeText={(value) => onUpdateItem(item.receiptItemId, (current) => ({ ...current, matchSearchText: value }))}
                    placeholder="Maghanap ng paninda"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                  {options.map((candidate) => (
                    <Pressable
                      key={candidate.id}
                      onPress={() =>
                        onUpdateItem(item.receiptItemId, (current) => ({
                          ...current,
                          selectedProductId: candidate.id,
                          selectedProductName: candidate.name,
                          selectedProductSku: null,
                          matchedAlias: candidate.aliases[0] ?? candidate.name,
                          resolution: 'MATCH_EXISTING',
                          isMatchPickerOpen: false,
                          isCreateProductOpen: false,
                        }))
                      }
                      style={styles.option}
                    >
                      <Text style={styles.optionTitle}>{candidate.name}</Text>
                      <Text style={styles.optionMeta}>{candidate.aliases.slice(0, 2).join(', ') || 'Walang alias'}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {item.isCreateProductOpen ? (
                <View style={styles.editor}>
                  <TextInput
                    value={item.newProductName}
                    onChangeText={(value) => onUpdateItem(item.receiptItemId, (current) => ({ ...current, newProductName: value }))}
                    placeholder="Pangalan ng bagong paninda"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                  <PrimaryButton
                    label="Gamitin bilang bagong paninda"
                    onPress={() =>
                      onUpdateItem(item.receiptItemId, (current) => ({
                        ...current,
                        resolution: 'CREATE_PRODUCT',
                        newProductName: current.newProductName.trim() || current.rawName,
                        selectedProductId: null,
                        selectedProductName: null,
                        selectedProductSku: null,
                        isCreateProductOpen: false,
                        isMatchPickerOpen: false,
                      }))
                    }
                    leadingIcon={<Ionicons color={colors.surface} name="checkmark-outline" size={16} />}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2ebe7', padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  headerBody: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#edf7f1', paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: colors.primaryDeep, fontSize: 12, fontWeight: '800' },
  meta: { color: '#4d5a53', fontSize: 12, fontWeight: '600' },
  summaryRow: { gap: 4 },
  summaryText: { color: colors.primaryDeep, fontSize: 12, fontWeight: '800' },
  summaryWarn: { color: '#8b5f00' },
  notice: { borderRadius: 16, backgroundColor: '#fff6e6', borderWidth: 1, borderColor: '#f0d9a9', padding: 14, gap: 4 },
  noticeTitle: { color: '#6c4d00', fontSize: 13, fontWeight: '800' },
  noticeBody: { color: '#6c4d00', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  itemList: { gap: 12 },
  itemCard: { width: 320, borderRadius: 18, borderWidth: 1, borderColor: '#dbe8e2', backgroundColor: '#fbfdfc', padding: 14, gap: 10 },
  itemHeader: { gap: 8 },
  itemHeaderBody: { gap: 3 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  itemMeta: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  statusChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  statusGood: { backgroundColor: '#1f7a63' },
  statusWarn: { backgroundColor: '#b67a00' },
  statusBad: { backgroundColor: '#9b1c12' },
  statusMuted: { backgroundColor: '#6d7a74' },
  input: { minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#ffffff', color: colors.text, paddingHorizontal: 12, fontSize: 14 },
  selection: { borderRadius: 14, backgroundColor: '#f4faf6', borderWidth: 1, borderColor: '#d6ebe1', padding: 12, gap: 3 },
  selectionTitle: { color: colors.primaryDeep, fontSize: 12, fontWeight: '800' },
  selectionMeta: { color: '#4d5a53', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  editor: { borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe8e2', padding: 12, gap: 8 },
  option: { borderRadius: 14, borderWidth: 1, borderColor: '#dbe8e2', backgroundColor: '#f7fbf8', paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  optionTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  optionMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '600' },
});
