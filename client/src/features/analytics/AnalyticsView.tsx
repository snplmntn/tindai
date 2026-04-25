import { type ComponentProps, type ReactNode } from 'react';

import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/navigation/colors';

import type { AnalyticsChartPoint, AnalyticsListItem, AnalyticsViewModel } from './buildAnalyticsViewModel';

type AnalyticsTabKey = 'Overview' | 'Insights' | 'Predictions & AI';

type AnalyticsViewProps = {
  storeName: string;
  activeTab: AnalyticsTabKey;
  onTabChange: (tab: AnalyticsTabKey) => void;
  viewModel: AnalyticsViewModel;
  isLoading: boolean;
  error: string | null;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabs: Array<{ key: AnalyticsTabKey; icon: IconName; label: string }> = [
  { key: 'Overview', icon: 'grid-outline', label: 'Overview' },
  { key: 'Insights', icon: 'bar-chart-outline', label: 'Insights' },
  { key: 'Predictions & AI', icon: 'sparkles-outline', label: 'Predictions & AI' },
];

export function AnalyticsView({
  storeName,
  activeTab,
  onTabChange,
  viewModel,
  isLoading,
  error,
}: AnalyticsViewProps) {
  const heroSignal = viewModel.overview.lowStock[0] ?? viewModel.overview.topSelling[0] ?? null;
  const heroSignalTitle = heroSignal ? heroSignal.itemName : 'No urgent alerts right now';
  const heroSignalBody = heroSignal
    ? heroSignal.detail
    : 'Preview data is standing in until local sales history builds up.';
  const statusLabel = isLoading ? 'Refreshing local sales data...' : 'Offline preview ready';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroEyebrow}>
                <Ionicons color={colors.primaryDeep} name="analytics-outline" size={14} />
                <Text style={styles.heroEyebrowText}>Analytics</Text>
              </View>

              <View style={styles.storePill}>
                <Text numberOfLines={1} style={styles.storePillText}>
                  {storeName}
                </Text>
              </View>
            </View>

            <Text style={styles.title}>A clean read on sales, stock, and next moves.</Text>
            <Text style={styles.subtitle}>
              The analytics board keeps the core loop readable on a small screen: sales first, stock watch next, then
              forecasting.
            </Text>

            <View style={styles.signalCard}>
              <View style={styles.signalAccent} />
              <View style={styles.signalBody}>
                <Text style={styles.signalLabel}>Focus now</Text>
                <Text style={styles.signalTitle}>{heroSignalTitle}</Text>
                <Text style={styles.signalText}>{heroSignalBody}</Text>
              </View>
              <View style={styles.signalBadge}>
                <Text style={styles.signalBadgeText}>{statusLabel}</Text>
              </View>
            </View>

            <View style={styles.heroStats}>
              <HeroStat
                accent="primary"
                label={viewModel.overview.salesToday.label}
                value={viewModel.overview.salesToday.value}
                caption={viewModel.overview.salesToday.caption}
              />
              <HeroStat
                accent="secondary"
                label={viewModel.overview.salesThisMonth.label}
                value={viewModel.overview.salesThisMonth.value}
                caption={viewModel.overview.salesThisMonth.caption}
              />
            </View>
          </View>

          <View style={styles.tabRail}>
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;

              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="button"
                  onPress={() => onTabChange(tab.key)}
                  style={[styles.tabButton, isActive ? styles.tabButtonActive : undefined]}
                >
                  <View style={[styles.tabIconWrap, isActive ? styles.tabIconWrapActive : undefined]}>
                    <Ionicons
                      color={isActive ? colors.primaryDeep : colors.muted}
                      name={tab.icon}
                      size={17}
                    />
                  </View>
                  <Text style={[styles.tabButtonText, isActive ? styles.tabButtonTextActive : undefined]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <View style={styles.errorBadge}>
                <Ionicons color={colors.primaryDeep} name="alert-circle-outline" size={16} />
                <Text style={styles.errorBadgeText}>Analytics refresh paused</Text>
              </View>
              <Text style={styles.errorTitle}>Unable to refresh analytics</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {activeTab === 'Overview' ? <OverviewTab viewModel={viewModel} /> : null}
          {activeTab === 'Insights' ? <InsightsTab viewModel={viewModel} isLoading={isLoading} /> : null}
          {activeTab === 'Predictions & AI' ? <PredictionsTab viewModel={viewModel} isLoading={isLoading} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewTab({ viewModel }: { viewModel: AnalyticsViewProps['viewModel'] }) {
  const lowStockHeadline = viewModel.overview.lowStock[0] ?? viewModel.predictions.restockSoon[0] ?? null;

  return (
    <View style={styles.sectionStack}>
      <View style={styles.metricGrid}>
        <MetricCard
          accent="primary"
          icon="cash-outline"
          label={viewModel.overview.salesToday.label}
          value={viewModel.overview.salesToday.value}
          caption={viewModel.overview.salesToday.caption}
        />
        <MetricCard
          accent="secondary"
          icon="trending-up-outline"
          label={viewModel.overview.salesThisMonth.label}
          value={viewModel.overview.salesThisMonth.value}
          caption={viewModel.overview.salesThisMonth.caption}
        />
      </View>

      <SectionCard
        subtitle="A single item summary keeps the next action obvious."
        title="Priority now"
      >
        {lowStockHeadline ? (
          <PriorityStrip item={lowStockHeadline} />
        ) : (
          <EmptyInlineText text="No low-stock items surfaced in the current view." />
        )}
      </SectionCard>

      <TwoColumnLists
        leftItems={viewModel.overview.topSelling}
        leftTitle="Top selling"
        rightItems={viewModel.overview.lowStock}
        rightTitle="Low stock"
      />

      <TwoColumnLists
        leftItems={viewModel.overview.fastMoving}
        leftTitle="Fast moving"
        rightItems={viewModel.overview.slowMoving}
        rightTitle="Slow moving"
      />
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
  return (
    <View style={styles.sectionStack}>
      {viewModel.insights.emptyState ? (
        <EmptyStateCard
          body={viewModel.insights.emptyState}
          loadingLabel={isLoading ? 'Refreshing local sales data...' : null}
          title="Insights need more history"
        />
      ) : null}

      <SectionCard subtitle="Daily sales over the last 7 days." title="Sales trend">
        <MiniBarChart points={viewModel.insights.salesTrend} />
      </SectionCard>

      <SectionCard subtitle="Biggest product movement changes." title="Demand shift">
        <MiniBarChart accent="secondary" points={viewModel.insights.demandTrend} />
      </SectionCard>

      <TwoColumnLists
        leftItems={viewModel.insights.risingDemand}
        leftTitle="Trending up"
        rightItems={viewModel.insights.decliningDemand}
        rightTitle="Trending down"
      />
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
  const forecastLead = viewModel.predictions.restockSoon[0] ?? viewModel.predictions.forecast[0] ?? null;
  const leadTitle = forecastLead ? `Watch ${forecastLead.itemName}` : 'Forecasts are warming up';
  const leadBody = forecastLead
    ? forecastLead.detail
    : 'Forecast cards will appear after a few days of local sales activity.';

  return (
    <View style={styles.sectionStack}>
      {viewModel.predictions.emptyState ? (
        <EmptyStateCard
          body={viewModel.predictions.emptyState}
          loadingLabel={isLoading ? 'Refreshing local sales data...' : null}
          title="Predictions are warming up"
        />
      ) : null}

      <SectionCard subtitle="A short summary of near-term stock pressure." title="Forecast summary">
        <View style={styles.predictionSummary}>
          <View style={styles.predictionSummaryHeader}>
            <View style={styles.predictionSummaryBadge}>
              <Ionicons color={colors.primaryDeep} name="sparkles-outline" size={14} />
              <Text style={styles.predictionSummaryBadgeText}>Model summary</Text>
            </View>
            <Text style={styles.predictionSummaryTitle}>{leadTitle}</Text>
            <Text style={styles.predictionSummaryBody}>{leadBody}</Text>
          </View>

          <View style={styles.predictionMiniGrid}>
            <PredictionMiniCard label="Forecast items" value={`${viewModel.predictions.forecast.length}`} />
            <PredictionMiniCard label="Restock soon" value={`${viewModel.predictions.restockSoon.length}`} />
          </View>
        </View>
      </SectionCard>

      <TwoColumnLists
        leftItems={viewModel.predictions.forecast}
        leftTitle="Demand forecast"
        rightItems={viewModel.predictions.restockSoon}
        rightTitle="Restock Soon"
      />

      <SectionCard subtitle="Deterministic guidance from local sales patterns." title="AI recommendations">
        <View style={styles.recommendationStack}>
          {viewModel.predictions.recommendations.map((recommendation) => (
            <View key={`${recommendation.title}-${recommendation.body}`} style={styles.recommendationCard}>
              <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
              <Text style={styles.recommendationBody}>{recommendation.body}</Text>
            </View>
          ))}
        </View>
      </SectionCard>
    </View>
  );
}

function HeroStat({
  accent,
  label,
  value,
  caption,
}: {
  accent: 'primary' | 'secondary';
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <View style={styles.heroStatCard}>
      <View style={[styles.heroStatAccent, accent === 'secondary' ? styles.heroStatAccentSecondary : undefined]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricCaption}>{caption}</Text>
    </View>
  );
}

function MetricCard({
  accent,
  icon,
  label,
  value,
  caption,
}: {
  accent: 'primary' | 'secondary';
  icon: IconName;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconWrap, accent === 'secondary' ? styles.metricIconWrapSecondary : undefined]}>
        <Ionicons color={colors.primaryDeep} name={icon} size={16} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricCaption}>{caption}</Text>
    </View>
  );
}

function TwoColumnLists({
  leftTitle,
  leftItems,
  rightTitle,
  rightItems,
}: {
  leftTitle: string;
  leftItems: AnalyticsListItem[];
  rightTitle: string;
  rightItems: AnalyticsListItem[];
}) {
  return (
    <View style={styles.listGrid}>
      <SectionCard title={leftTitle}>
        <RankedList items={leftItems} />
      </SectionCard>
      <SectionCard title={rightTitle}>
        <RankedList items={rightItems} />
      </SectionCard>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionMarker} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function RankedList({ items }: { items: AnalyticsListItem[] }) {
  if (items.length === 0) {
    return <Text style={styles.emptyListText}>No local activity yet.</Text>;
  }

  return (
    <View style={styles.rankList}>
      {items.map((item, index) => (
        <View key={`${item.itemId}-${item.itemName}`} style={styles.rankListItem}>
          <View style={[styles.rankIndex, getToneChipStyle(item.tone)]}>
            <Text style={styles.rankIndexText}>{index + 1}</Text>
          </View>
          <View style={styles.rankContent}>
            <Text style={styles.rankItemName}>{item.itemName}</Text>
            <Text style={styles.rankItemDetail}>{item.detail}</Text>
          </View>
          {item.tone ? (
            <View style={[styles.rankTonePill, getToneChipStyle(item.tone)]}>
              <Text style={styles.rankToneText}>{getToneLabel(item.tone)}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function MiniBarChart({
  points,
  accent = 'primary',
}: {
  points: AnalyticsChartPoint[];
  accent?: 'primary' | 'secondary';
}) {
  const maxValue = Math.max(...points.map((point) => point.value), 0);

  if (points.length === 0) {
    return <Text style={styles.emptyListText}>No chart data yet.</Text>;
  }

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartRow}>
        {points.map((point) => {
          const height = maxValue === 0 ? 6 : Math.max(6, Math.round((point.value / maxValue) * 88));

          return (
            <View key={`${point.label}-${point.displayValue}`} style={styles.chartPoint}>
              <View
                style={[
                  styles.chartBar,
                  accent === 'secondary' ? styles.chartBarSecondary : undefined,
                  { height },
                ]}
              />
              <Text style={styles.chartLabel}>{point.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PriorityStrip({ item }: { item: AnalyticsListItem }) {
  return (
    <View style={styles.priorityStrip}>
      <View style={[styles.priorityDot, getToneChipStyle(item.tone)]} />
      <View style={styles.priorityContent}>
        <Text style={styles.priorityTitle}>{item.itemName}</Text>
        <Text style={styles.priorityBody}>{item.detail}</Text>
      </View>
      {item.tone ? (
        <View style={[styles.priorityBadge, getToneChipStyle(item.tone)]}>
          <Text style={styles.priorityBadgeText}>{getToneLabel(item.tone)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PredictionMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.predictionMiniCard}>
      <Text style={styles.predictionMiniLabel}>{label}</Text>
      <Text style={styles.predictionMiniValue}>{value}</Text>
    </View>
  );
}

function EmptyInlineText({ text }: { text: string }) {
  return <Text style={styles.emptyListText}>{text}</Text>;
}

function EmptyStateCard({
  title,
  body,
  loadingLabel,
}: {
  title: string;
  body: string;
  loadingLabel: string | null;
}) {
  return (
    <View style={styles.emptyStateCard}>
      <View style={styles.emptyStateBadge}>
        <Ionicons color={colors.primaryDeep} name="time-outline" size={14} />
        <Text style={styles.emptyStateBadgeText}>Preview mode</Text>
      </View>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateBody}>{body}</Text>
      {loadingLabel ? <Text style={styles.emptyStateHint}>{loadingLabel}</Text> : null}
    </View>
  );
}

function getToneChipStyle(tone: AnalyticsListItem['tone']) {
  if (tone === 'warning') {
    return styles.toneWarning;
  }

  if (tone === 'positive') {
    return styles.tonePositive;
  }

  return styles.toneDefault;
}

function getToneLabel(tone: AnalyticsListItem['tone']) {
  if (tone === 'warning') {
    return 'Watch';
  }

  if (tone === 'positive') {
    return 'Up';
  }

  return 'OK';
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
    paddingBottom: 120,
  },
  shell: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroEyebrowText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  storePill: {
    maxWidth: '48%',
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  storePillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  signalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: 14,
  },
  signalAccent: {
    width: 10,
    borderRadius: 999,
    backgroundColor: colors.secondary,
    alignSelf: 'stretch',
  },
  signalBody: {
    flex: 1,
    gap: 4,
  },
  signalLabel: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  signalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  signalText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  signalBadge: {
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  signalBadgeText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
  },
  heroStatAccent: {
    width: 28,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  heroStatAccentSecondary: {
    backgroundColor: colors.secondary,
  },
  tabRail: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 6,
  },
  tabButton: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.card,
  },
  tabIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: colors.surface,
  },
  tabButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabButtonTextActive: {
    color: colors.primaryDeep,
  },
  errorCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 8,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorBadgeText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  errorTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionStack: {
    gap: 14,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  metricIconWrapSecondary: {
    backgroundColor: colors.surfaceAlt,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.primaryDeep,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  metricCaption: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  listGrid: {
    gap: 12,
  },
  rankList: {
    gap: 12,
  },
  rankListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankIndexText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
  },
  rankContent: {
    flex: 1,
    gap: 2,
  },
  rankItemName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rankItemDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  rankTonePill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  rankToneText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  toneDefault: {
    backgroundColor: colors.card,
  },
  toneWarning: {
    backgroundColor: colors.surfaceAlt,
  },
  tonePositive: {
    backgroundColor: 'rgba(31, 122, 99, 0.12)',
  },
  emptyListText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  chartWrap: {
    paddingTop: 6,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 116,
  },
  chartPoint: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  chartBar: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
    minHeight: 6,
  },
  chartBarSecondary: {
    backgroundColor: colors.secondary,
  },
  chartLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  priorityStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: 14,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  priorityContent: {
    flex: 1,
    gap: 4,
  },
  priorityTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  priorityBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  priorityBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  priorityBadgeText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  predictionSummary: {
    gap: 12,
  },
  predictionSummaryHeader: {
    gap: 6,
  },
  predictionSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  predictionSummaryBadgeText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  predictionSummaryTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  predictionSummaryBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  predictionMiniGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  predictionMiniCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: 12,
    gap: 4,
  },
  predictionMiniLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  predictionMiniValue: {
    color: colors.primaryDeep,
    fontSize: 20,
    fontWeight: '800',
  },
  recommendationStack: {
    gap: 10,
  },
  recommendationCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 4,
  },
  recommendationTitle: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  recommendationBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 6,
  },
  emptyStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  emptyStateBadgeText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyStateBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateHint: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
  },
});
