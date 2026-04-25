import { useCallback, useEffect, useMemo, useState } from 'react';

import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalData } from '@/features/local-data/LocalDataContext';
import type { LocalInventoryItem } from '@/features/local-db/types';
import { mobileCopy } from '@/copy/mobileCopy';
import { colors } from '@/navigation/colors';

type SortMode = 'name' | 'stock_desc' | 'stock_asc';

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'TD';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function formatPendingLine(createdAt: string, source: string, intent: string | null) {
  const created = new Date(createdAt);
  const hour = String(created.getHours()).padStart(2, '0');
  const minute = String(created.getMinutes()).padStart(2, '0');
  const kind = intent === 'restock' ? 'dagdag' : intent === 'utang' ? 'utang' : 'bawas';
  const from = source === 'voice' ? 'boses' : source === 'manual' ? 'pindot' : 'sulat';

  return `${hour}:${minute} • ${kind} • ${from}`;
}

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === 'number' ? value : 0;
  return `P${amount.toFixed(2)}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  const month = date.toLocaleString('en-PH', { month: 'short' });
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month} ${day}, ${hour}:${minute}`;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(item: LocalInventoryItem, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [item.name, ...item.aliases].map((value) => value.toLowerCase());
  return haystack.some((value) => value.includes(query));
}

function isLowStock(item: LocalInventoryItem) {
  return item.currentStock <= item.lowStockThreshold;
}

function compareItems(a: LocalInventoryItem, b: LocalInventoryItem, sortMode: SortMode) {
  if (sortMode === 'stock_desc') {
    if (b.currentStock !== a.currentStock) {
      return b.currentStock - a.currentStock;
    }
  }

  if (sortMode === 'stock_asc') {
    if (a.currentStock !== b.currentStock) {
      return a.currentStock - b.currentStock;
    }
  }

  return a.name.localeCompare(b.name);
}

function getItemMetaLine(item: LocalInventoryItem) {
  const secondaryLabel =
    item.aliases.find((alias) => alias.trim().toLowerCase() !== item.name.trim().toLowerCase()) ?? 'paninda';

  return `${item.unit.toUpperCase()} • ${secondaryLabel}`;
}

