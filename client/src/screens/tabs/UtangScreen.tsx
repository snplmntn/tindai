import { useMemo, useState } from 'react';

import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalData } from '@/features/local-data/LocalDataContext';
import type { LocalUtangCustomerLedger, LocalUtangEntrySummary } from '@/features/local-db/types';
import { colors } from '@/navigation/colors';

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

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === 'number' ? value : 0;
  return `P${amount.toFixed(2)}`;
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return 'Wala pa';
  }

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

function matchesCustomer(customer: LocalUtangCustomerLedger, query: string) {
  if (!query) {
    return true;
  }

  return (
    customer.customerName.toLowerCase().includes(query) ||
    customer.itemSummary.toLowerCase().includes(query)
  );
}

function matchesEntry(entry: LocalUtangEntrySummary, query: string) {
  if (!query) {
    return true;
  }

  return (
    entry.customerName.toLowerCase().includes(query) ||
    entry.itemSummary.toLowerCase().includes(query) ||
    (entry.note ?? '').toLowerCase().includes(query)
  );
}

export function UtangScreen() {
  const { store, utangCustomers, recentUtangEntries } = useLocalData();
  const [searchQuery, setSearchQuery] = useState('');
  const searchValue = normalizeSearchText(searchQuery);

  const filteredCustomers = useMemo(
    () => utangCustomers.filter((customer) => matchesCustomer(customer, searchValue)),
    [searchValue, utangCustomers],
  );
  const filteredEntries = useMemo(
    () => recentUtangEntries.filter((entry) => matchesEntry(entry, searchValue)),
    [recentUtangEntries, searchValue],
  );

  const totalUtang = useMemo(
    () => utangCustomers.reduce((sum, customer) => sum + customer.utangBalance, 0),
    [utangCustomers],
  );
  const pendingCount = useMemo(
    () => recentUtangEntries.filter((entry) => entry.syncStatus === 'pending').length,
    [recentUtangEntries],
  );

  const isEmpty = utangCustomers.length === 0 && recentUtangEntries.length === 0;
  const hasSearch = searchValue.length > 0;
  const hasResults = filteredCustomers.length > 0 || filteredEntries.length > 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.shell}>
            <View style={styles.headerRow}>
              <View style={styles.headerMenuButton}>
                <Ionicons color={colors.primaryDeep} name="receipt-outline" size={22} />
              </View>

              <Text style={styles.headerTitle}>Utang</Text>

              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>{getInitials(store?.name ?? 'Tindai')}</Text>
              </View>
            </View>

            <Text style={styles.headerSubtitle}>Silipin kung sino ang may utang at ano ang pinakahuling naitala.</Text>

            <View style={styles.searchField}>
              <Ionicons color={colors.muted} name="search-outline" size={18} />
              <TextInput
                testID="utang-search-input"
                autoCapitalize="words"
                onChangeText={setSearchQuery}
                placeholder="Hanapin ang pangalan o item"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Kabuuang utang</Text>
                <Text style={styles.summaryValue}>{formatMoney(totalUtang)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>May utang</Text>
                <Text style={styles.summaryValue}>{utangCustomers.length}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Pending sync</Text>
                <Text style={styles.summaryValue}>{pendingCount}</Text>
              </View>
            </View>

            {isEmpty ? (
              <View style={styles.emptyCard} testID="utang-empty-state">
                <View style={styles.emptyIconWrap}>
                  <Ionicons color={colors.primaryDeep} name="receipt-outline" size={24} />
                </View>
                <Text style={styles.emptyTitle}>Wala pang nakalistang utang</Text>
                <Text style={styles.emptyBody}>
                  Kapag may pinakuhang lista mula sa boses o sulat, lalabas dito ang pangalan at halaga.
                </Text>
              </View>
            ) : !hasResults && hasSearch ? (
              <View style={styles.emptyCard} testID="utang-no-results-state">
                <View style={styles.emptyIconWrap}>
                  <Ionicons color={colors.primaryDeep} name="search-outline" size={24} />
                </View>
                <Text style={styles.emptyTitle}>Walang tumugma</Text>
                <Text style={styles.emptyBody}>Subukan ang ibang pangalan o item na nakalista sa utang.</Text>
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Mga may utang</Text>
                  <Text style={styles.sectionMeta}>{filteredCustomers.length} customer</Text>
                </View>

                <View style={styles.customerList}>
                  {filteredCustomers.map((customer) => (
                    <View key={customer.customerId} style={styles.customerCard}>
                      <View style={styles.customerBody}>
                        <View style={styles.customerAvatar}>
                          <Text style={styles.customerAvatarText}>{getInitials(customer.customerName)}</Text>
                        </View>

                        <View style={styles.customerCopy}>
                          <View style={styles.customerTitleRow}>
                            <Text style={styles.customerName} testID={`utang-customer-name-${customer.customerId}`}>
                              {customer.customerName}
                            </Text>
                            <Text style={styles.customerAmount}>{formatMoney(customer.utangBalance)}</Text>
                          </View>

                          <Text style={styles.customerMeta}>
                            {customer.entryCount} lista • Huli: {formatUpdatedAt(customer.latestEntryAt)}
                          </Text>
                          <Text style={styles.customerItems}>{customer.itemSummary || 'Wala pang detalye ng item.'}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent na lista</Text>
                  <Text style={styles.sectionMeta}>{filteredEntries.length} entry</Text>
                </View>

                <View style={styles.entryList}>
                  {filteredEntries.map((entry) => {
                    const isPending = entry.syncStatus === 'pending';

                    return (
                      <View key={entry.entryId} style={styles.entryCard}>
                        <View style={styles.entryTopRow}>
                          <Text style={styles.entryCustomer}>{entry.customerName}</Text>
                          <Text style={styles.entryAmount}>{formatMoney(entry.amount)}</Text>
                        </View>

                        <Text style={styles.entryItems}>{entry.itemSummary || entry.note || 'Walang detalye'}</Text>

                        <View style={styles.entryBottomRow}>
                          <Text style={styles.entryTime}>{formatUpdatedAt(entry.createdAt)}</Text>
                          <View style={[styles.statusPill, isPending ? styles.statusPillPending : styles.statusPillSaved]}>
                            <Text style={styles.statusText}>{isPending ? 'Pending' : 'Saved'}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
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
    paddingBottom: 110,
  },
  shell: {
    gap: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerMenuButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headerTitle: {
    color: colors.primaryDeep,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  avatarBadge: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 16,
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
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryValue: {
    color: colors.primaryDeep,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  customerList: {
    gap: 12,
  },
  customerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    padding: 14,
  },
  customerBody: {
    flexDirection: 'row',
    gap: 12,
  },
  customerAvatar: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  customerAvatarText: {
    color: colors.primaryDeep,
    fontSize: 16,
    fontWeight: '800',
  },
  customerCopy: {
    flex: 1,
    gap: 6,
  },
  customerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  customerName: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  customerAmount: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '800',
  },
  customerMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  customerItems: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  entryList: {
    gap: 12,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  entryTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  entryCustomer: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  entryAmount: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '800',
  },
  entryItems: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  entryBottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  entryTime: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillPending: {
    backgroundColor: colors.secondary,
  },
  statusPillSaved: {
    backgroundColor: colors.card,
  },
  statusText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
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
});
