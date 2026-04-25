import { type ReactNode, useState } from 'react';

import { Ionicons } from '@expo/vector-icons';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/navigation/colors';

import { ForecastSparklineChart, InsightsTrendLineChart, SalesTrendBarChart } from './AnalyticsCharts';
import type {
  AnalyticsChartPoint,
  AnalyticsListItem,
  AnalyticsShoppingListItem,
  AnalyticsShoppingPreset,
  AnalyticsShoppingPresetKey,
  AnalyticsViewModel,
} from './buildAnalyticsViewModel';

type AnalyticsTabKey = 'Overview' | 'Insights' | 'Predictions & AI';

type AnalyticsViewProps = {
  storeName: string;
  activeTab: AnalyticsTabKey;
  onTabChange: (tab: AnalyticsTabKey) => void;
  onRefresh: () => void;
  viewModel: AnalyticsViewModel;
  isLoading: boolean;
  isRefreshing: boolean;
  showSkeleton: boolean;
  error: string | null;
  emptyState: {
    title: string;
    body: string;
    actionLabel: string;
    onAction: () => void;
  } | null;
};

const tabs: AnalyticsTabKey[] = ['Overview', 'Insights', 'Predictions & AI'];

export function AnalyticsView({
  storeName,
  activeTab,
  onTabChange,
  onRefresh,
  viewModel,
  isLoading,
  isRefreshing,
  showSkeleton,
  error,
  emptyState,
}: AnalyticsViewProps) {
  const headerTitle = activeTab === 'Insights' ? 'Mga Insight' : 'Galaw ng Tindahan';
  const showContentEmptyState = !showSkeleton && emptyState !== null;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={isRefreshing}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <View style={styles.shell}>
          <View style={styles.headerRow}>
            <View style={styles.headerMenuButton}>
              <Ionicons color={colors.primaryDeep} name="menu-outline" size={26} />
            </View>

            <Text style={styles.headerTitle}>{headerTitle}</Text>

            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>{getInitials(storeName)}</Text>
            </View>
          </View>

          {!showContentEmptyState ? (
            <View style={styles.topTabRail}>
              {tabs.map((tab) => {
                const isActive = tab === activeTab;

                return (
                  <Pressable
                    key={tab}
                    accessibilityRole="button"
                    onPress={() => onTabChange(tab)}
                    style={styles.topTabButton}
                  >
                    <Text style={[styles.topTabText, isActive ? styles.topTabTextActive : undefined]}>{tab}</Text>
                    <View style={[styles.topTabUnderline, isActive ? styles.topTabUnderlineActive : undefined]} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>May problema sa pag-refresh</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {showSkeleton ? <LoadingSkeleton activeTab={activeTab} /> : null}
          {showContentEmptyState ? <EmptyAnalyticsState emptyState={emptyState} /> : null}
          {!showSkeleton && !showContentEmptyState && activeTab === 'Overview' ? (
            <OverviewTab isLoading={isLoading} viewModel={viewModel} />
          ) : null}
          {!showSkeleton && !showContentEmptyState && activeTab === 'Insights' ? (
            <InsightsTab isLoading={isLoading} viewModel={viewModel} />
          ) : null}
          {!showSkeleton && !showContentEmptyState && activeTab === 'Predictions & AI' ? (
            <PredictionsTab isLoading={isLoading} viewModel={viewModel} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyAnalyticsState({
  emptyState,
}: {
  emptyState: NonNullable<AnalyticsViewProps['emptyState']>;
}) {
  return (
    <View style={styles.emptyStateCard}>
      <View style={styles.emptyStateIconWrap}>
        <Ionicons color={colors.primaryDeep} name="bar-chart-outline" size={24} />
      </View>
      <Text style={styles.emptyStateTitle}>{emptyState.title}</Text>
      <Text style={styles.emptyStateBody}>{emptyState.body}</Text>
      <Pressable accessibilityRole="button" onPress={emptyState.onAction} style={styles.emptyStateAction}>
        <Text style={styles.emptyStateActionText}>{emptyState.actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function LoadingSkeleton({ activeTab }: { activeTab: AnalyticsTabKey }) {
  return (
    <View style={styles.tabStack}>
      <View style={styles.skeletonBanner}>
        <View style={[styles.skeletonBlock, styles.skeletonIcon]} />
        <View style={styles.skeletonBannerLines}>
          <View style={[styles.skeletonBlock, styles.skeletonLineWide]} />
          <View style={[styles.skeletonBlock, styles.skeletonLineFull]} />
          <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
        </View>
      </View>

      <Text style={styles.skeletonHint}>Kinukuha ang datos...</Text>

      <View style={styles.metricGrid}>
        <View style={styles.skeletonMetricCard}>
          <View style={[styles.skeletonBlock, styles.skeletonMetricLabel]} />
          <View style={[styles.skeletonBlock, styles.skeletonMetricValue]} />
          <View style={[styles.skeletonBlock, styles.skeletonMetricCaption]} />
        </View>
        <View style={styles.skeletonMetricCard}>
          <View style={[styles.skeletonBlock, styles.skeletonMetricLabel]} />
          <View style={[styles.skeletonBlock, styles.skeletonMetricValue]} />
          <View style={[styles.skeletonBlock, styles.skeletonMetricCaption]} />
        </View>
      </View>

      <View style={styles.cardSurface}>
        <View style={[styles.skeletonBlock, styles.skeletonSectionTitle]} />
        <View style={[styles.skeletonBlock, styles.skeletonChart]} />
      </View>

      <View style={styles.cardSurface}>
        <View style={[styles.skeletonBlock, styles.skeletonSectionTitle]} />
        <View style={[styles.skeletonBlock, styles.skeletonListRow]} />
        <View style={[styles.skeletonBlock, styles.skeletonListRow]} />
        {activeTab === 'Predictions & AI' ? <View style={[styles.skeletonBlock, styles.skeletonListRow]} /> : null}
      </View>
    </View>
  );
}

function OverviewTab({
  viewModel,
  isLoading,
}: {
  viewModel: AnalyticsViewProps['viewModel'];
  isLoading: boolean;
}) {
  const focusItem = viewModel.overview.lowStock[0] ?? viewModel.overview.topSelling[0] ?? null;
  const insightBody = focusItem
    ? `${focusItem.itemName} ang kapansin-pansin ngayon. ${focusItem.detail}`
    : 'Magkakaroon ng mas malinaw na buod kapag may naitala nang benta.';

  return (
    <View style={styles.tabStack}>
      <InsightBanner
        body={insightBody}
        label={isLoading ? 'Ina-update ang buod' : 'Payo ni Tindai'}
        title="Buod"
      />

      <View style={styles.metricGrid}>
        <MetricCard
          caption={viewModel.overview.salesToday.caption}
          label="Benta ngayong araw"
          value={viewModel.overview.salesToday.value}
        />
        <MetricCard
          caption={viewModel.overview.itemsSoldToday.caption}
          label="Bilang ng naibenta"
          value={viewModel.overview.itemsSoldToday.value}
        />
      </View>

      <CardSurface>
        <SectionHeader eyebrow="Huling 7 araw" title="Takbo ng benta" />
        <SalesTrendBarChart points={viewModel.insights.salesTrend} />
      </CardSurface>

      <CardSurface>
        <SectionHeader actionLabel="Tingnan lahat" title="Pinakamabentang item" />
        <SellingList items={viewModel.overview.topSelling} />
      </CardSurface>

      <CardSurface>
        <SectionHeader title="Paubos na" />
        <SellingList emptyText="Wala pang paubos na item ngayon." items={viewModel.overview.lowStock} />
      </CardSurface>

      <CardSurface>
        <SectionHeader title="May utang pa" />
        <UtangSummary
          customers={viewModel.overview.utangSummary.topCustomers}
          totalBalance={viewModel.overview.utangSummary.totalBalance}
        />
      </CardSurface>
    </View>
  );
}

function InsightsTab({
  viewModel,
  isLoading,
}: {
  viewModel: AnalyticsViewProps['viewModel'];
  isLoading: boolean;
}) {
  const leadItem = viewModel.insights.risingDemand[0] ?? viewModel.insights.decliningDemand[0] ?? null;
  const insightBody = leadItem
    ? `${leadItem.itemName} ang may pinakamalinaw na galaw ngayon. ${leadItem.detail}`
    : viewModel.insights.emptyState ?? 'Mas lilinaw ang galaw ng paninda kapag dumami na ang naitalang benta.';
  const signalCount = viewModel.insights.risingDemand.length + viewModel.insights.decliningDemand.length;

  return (
    <View style={styles.tabStack}>
      <InsightBanner
        body={insightBody}
        label={isLoading ? 'Ina-update ang mga insight' : 'Payo ni Tindai'}
        title="Mga Insight"
      />

      <View style={styles.metricGrid}>
        <MetricCard
          caption={viewModel.overview.salesToday.caption}
          label="Benta ngayong araw"
          value={viewModel.overview.salesToday.value}
        />
        <MetricCard
          caption="Mga item na may malinaw na galaw"
          label="Mga naibenta"
          value={`${signalCount || viewModel.overview.fastMoving.length || viewModel.overview.slowMoving.length}`}
        />
      </View>

      <CardSurface>
        <SectionHeader eyebrow="Huling 7 araw" title="Takbo ng benta" />
        <InsightsTrendLineChart points={viewModel.insights.salesTrend} />
      </CardSurface>

      <CardSurface>
        <SectionHeader actionLabel="Tingnan lahat" title="Mabilis at mabagal gumalaw" />
        <View style={styles.dualListGrid}>
          <MovementColumn
            emptyText="Wala pang mabilis maubos."
            items={viewModel.overview.fastMoving.length > 0 ? viewModel.overview.fastMoving : viewModel.insights.risingDemand}
            title="Fast Movers"
            tone="positive"
          />
          <MovementColumn
            emptyText="Wala pang mabagal gumalaw."
            items={viewModel.overview.slowMoving.length > 0 ? viewModel.overview.slowMoving : viewModel.insights.decliningDemand}
            title="Slow Movers"
            tone="warning"
          />
        </View>
      </CardSurface>

      <CardSurface>
        <SectionHeader title="Pagbabago ng galaw" />
        <TrendDetectionList emptyText={viewModel.insights.emptyState ?? 'Wala pang nakikitang pagbabago sa galaw ng benta.'} points={viewModel.insights.demandTrend} />
      </CardSurface>
    </View>
  );
}

function PredictionsTab({
  viewModel,
  isLoading,
}: {
  viewModel: AnalyticsViewProps['viewModel'];
  isLoading: boolean;
}) {
  const [selectedPreset, setSelectedPreset] = useState<AnalyticsShoppingPresetKey>('7d');
  const leadItem = viewModel.predictions.restockSoon[0] ?? viewModel.predictions.forecast[0] ?? null;
  const predictionItems = mergePredictionItems(viewModel.predictions.forecast, viewModel.predictions.restockSoon);
  const activePreset =
    viewModel.predictions.shoppingPresets.find((preset) => preset.key === selectedPreset) ??
    viewModel.predictions.shoppingPresets[0];
  const shoppingItems = activePreset ? viewModel.predictions.shoppingListByPreset[activePreset.key] ?? [] : [];
  const summaryTone =
    viewModel.predictions.modelStatus === 'gemini_enriched'
      ? 'AI-enriched forecast'
      : isLoading
        ? 'Refreshing local forecast'
        : 'Lokal na forecast';

  return (
    <View style={styles.tabStack}>
      <ForecastHero
        body={
          leadItem
            ? leadItem.detail
            : viewModel.predictions.emptyState ?? 'Forecast cards will appear after a few days of local sales activity.'
        }
        summaryTone={summaryTone}
        title={leadItem ? leadItem.itemName : 'Forecasts are warming up'}
        trendPoints={viewModel.insights.salesTrend}
      />

      <CardSurface>
        <SectionHeader title="Susunod na bili" />
        <ShoppingPresetRail
          onSelect={setSelectedPreset}
          presets={viewModel.predictions.shoppingPresets}
          selectedPreset={activePreset?.key ?? '7d'}
        />
        <ShoppingList
          emptyText={
            viewModel.predictions.emptyState
              ? viewModel.predictions.emptyState
              : `You're stocked for the next ${activePreset?.days ?? 7} days based on recent sales.`
          }
          items={shoppingItems}
        />
      </CardSurface>

      <CardSurface>
        <SectionHeader title="Taya sa stock" />
        <PredictionList items={predictionItems} />
      </CardSurface>

      <CardSurface>
        <SectionHeader title="Buod ng mungkahi" />
        <RecommendationList recommendations={viewModel.predictions.recommendations} />
      </CardSurface>
    </View>
  );
}

function InsightBanner({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.insightBanner}>
      <View style={styles.insightIconTile}>
        <Ionicons color={colors.primaryDeep} name="bulb-outline" size={22} />
      </View>

      <View style={styles.insightContent}>
        <Text style={styles.insightBannerLabel}>{label}</Text>
        <Text style={styles.insightBannerTitle}>{title}</Text>
        <Text style={styles.insightBannerBody}>{body}</Text>
      </View>
    </View>
  );
}

function ForecastHero({
  title,
  body,
  summaryTone,
  trendPoints,
}: {
  title: string;
  body: string;
  summaryTone: string;
  trendPoints: AnalyticsChartPoint[];
}) {
  return (
    <View style={styles.forecastHero}>
      <View style={styles.forecastHeroText}>
        <View style={styles.forecastIconTile}>
          <Ionicons color={colors.primaryDeep} name="bulb-outline" size={22} />
        </View>
        <Text style={styles.forecastLabel}>Demand Forecasting</Text>
        <Text style={styles.forecastValue}>{title}</Text>
        <Text style={styles.forecastBody}>{body}</Text>
        <View style={styles.forecastPill}>
          <Text style={styles.forecastPillText}>{summaryTone}</Text>
        </View>
      </View>

      <ForecastSparklineChart points={trendPoints} />
    </View>
  );
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricCaption}>{caption}</Text>
    </View>
  );
}

function CardSurface({ children }: { children: ReactNode }) {
  return <View style={styles.cardSurface}>{children}</View>;
}

function SectionHeader({
  title,
  eyebrow,
  actionLabel,
}: {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
      {actionLabel ? <Text style={styles.sectionAction}>{actionLabel}</Text> : null}
    </View>
  );
}


function SellingList({
  items,
  emptyText = 'Wala pang naitalang galaw dito.',
}: {
  items: AnalyticsListItem[];
  emptyText?: string;
}) {
  return <SellingListInner emptyText={emptyText} items={items} />;
}

function SellingListInner({
  items,
  emptyText,
}: {
  items: AnalyticsListItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.listStack}>
      {items.map((item, index) => (
        <View key={`${item.itemId}-${item.itemName}`} style={styles.sellingRow}>
          <ProductAvatar itemName={item.itemName} tone={index === 0 ? 'positive' : 'default'} />
          <View style={styles.sellingMain}>
            <Text style={styles.rowTitle}>{item.itemName}</Text>
            <Text style={styles.rowSubtitle}>{item.detail}</Text>
          </View>
          <View style={styles.sellingMeta}>
            <Text style={styles.rankMeta}>{`TOP ${index + 1}`}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function UtangSummary({
  totalBalance,
  customers,
}: {
  totalBalance: string;
  customers: Array<{ customerName: string; balance: string }>;
}) {
  return (
    <View style={styles.recommendationStack}>
      <View style={styles.recommendationCard}>
        <Text style={styles.recommendationLead}>Outstanding total</Text>
        <Text style={styles.recommendationTitle}>{totalBalance}</Text>
        <Text style={styles.recommendationBody}>
          {customers.length > 0 ? 'Customers with open balances' : 'No open utang balance right now.'}
        </Text>
      </View>

      {customers.length > 0 ? (
        customers.map((customer) => (
          <View key={`${customer.customerName}-${customer.balance}`} style={styles.sellingRow}>
            <ProductAvatar itemName={customer.customerName} tone="warning" />
            <View style={styles.sellingMain}>
              <Text style={styles.rowTitle}>{customer.customerName}</Text>
              <Text style={styles.rowSubtitle}>Open balance</Text>
            </View>
            <View style={styles.sellingMeta}>
              <Text style={styles.rankMeta}>{customer.balance}</Text>
            </View>
          </View>
        ))
      ) : null}
    </View>
  );
}

function MovementColumn({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: AnalyticsListItem[];
  emptyText: string;
  tone: 'default' | 'warning' | 'positive';
}) {
  return (
    <View style={styles.movementColumn}>
      <Text style={styles.movementColumnTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <View style={styles.movementList}>
          {items.slice(0, 2).map((item) => (
            <View key={`${title}-${item.itemId}-${item.itemName}`} style={styles.movementRow}>
              <ProductAvatar itemName={item.itemName} tone={tone} />
              <View style={styles.movementText}>
                <Text style={styles.rowTitle}>{item.itemName}</Text>
                <Text style={styles.rowSubtitle}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TrendDetectionList({
  points,
  emptyText,
}: {
  points: AnalyticsChartPoint[];
  emptyText: string;
}) {
  if (points.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.trendList}>
      <Text style={styles.trendLead}>Rising and falling product signals</Text>
      {points.map((point) => (
        <View key={`${point.label}-${point.displayValue}`} style={styles.trendRow}>
          <View style={styles.trendBullet} />
          <Text style={styles.trendRowText}>
            {point.label}: {point.displayValue}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PredictionList({ items }: { items: AnalyticsListItem[] }) {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>Wala pang taya para sa stock.</Text>;
  }

  return (
    <View style={styles.listStack}>
      {items.map((item) => (
        <View key={`${item.itemId}-${item.itemName}`} style={styles.predictionRow}>
          <ProductAvatar itemName={item.itemName} tone={item.tone ?? 'default'} />
          <View style={styles.predictionMain}>
            <Text style={styles.rowTitle}>{item.itemName}</Text>
            <Text style={styles.rowSubtitle}>{item.detail}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={noop} style={styles.restockButton}>
            <Text style={styles.restockButtonText}>Suggest Restock</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function ShoppingPresetRail({
  presets,
  selectedPreset,
  onSelect,
}: {
  presets: AnalyticsShoppingPreset[];
  selectedPreset: AnalyticsShoppingPresetKey;
  onSelect: (preset: AnalyticsShoppingPresetKey) => void;
}) {
  return (
    <View style={styles.shoppingPresetRail}>
      {presets.map((preset) => {
        const isActive = preset.key === selectedPreset;

        return (
          <Pressable
            key={preset.key}
            accessibilityRole="button"
            onPress={() => onSelect(preset.key)}
            style={[styles.shoppingPresetChip, isActive ? styles.shoppingPresetChipActive : undefined]}
          >
            <Text style={[styles.shoppingPresetText, isActive ? styles.shoppingPresetTextActive : undefined]}>
              {preset.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ShoppingList({
  items,
  emptyText,
}: {
  items: AnalyticsShoppingListItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.listStack}>
      {items.map((item) => (
        <View key={`${item.itemId}-${item.horizonDays}`} style={styles.shoppingRow}>
          <ProductAvatar itemName={item.itemName} tone="warning" />
          <View style={styles.shoppingMain}>
            <Text style={styles.rowTitle}>{item.itemName}</Text>
            <Text style={styles.shoppingQuantity}>{`Buy ${item.recommendedBuyQuantity} ${item.unit}`}</Text>
            <Text style={styles.rowSubtitle}>{item.reason}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function RecommendationList({
  recommendations,
}: {
  recommendations: AnalyticsViewModel['predictions']['recommendations'];
}) {
  if (recommendations.length === 0) {
    return <Text style={styles.emptyText}>No recommendation summary yet.</Text>;
  }

  return (
    <View style={styles.recommendationStack}>
      {recommendations.map((recommendation, index) => (
        <View key={`${recommendation.title}-${recommendation.body}`} style={styles.recommendationCard}>
          {index === 0 ? <Text style={styles.recommendationLead}>Primary guidance</Text> : null}
          <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
          <Text style={styles.recommendationBody}>{recommendation.body}</Text>
        </View>
      ))}
    </View>
  );
}

function ProductAvatar({
  itemName,
  tone,
}: {
  itemName: string;
  tone: 'default' | 'warning' | 'positive';
}) {
  return (
    <View
      style={[
        styles.productAvatar,
        tone === 'warning' ? styles.productAvatarWarning : undefined,
        tone === 'positive' ? styles.productAvatarPositive : undefined,
      ]}
    >
      <Text style={styles.productAvatarText}>{itemName.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function mergePredictionItems(forecast: AnalyticsListItem[], restockSoon: AnalyticsListItem[]) {
  const merged = new Map<string, AnalyticsListItem>();

  [...restockSoon, ...forecast].forEach((item) => {
    if (!merged.has(item.itemId)) {
      merged.set(item.itemId, item);
    }
  });

  return [...merged.values()];
}

function getInitials(storeName: string) {
  const cleaned = storeName.trim();

  if (cleaned.length === 0) {
    return 'TS';
  }

  const words = cleaned.split(/\s+/).slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

function noop() {}

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
    paddingBottom: 120,
  },
  shell: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  headerMenuButton: {
    width: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.primaryDeep,
    fontSize: 23,
    fontWeight: '700',
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '800',
  },
  topTabRail: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  topTabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  topTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  topTabTextActive: {
    color: colors.primaryDeep,
    fontWeight: '700',
  },
  topTabUnderline: {
    height: 4,
    width: '100%',
    backgroundColor: 'transparent',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  topTabUnderlineActive: {
    backgroundColor: colors.primary,
  },
  errorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 4,
  },
  errorTitle: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyStateCard: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 22,
    alignItems: 'flex-start',
    gap: 12,
  },
  emptyStateIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  emptyStateBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateAction: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyStateActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tabStack: {
    gap: 16,
  },
  insightBanner: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: colors.primaryDeep,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  insightIconTile: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 248, 231, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
    gap: 4,
  },
  insightBannerLabel: {
    color: '#F4F8F2',
    fontSize: 12,
    fontWeight: '700',
  },
  insightBannerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  insightBannerBody: {
    color: '#F4F8F2',
    fontSize: 13,
    lineHeight: 19,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 16,
    shadowColor: '#132A22',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    gap: 8,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  metricCaption: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  cardSurface: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 16,
    shadowColor: '#132A22',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionEyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionAction: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  barChartWrap: {
    paddingTop: 8,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 166,
  },
  barChartItem: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  barGhost: {
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 6,
    backgroundColor: 'rgba(31, 122, 99, 0.08)',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  barLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  lineChartWrap: {
    position: 'relative',
    minHeight: 228,
    justifyContent: 'flex-end',
  },
  lineChartGrid: {
    ...StyleSheet.absoluteFillObject,
    top: 20,
    bottom: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(31, 122, 99, 0.08)',
  },
  lineChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  linePointColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  linePointValue: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  lineStem: {
    width: 14,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: 'rgba(31, 122, 99, 0.18)',
  },
  lineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: -11,
  },
  linePointLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  listStack: {
    gap: 14,
  },
  sellingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sellingMain: {
    flex: 1,
    gap: 4,
  },
  sellingMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rankMeta: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  dualListGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  movementColumn: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.background,
    padding: 12,
    gap: 12,
  },
  movementColumnTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  movementList: {
    gap: 12,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  movementText: {
    flex: 1,
    gap: 2,
  },
  trendList: {
    gap: 10,
  },
  trendLead: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  trendRowText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  forecastHero: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 24,
    backgroundColor: colors.primary,
    padding: 18,
    alignItems: 'stretch',
    shadowColor: colors.primaryDeep,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  forecastHeroText: {
    flex: 1,
    gap: 8,
  },
  forecastIconTile: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 248, 231, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  forecastValue: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 30,
  },
  forecastBody: {
    color: '#F4F8F2',
    fontSize: 13,
    lineHeight: 19,
  },
  forecastPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 248, 231, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  forecastPillText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  forecastMiniTrend: {
    width: 104,
    justifyContent: 'flex-end',
    position: 'relative',
    paddingTop: 14,
    paddingBottom: 8,
  },
  forecastLineBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  forecastMiniBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    flex: 1,
  },
  forecastMiniBar: {
    flex: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  predictionMain: {
    flex: 1,
    gap: 4,
  },
  shoppingPresetRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shoppingPresetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shoppingPresetChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  shoppingPresetText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  shoppingPresetTextActive: {
    color: colors.primaryDeep,
  },
  shoppingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  shoppingMain: {
    flex: 1,
    gap: 4,
  },
  shoppingQuantity: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '800',
  },
  restockButton: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  restockButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  recommendationStack: {
    gap: 12,
  },
  recommendationCard: {
    borderRadius: 18,
    backgroundColor: colors.background,
    padding: 14,
    gap: 6,
  },
  recommendationLead: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recommendationTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  recommendationBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  productAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productAvatarPositive: {
    backgroundColor: 'rgba(31, 122, 99, 0.14)',
  },
  productAvatarWarning: {
    backgroundColor: 'rgba(242, 201, 76, 0.26)',
  },
  productAvatarText: {
    color: colors.primaryDeep,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  skeletonHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  skeletonBanner: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  skeletonBannerLines: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  skeletonBlock: {
    borderRadius: 10,
    backgroundColor: 'rgba(31, 122, 99, 0.14)',
  },
  skeletonIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 248, 231, 0.82)',
  },
  skeletonLineWide: {
    width: '48%',
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  skeletonLineFull: {
    width: '100%',
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  skeletonLineShort: {
    width: '80%',
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  skeletonMetricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  skeletonMetricLabel: {
    width: '40%',
    height: 10,
  },
  skeletonMetricValue: {
    width: '64%',
    height: 22,
  },
  skeletonMetricCaption: {
    width: '52%',
    height: 12,
  },
  skeletonSectionTitle: {
    width: '44%',
    height: 16,
  },
  skeletonChart: {
    width: '100%',
    height: 132,
    borderRadius: 16,
  },
  skeletonListRow: {
    width: '100%',
    height: 50,
    borderRadius: 14,
  },
});