export function InventoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const isFocused = useIsFocused();
  const {
    appState,
    store,
    inventoryItems,
    pendingTransactions,
    applyManualAdjustment,
    createLocalInventoryItem,
    updateInventoryItemMetadata,
    archiveLocalInventoryItem,
  } = useLocalData();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LocalInventoryItem | null>(null);
  const [manualAdjustingItemId, setManualAdjustingItemId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isAddItemVisible, setIsAddItemVisible] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('0');
  const [itemCost, setItemCost] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemFormError, setItemFormError] = useState<string | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isEditItemVisible, setIsEditItemVisible] = useState(false);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCost, setEditItemCost] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemThreshold, setEditItemThreshold] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  const [isArchivingItem, setIsArchivingItem] = useState(false);
  const searchValue = normalizeSearchText(searchQuery);
  const showPendingPanel = appState?.mode === 'authenticated' && pendingTransactions.length > 0;
  const effectiveInventoryItems = inventoryItems;
  const isEmptyInventory = effectiveInventoryItems.length === 0;
  const hasActiveSearch = searchValue.length > 0;
  const hasActiveFilters = hasActiveSearch || lowStockOnly || sortMode !== 'name';

  const filteredItems = useMemo(() => {
    return effectiveInventoryItems
      .filter((item) => matchesSearch(item, searchValue))
      .filter((item) => (lowStockOnly ? isLowStock(item) : true))
      .sort((a, b) => compareItems(a, b, sortMode));
  }, [effectiveInventoryItems, lowStockOnly, searchValue, sortMode]);

  const handleManualAdjust = useCallback(
    async (itemId: string, direction: -1 | 1) => {
      setManualAdjustingItemId(itemId);
      setFeedbackMessage(null);

      try {
        await applyManualAdjustment(itemId, direction);
        setFeedbackMessage('Nabago na ang bilang ng item.');
      } catch (caughtError) {
        setFeedbackMessage(caughtError instanceof Error ? caughtError.message : 'Hindi nabago ang bilang. Subukan ulit.');
      } finally {
        setManualAdjustingItemId(null);
      }
    },
    [applyManualAdjustment],
  );

  const handleOpenAddItem = useCallback(() => {
    setItemFormError(null);
    setItemName('');
    setItemQuantity('0');
    setItemCost('');
    setItemPrice('');
    setIsAddItemVisible(true);
  }, []);

  useEffect(() => {
    const requestId =
      typeof route.params === 'object' && route.params !== null && 'openAddItemRequestId' in route.params
        ? route.params.openAddItemRequestId
        : undefined;

    if (!isFocused || typeof requestId !== 'string' || requestId.length === 0) {
      return;
    }

    handleOpenAddItem();
    navigation.setParams({
      openAddItemRequestId: undefined,
    });
  }, [handleOpenAddItem, isFocused, navigation, route.params]);

  const handleOpenEditItem = useCallback(() => {
    if (!selectedItem) {
      return;
    }

    setEditFormError(null);
    setEditItemName(selectedItem.name);
    setEditItemCost(selectedItem.cost === null ? '' : String(selectedItem.cost));
    setEditItemPrice(String(selectedItem.price));
    setEditItemThreshold(String(selectedItem.lowStockThreshold));
    setIsEditItemVisible(true);
  }, [selectedItem]);

  const handleAddItem = useCallback(async () => {
    const trimmedName = itemName.trim();
    const quantity = Number(itemQuantity);
    const cost = Number(itemCost);
    const price = Number(itemPrice);

    if (!trimmedName) {
      setItemFormError('Ilagay ang pangalan ng item.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      setItemFormError('Ang quantity ay dapat zero o mas mataas.');
      return;
    }

    if (Number.isNaN(cost) || cost < 0) {
      setItemFormError('Ang cost price ay dapat zero o mas mataas.');
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setItemFormError('Ang selling price ay dapat zero o mas mataas.');
      return;
    }

    setItemFormError(null);
    setIsSavingItem(true);

    try {
      await createLocalInventoryItem({
        name: trimmedName,
        quantity,
        cost,
        price,
      });
      setItemName('');
      setItemQuantity('0');
      setItemCost('');
      setItemPrice('');
      setIsAddItemVisible(false);
      setFeedbackMessage('Naidagdag na ang item.');
    } catch (caughtError) {
      setItemFormError(caughtError instanceof Error ? caughtError.message : 'Hindi naidagdag ang item.');
    } finally {
      setIsSavingItem(false);
    }
  }, [createLocalInventoryItem, itemCost, itemName, itemPrice, itemQuantity]);

  const handleUpdateItem = useCallback(async () => {
    if (!selectedItem) {
      return;
    }

    const trimmedName = editItemName.trim();
    const cost = Number(editItemCost);
    const price = Number(editItemPrice);
    const lowStockThreshold = Number(editItemThreshold);

    if (!trimmedName) {
      setEditFormError('Ilagay ang pangalan ng item.');
      return;
    }

    if (Number.isNaN(cost) || cost < 0) {
      setEditFormError('Ang cost price ay dapat zero o mas mataas.');
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setEditFormError('Ang selling price ay dapat zero o mas mataas.');
      return;
    }

    if (Number.isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      setEditFormError('Ang low stock alert ay dapat zero o mas mataas.');
      return;
    }

    setEditFormError(null);
    setIsUpdatingItem(true);

    try {
      await updateInventoryItemMetadata({
        itemId: selectedItem.id,
        name: trimmedName,
        cost,
        price,
        lowStockThreshold,
      });
      setIsEditItemVisible(false);
      setSelectedItem(null);
      setFeedbackMessage('Na-update na ang detalye ng item.');
    } catch (caughtError) {
      setEditFormError(caughtError instanceof Error ? caughtError.message : 'Hindi na-update ang item.');
    } finally {
      setIsUpdatingItem(false);
    }
  }, [editItemCost, editItemName, editItemPrice, editItemThreshold, selectedItem, updateInventoryItemMetadata]);

  const handleArchiveItem = useCallback(async () => {
    if (!selectedItem) {
      return;
    }

    setIsArchivingItem(true);
    setFeedbackMessage(null);

    try {
      await archiveLocalInventoryItem(selectedItem.id);
      setIsEditItemVisible(false);
      setSelectedItem(null);
      setFeedbackMessage('Na-archive na ang item.');
    } catch (caughtError) {
      setFeedbackMessage(caughtError instanceof Error ? caughtError.message : 'Hindi na-archive ang item.');
    } finally {
      setIsArchivingItem(false);
    }
  }, [archiveLocalInventoryItem, selectedItem]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.shell}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{mobileCopy.inventoryTitle}</Text>

              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>{getInitials(store?.name ?? 'Tindai')}</Text>
              </View>
            </View>

            <Text style={styles.headerSubtitle}>Hanapin, silipin, at ayusin agad ang paninda sa tindahan.</Text>

            <View style={styles.searchField}>
              <Ionicons color={colors.muted} name="search-outline" size={18} />
              <TextInput
                testID="inventory-search-input"
                autoCapitalize="words"
                onChangeText={setSearchQuery}
                placeholder="Hanapin ang item o alias"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            {(lowStockOnly || sortMode !== 'name') && filteredItems.length > 0 ? (
              <View style={styles.activeFiltersRow}>
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    {sortMode === 'name'
                      ? 'A-Z'
                      : sortMode === 'stock_desc'
                        ? 'Stock high to low'
                        : 'Stock low to high'}
                  </Text>
                </View>
                {lowStockOnly ? (
                  <View style={styles.filterChip}>
                    <Text style={styles.filterChipText}>Low stock only</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {feedbackMessage ? (
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackText}>{feedbackMessage}</Text>
              </View>
            ) : null}

            {showPendingPanel ? (
              <View style={styles.pendingCard}>
                <Text style={styles.pendingTitle}>May naghihintay pa maipadala</Text>
                {pendingTransactions.slice(0, 3).map((transaction, index) => (
                  <View
                    key={transaction.id}
                    style={[
                      styles.pendingRow,
                      index < Math.min(pendingTransactions.length, 3) - 1 ? styles.pendingRowDivider : undefined,
                    ]}
                  >
                    <Text style={styles.pendingText}>{transaction.rawText}</Text>
                    <Text style={styles.pendingMeta}>
                      {formatPendingLine(transaction.createdAt, transaction.source, transaction.intent)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {filteredItems.length === 0 ? (
              <View
                style={styles.emptyCard}
                testID={isEmptyInventory && !hasActiveFilters ? 'inventory-empty-state' : 'inventory-no-results-state'}
              >
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    color={colors.primaryDeep}
                    name={isEmptyInventory && !hasActiveFilters ? 'cube-outline' : 'search-outline'}
                    size={24}
                  />
                </View>
                <Text style={styles.emptyTitle}>{isEmptyInventory && !hasActiveFilters ? 'Wala pang item' : 'Walang tumugma'}</Text>
                <Text style={styles.emptyBody}>
                  {isEmptyInventory && !hasActiveFilters
                    ? 'Magdagdag ng unang paninda para lumabas ang listahan dito.'
                    : 'Subukan ang ibang hanap o alisin ang low stock filter.'}
                </Text>
                {!isEmptyInventory || hasActiveFilters ? (
                  <Pressable
                    onPress={() => {
                      setSearchQuery('');
                      setLowStockOnly(false);
                      setSortMode('name');
                    }}
                    style={styles.emptyAction}
                  >
                    <Text style={styles.emptyActionText}>I-reset ang hanap</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.itemList}>
                {filteredItems.map((item) => (
                  <View key={item.id} style={styles.itemCard} testID={`item-card-${item.id}`}>
                    <Pressable
                      testID={`inventory-open-item-${item.id}`}
                      onPress={() => setSelectedItem(item)}
                      style={styles.itemBody}
                    >
                      <View style={styles.itemAvatar}>
                        <Text style={styles.itemAvatarText}>{getInitials(item.name)}</Text>
                      </View>

                      <View style={styles.itemCopy}>
                        <View style={styles.itemTitleRow}>
                          <Text style={styles.itemName} testID={`item-name-${item.id}`}>
                            {item.name}
                          </Text>
                          <Text style={styles.itemPrice}>{formatMoney(item.price)}</Text>
                        </View>

                        <Text style={styles.itemMeta}>{getItemMetaLine(item)}</Text>

                        <View style={styles.itemStockRow}>
                          <Text style={styles.itemStock}>{item.currentStock} in stock</Text>
                          {isLowStock(item) ? (
                            <View style={styles.lowStockBadge}>
                              <Text style={styles.lowStockBadgeText}>Low stock</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>

                    <View style={styles.adjustRow}>
                      <Pressable
                        testID={`inventory-adjust-minus-${item.id}`}
                        accessibilityRole="button"
                        onPress={() => void handleManualAdjust(item.id, -1)}
                        style={styles.adjustButton}
                      >
                        <Ionicons color="#FFFFFF" name="remove" size={16} />
                      </Pressable>
                      <Pressable
                        testID={`inventory-adjust-plus-${item.id}`}
                        accessibilityRole="button"
                        onPress={() => void handleManualAdjust(item.id, 1)}
                        style={styles.adjustButton}
                      >
                        {manualAdjustingItemId === item.id ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Ionicons color="#FFFFFF" name="add" size={16} />
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <Pressable
          testID="inventory-add-open-button"
          accessibilityRole="button"
          onPress={handleOpenAddItem}
          style={styles.fab}
        >
          <Ionicons color="#FFFFFF" name="add" size={22} />
        </Pressable>
      </View>

      <Modal animationType="slide" transparent visible={isFilterVisible} onRequestClose={() => setIsFilterVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Ayusin ang listahan</Text>

            <Text style={styles.sheetLabel}>Sort</Text>
            <View style={styles.optionStack}>
              {[
                { key: 'name' as const, label: 'A-Z', testID: 'inventory-sort-name' },
                { key: 'stock_desc' as const, label: 'Stock high to low', testID: 'inventory-sort-stock-desc' },
                { key: 'stock_asc' as const, label: 'Stock low to high', testID: 'inventory-sort-stock-asc' },
              ].map((option) => {
                const isActive = sortMode === option.key;

                return (
                  <Pressable
                    key={option.key}
                    testID={option.testID}
                    accessibilityRole="button"
                    onPress={() => setSortMode(option.key)}
                    style={[styles.optionButton, isActive ? styles.optionButtonActive : undefined]}
                  >
                    <Text style={[styles.optionText, isActive ? styles.optionTextActive : undefined]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>Filter</Text>
            <Pressable
              testID="inventory-low-stock-toggle"
              accessibilityRole="button"
              onPress={() => setLowStockOnly((current) => !current)}
              style={[styles.toggleRow, lowStockOnly ? styles.toggleRowActive : undefined]}
            >
              <View>
                <Text style={styles.toggleTitle}>Low stock only</Text>
                <Text style={styles.toggleBody}>Ipakita lang ang kailangan bantayan.</Text>
              </View>
              <View style={[styles.togglePill, lowStockOnly ? styles.togglePillActive : undefined]}>
                <View style={[styles.toggleKnob, lowStockOnly ? styles.toggleKnobActive : undefined]} />
              </View>
            </Pressable>

            <View style={styles.sheetActions}>
              <Pressable onPress={() => setIsFilterVisible(false)} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Isara</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={isAddItemVisible} onRequestClose={() => setIsAddItemVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Magdagdag ng item</Text>

            <Text style={styles.sheetLabel}>Pangalan ng item</Text>
            <TextInput
              testID="inventory-add-name-input"
              autoCapitalize="words"
              onChangeText={setItemName}
              placeholder="Hal. Bear Brand"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
              value={itemName}
            />

            <Text style={styles.sheetLabel}>Quantity</Text>
            <TextInput
              testID="inventory-add-quantity-input"
              keyboardType="number-pad"
              onChangeText={setItemQuantity}
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
              value={itemQuantity}
            />

            <Text style={styles.sheetLabel}>Cost price</Text>
            <TextInput
              testID="inventory-add-cost-input"
              keyboardType="decimal-pad"
              onChangeText={setItemCost}
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
              value={itemCost}
            />

            <Text style={styles.sheetLabel}>Selling price</Text>
            <TextInput
              testID="inventory-add-price-input"
              keyboardType="decimal-pad"
              onChangeText={setItemPrice}
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
              value={itemPrice}
            />

            {itemFormError ? <Text style={styles.formErrorText}>{itemFormError}</Text> : null}

            <View style={styles.sheetActions}>
              <Pressable onPress={() => setIsAddItemVisible(false)} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Kanselahin</Text>
              </Pressable>
              <Pressable
                testID="inventory-add-submit-button"
                onPress={() => void handleAddItem()}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionText}>{isSavingItem ? 'Nagse-save...' : 'I-save ang item'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isEditItemVisible}
        onRequestClose={() => setIsEditItemVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Ayusin ang detalye</Text>

            <Text style={styles.sheetLabel}>Pangalan ng item</Text>
            <TextInput
              testID="inventory-edit-name-input"
              autoCapitalize="words"
              onChangeText={setEditItemName}
              placeholder="Hal. Bear Brand"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
              value={editItemName}
            />

            <Text style={styles.sheetLabel}>Cost price</Text>
            <TextInput
              testID="inventory-edit-cost-input"
              keyboardType="decimal-pad"
              onChangeText={setEditItemCost}
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
              value={editItemCost}
            />

            <Text style={styles.sheetLabel}>Selling price</Text>
            <TextInput
              testID="inventory-edit-price-input"
              keyboardType="decimal-pad"
              onChangeText={setEditItemPrice}
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
              value={editItemPrice}
            />

            <Text style={styles.sheetLabel}>Low stock alert</Text>
            <TextInput
              testID="inventory-edit-threshold-input"
              keyboardType="number-pad"
              onChangeText={setEditItemThreshold}
              placeholder="0"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
              value={editItemThreshold}
            />

            {editFormError ? <Text style={styles.formErrorText}>{editFormError}</Text> : null}

            <View style={styles.sheetActions}>
              <Pressable onPress={() => setIsEditItemVisible(false)} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Kanselahin</Text>
              </Pressable>
              <Pressable
                testID="inventory-edit-submit-button"
                onPress={() => void handleUpdateItem()}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionText}>{isUpdatingItem ? 'Sine-save...' : 'I-save ang detalye'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={selectedItem !== null} onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{selectedItem?.name ?? 'Detalye ng item'}</Text>

            {selectedItem ? (
              <View style={styles.detailStack}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Aliases</Text>
                  <Text style={styles.detailValue}>{selectedItem.aliases.join(', ') || 'Wala pa'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Stock</Text>
                  <Text style={styles.detailValue}>
                    {selectedItem.currentStock} {selectedItem.unit}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Price</Text>
                  <Text style={styles.detailValue}>{formatMoney(selectedItem.price)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cost</Text>
                  <Text style={styles.detailValue}>
                    {selectedItem.cost === null ? 'Wala pa' : formatMoney(selectedItem.cost)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Na-update</Text>
                  <Text style={styles.detailValue}>{formatUpdatedAt(selectedItem.updatedAt)}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.sheetActions}>
              <Pressable testID="inventory-edit-open-button" onPress={handleOpenEditItem} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>I-edit</Text>
              </Pressable>
              <Pressable
                testID="inventory-archive-button"
                onPress={() => void handleArchiveItem()}
                style={styles.dangerAction}
              >
                <Text style={styles.dangerActionText}>{isArchivingItem ? 'Ina-archive...' : 'I-archive'}</Text>
              </Pressable>
              <Pressable onPress={() => setSelectedItem(null)} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Isara</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 120,
  },
  shell: {
    gap: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.primaryDeep,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  avatarBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarBadgeText: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '600',
  },
  pendingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pendingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  pendingRow: {
    gap: 4,
    paddingVertical: 10,
  },
  pendingRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  pendingText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pendingMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  emptyIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyAction: {
    backgroundColor: colors.primaryDeep,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  itemList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    padding: 14,
  },
  itemBody: {
    flexDirection: 'row',
    gap: 12,
  },
  itemAvatar: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  itemAvatarText: {
    color: colors.primaryDeep,
    fontSize: 16,
    fontWeight: '800',
  },
  itemCopy: {
    flex: 1,
    gap: 6,
  },
  itemTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  itemName: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  itemPrice: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '800',
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  itemStockRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemStock: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  lowStockBadge: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lowStockBadgeText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  adjustButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    bottom: 28,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    shadowColor: colors.primaryDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: 56,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(19, 42, 34, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 18,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  sheetLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  optionStack: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionButtonActive: {
    backgroundColor: colors.card,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextActive: {
    color: colors.primaryDeep,
    fontWeight: '800',
  },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toggleRowActive: {
    backgroundColor: colors.card,
    borderColor: colors.primary,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleBody: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  togglePill: {
    backgroundColor: 'rgba(31, 122, 99, 0.16)',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 46,
  },
  togglePillActive: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  formInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  formErrorText: {
    color: '#9B1C12',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dangerAction: {
    alignItems: 'center',
    backgroundColor: '#FEE7E7',
    borderRadius: 16,
    justifyContent: 'center',
    minWidth: 112,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dangerActionText: {
    color: '#A12A2A',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors.primaryDeep,
    borderRadius: 16,
    justifyContent: 'center',
    minWidth: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  detailStack: {
    gap: 12,
  },
  detailRow: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
    padding: 14,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
});
