import { StyleSheet, Text, View } from 'react-native';

import { ClientTabLayout } from '@/components/ClientTabLayout';
import { useLocalData } from '@/features/local-data/LocalDataContext';

function formatPendingLine(createdAt: string, source: string, intent: string | null) {
  const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const kind = intent === 'restock' ? 'dagdag' : intent === 'utang' ? 'utang' : 'bawas';
  const from = source === 'voice' ? 'boses' : source === 'manual' ? 'pindot' : 'sulat';

  return `${time} - ${kind} - ${from}`;
}

export function InventoryScreen() {
  const { appState, inventoryItems, pendingTransactions } = useLocalData();
  const showPending = appState?.mode === 'authenticated';
  const showPendingPanel = showPending && pendingTransactions.length > 0;

  return (
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
        'Madali mong makikita ang malapit maubos',
      ]}
    >
      {showPendingPanel ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Naghihintay maipadala</Text>
          {pendingTransactions.slice(0, 5).map((transaction, index) => (
            <View key={transaction.id} style={[styles.row, index < Math.min(pendingTransactions.length, 5) - 1 ? styles.rowDivider : undefined]}>
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
  );
}

const styles = StyleSheet.create({
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
  cardBody: {
    color: '#4d5a53',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingBottom: 14,
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
