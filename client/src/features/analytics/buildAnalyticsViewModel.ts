import type { LocalInventoryItem } from '@/features/local-db/types';

export type AnalyticsSalesRow = {
  itemId: string;
  itemName: string;
  unit: string;
  quantityDelta: number;
  unitPrice: number;
  lineTotal: number;
  occurredAt: string;
  isUtang: boolean;
};

type AnalyticsMetric = {
  label: string;
  value: string;
  caption: string;
};

export type AnalyticsListItem = {
  itemId: string;
  itemName: string;
  detail: string;
  tone?: 'default' | 'warning' | 'positive';
};

export type AnalyticsChartPoint = {
  label: string;
  value: number;
  displayValue: string;
};

type AnalyticsRecommendation = {
  title: string;
  body: string;
};

export type AnalyticsViewModel = {
  overview: {
    salesToday: AnalyticsMetric;
    salesThisMonth: AnalyticsMetric;
    topSelling: AnalyticsListItem[];
    lowStock: AnalyticsListItem[];
    fastMoving: AnalyticsListItem[];
    slowMoving: AnalyticsListItem[];
  };
  insights: {
    salesTrend: AnalyticsChartPoint[];
    demandTrend: AnalyticsChartPoint[];
    risingDemand: AnalyticsListItem[];
    decliningDemand: AnalyticsListItem[];
    emptyState: string | null;
  };
  predictions: {
    forecast: AnalyticsListItem[];
    restockSoon: AnalyticsListItem[];
    recommendations: AnalyticsRecommendation[];
    emptyState: string | null;
    modelStatus?: 'deterministic_fallback' | 'gemini_enriched';
    aiSummary?: string | null;
  };
};

type BuildAnalyticsViewModelInput = {
  currencyCode: string;
  timezone: string;
  inventoryItems: LocalInventoryItem[];
  salesRows: AnalyticsSalesRow[];
  now?: string;
};

type EnrichedSalesRow = AnalyticsSalesRow & {
  unitsSold: number;
  dayKey: string;
  monthKey: string;
  daysAgo: number;
};

type ProductAggregate = {
  itemId: string;
  itemName: string;
  unit: string;
  unitsSold: number;
  revenue: number;
};

type DemandDelta = {
  itemId: string;
  itemName: string;
  unit: string;
  recentUnits: number;
  previousUnits: number;
  delta: number;
};

type ForecastAggregate = {
  itemId: string;
  itemName: string;
  unit: string;
  recentUnits: number;
  averageDailyUnits: number;
  daysUntilStockout: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function buildAnalyticsViewModel({
  currencyCode,
  timezone,
  inventoryItems,
  salesRows,
  now = new Date().toISOString(),
}: BuildAnalyticsViewModelInput): AnalyticsViewModel {
  const nowDate = new Date(now);
  const nowDayKey = getDayKey(nowDate, timezone);
  const nowMonthKey = getMonthKey(nowDate, timezone);
  const enrichedRows = salesRows
    .filter((row) => row.quantityDelta < 0)
    .map((row) => {
      const occurredAtDate = new Date(row.occurredAt);

      return {
        ...row,
        unitsSold: Math.abs(row.quantityDelta),
        dayKey: getDayKey(occurredAtDate, timezone),
        monthKey: getMonthKey(occurredAtDate, timezone),
        daysAgo: Math.floor((nowDate.getTime() - occurredAtDate.getTime()) / DAY_IN_MS),
      };
    });

  const recent7Rows = enrichedRows.filter((row) => row.daysAgo >= 0 && row.daysAgo < 7);
  const previous7Rows = enrichedRows.filter((row) => row.daysAgo >= 7 && row.daysAgo < 14);
  const last30Rows = enrichedRows.filter((row) => row.daysAgo >= 0 && row.daysAgo < 30);
  const salesTodayRows = enrichedRows.filter((row) => row.dayKey === nowDayKey);
  const salesThisMonthRows = enrichedRows.filter((row) => row.monthKey === nowMonthKey);
  const hasPricedRows = enrichedRows.some((row) => row.lineTotal > 0 || row.unitPrice > 0);
  const hasIncompletePricing = enrichedRows.some((row) => row.lineTotal <= 0 || row.unitPrice <= 0);

  const overview = {
    salesToday: buildSalesMetric({
      label: 'Sales Today',
      currencyCode,
      rows: salesTodayRows,
      hasIncompletePricing,
    }),
    salesThisMonth: buildSalesMetric({
      label: 'Sales This Month',
      currencyCode,
      rows: salesThisMonthRows,
      hasIncompletePricing,
    }),
    topSelling: aggregateProductRows(last30Rows)
      .slice(0, 3)
      .map((product) => ({
        itemId: product.itemId,
        itemName: product.itemName,
        detail: `${formatCount(product.unitsSold)} ${product.unit} sold in 30 days`,
      })),
    lowStock: inventoryItems
      .filter((item) => item.currentStock <= item.lowStockThreshold)
      .sort((left, right) => left.currentStock - right.currentStock)
      .slice(0, 3)
      .map((item) => ({
        itemId: item.id,
        itemName: item.name,
        detail: `${formatCount(item.currentStock)} ${item.unit} left · reorder at ${formatCount(item.lowStockThreshold)}`,
        tone: 'warning' as const,
      })),
    fastMoving: aggregateProductRows(recent7Rows)
      .slice(0, 3)
      .map((product) => ({
        itemId: product.itemId,
        itemName: product.itemName,
        detail: `${formatCount(product.unitsSold)} ${product.unit} sold in 7 days`,
        tone: 'positive' as const,
      })),
    slowMoving: buildSlowMovingItems(inventoryItems, last30Rows),
  };

  const demandDeltas = buildDemandDeltas(inventoryItems, recent7Rows, previous7Rows);
  const distinctDayCount = new Set(enrichedRows.map((row) => row.dayKey)).size;
  const insightsEmptyState =
    distinctDayCount === 0 ? 'Need at least 7 days of sales to detect demand shifts.' : null;

  const salesTrend = buildDailyTrend({
    rows: recent7Rows,
    nowDate,
    timezone,
    mode: 'revenue',
  });
  const demandTrend = demandDeltas
    .filter((item) => item.delta !== 0)
    .slice(0, 5)
    .map((item) => ({
      label: shortenLabel(item.itemName),
      value: Math.abs(item.delta),
      displayValue: `${item.delta > 0 ? '+' : ''}${formatCount(item.delta)} ${item.unit}`,
    }));

  const insights = {
    salesTrend,
    demandTrend,
    risingDemand: demandDeltas
      .filter((item) => item.delta > 0)
      .slice(0, 3)
      .map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        detail: `Up by ${formatCount(item.delta)} ${item.unit} versus the prior 7 days`,
        tone: 'positive' as const,
      })),
    decliningDemand: demandDeltas
      .filter((item) => item.delta < 0)
      .slice(0, 3)
      .map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        detail: `Down by ${formatCount(Math.abs(item.delta))} ${item.unit} versus the prior 7 days`,
      })),
    emptyState: insightsEmptyState,
  };

  const forecasts = buildForecasts(inventoryItems, recent7Rows);
  const restockSoon = forecasts
    .filter((item) => item.daysUntilStockout <= 7)
    .slice(0, 3)
    .map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      detail: `${formatCount(item.averageDailyUnits)}/${item.unit} daily · ${Math.ceil(item.daysUntilStockout)} days left`,
      tone: 'warning' as const,
    }));
  const recommendations = buildRecommendations({
    forecasts,
    restockSoon,
    demandDeltas,
    hasPricedRows,
  });

  const predictions = {
    forecast: forecasts.slice(0, 3).map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      detail: `${formatCount(item.recentUnits)} ${item.unit} sold in 7 days · ${Math.ceil(item.daysUntilStockout)} days of stock`,
    })),
    restockSoon,
    recommendations,
    emptyState:
      forecasts.length === 0 ? 'Forecasts will appear after a few days of local sales.' : null,
  };

  if (!hasPricedRows && enrichedRows.length === 0) {
    overview.topSelling = [];
    overview.fastMoving = [];
  }

  return {
    overview,
    insights,
    predictions,
  };
}

function buildSalesMetric({
  label,
  currencyCode,
  rows,
  hasIncompletePricing,
}: {
  label: string;
  currencyCode: string;
  rows: EnrichedSalesRow[];
  hasIncompletePricing: boolean;
}): AnalyticsMetric {
  if (rows.length === 0) {
    return {
      label,
      value: '0 units',
      caption: 'No priced sales yet',
    };
  }

  const revenue = rows.reduce((total, row) => total + Math.max(row.lineTotal, 0), 0);
  const units = rows.reduce((total, row) => total + row.unitsSold, 0);

  if (revenue > 0) {
    return {
      label,
      value: formatCurrency(revenue, currencyCode),
      caption: hasIncompletePricing ? 'Estimated revenue' : 'Revenue',
    };
  }

  return {
    label,
    value: `${formatCount(units)} units`,
    caption: 'No priced sales yet',
  };
}

function aggregateProductRows(rows: EnrichedSalesRow[]): ProductAggregate[] {
  const products = new Map<string, ProductAggregate>();

  for (const row of rows) {
    const existing = products.get(row.itemId);

    if (existing) {
      existing.unitsSold += row.unitsSold;
      existing.revenue += Math.max(row.lineTotal, 0);
      continue;
    }

    products.set(row.itemId, {
      itemId: row.itemId,
      itemName: row.itemName,
      unit: row.unit,
      unitsSold: row.unitsSold,
      revenue: Math.max(row.lineTotal, 0),
    });
  }

  return [...products.values()].sort((left, right) => {
    if (right.unitsSold !== left.unitsSold) {
      return right.unitsSold - left.unitsSold;
    }

    return right.revenue - left.revenue;
  });
}

function buildSlowMovingItems(
  inventoryItems: LocalInventoryItem[],
  rows: EnrichedSalesRow[],
): AnalyticsListItem[] {
  const salesByItem = aggregateProductRows(rows);
  const salesMap = new Map(salesByItem.map((item) => [item.itemId, item]));

  return inventoryItems
    .filter((item) => item.currentStock > 0)
    .map((item) => {
      const aggregate = salesMap.get(item.id);

      if (!aggregate) {
        return {
          itemId: item.id,
          itemName: item.name,
          detail: `No sales in 30 days`,
        };
      }

      return {
        itemId: item.id,
        itemName: item.name,
        detail: `${formatCount(aggregate.unitsSold)} ${item.unit} sold in 30 days`,
      };
    })
    .sort((left, right) => {
      const leftUnits = getLeadingCount(left.detail);
      const rightUnits = getLeadingCount(right.detail);

      return leftUnits - rightUnits;
    })
    .slice(0, 3);
}

function buildDemandDeltas(
  inventoryItems: LocalInventoryItem[],
  recentRows: EnrichedSalesRow[],
  previousRows: EnrichedSalesRow[],
): DemandDelta[] {
  const recent = aggregateProductRows(recentRows);
  const previous = aggregateProductRows(previousRows);
  const productIds = new Set([
    ...inventoryItems.map((item) => item.id),
    ...recent.map((item) => item.itemId),
    ...previous.map((item) => item.itemId),
  ]);

  return [...productIds]
    .map((itemId) => {
      const inventoryItem = inventoryItems.find((item) => item.id === itemId);
      const recentItem = recent.find((item) => item.itemId === itemId);
      const previousItem = previous.find((item) => item.itemId === itemId);

      return {
        itemId,
        itemName: inventoryItem?.name ?? recentItem?.itemName ?? previousItem?.itemName ?? 'Unknown Item',
        unit: inventoryItem?.unit ?? recentItem?.unit ?? previousItem?.unit ?? 'pcs',
        recentUnits: recentItem?.unitsSold ?? 0,
        previousUnits: previousItem?.unitsSold ?? 0,
        delta: (recentItem?.unitsSold ?? 0) - (previousItem?.unitsSold ?? 0),
      };
    })
    .sort((left, right) => right.delta - left.delta);
}

function buildDailyTrend({
  rows,
  nowDate,
  timezone,
  mode,
}: {
  rows: EnrichedSalesRow[];
  nowDate: Date;
  timezone: string;
  mode: 'units' | 'revenue';
}): AnalyticsChartPoint[] {
  const dayFormat = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone,
  });
  const points: AnalyticsChartPoint[] = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(nowDate.getTime() - index * DAY_IN_MS);
    const key = getDayKey(date, timezone);
    const value = rows
      .filter((row) => row.dayKey === key)
      .reduce((total, row) => total + (mode === 'revenue' ? row.lineTotal : row.unitsSold), 0);

    points.push({
      label: dayFormat.format(date),
      value,
      displayValue: mode === 'revenue' ? formatCurrency(value, 'PHP') : `${formatCount(value)} units`,
    });
  }

  return points;
}

function buildForecasts(
  inventoryItems: LocalInventoryItem[],
  recentRows: EnrichedSalesRow[],
): ForecastAggregate[] {
  const recentSales = aggregateProductRows(recentRows);

  return recentSales
    .map((item) => {
      const inventoryItem = inventoryItems.find((entry) => entry.id === item.itemId);

      if (!inventoryItem) {
        return null;
      }

      const averageDailyUnits = item.unitsSold / 7;

      if (averageDailyUnits <= 0) {
        return null;
      }

      return {
        itemId: item.itemId,
        itemName: item.itemName,
        unit: item.unit,
        recentUnits: item.unitsSold,
        averageDailyUnits,
        daysUntilStockout: inventoryItem.currentStock / averageDailyUnits,
      };
    })
    .filter((item): item is ForecastAggregate => item !== null)
    .sort((left, right) => left.daysUntilStockout - right.daysUntilStockout);
}

function buildRecommendations({
  forecasts,
  restockSoon,
  demandDeltas,
  hasPricedRows,
}: {
  forecasts: ForecastAggregate[];
  restockSoon: AnalyticsListItem[];
  demandDeltas: DemandDelta[];
  hasPricedRows: boolean;
}): AnalyticsRecommendation[] {
  if (restockSoon.length > 0) {
    return restockSoon.map((item, index) => ({
      title: index === 0 ? 'Act Soon' : 'Restock Planning',
      body: `${item.itemName} is moving quickly. Restock within ${extractDays(item.detail)} days if sales continue.`,
    }));
  }

  const rising = demandDeltas.find((item) => item.delta > 0);

  if (rising) {
    return [
      {
        title: 'Demand Signal',
        body: `${rising.itemName} is trending up this week. Prepare extra stock before the next peak day.`,
      },
    ];
  }

  if (forecasts.length > 0) {
    return [
      {
        title: 'Inventory Stable',
        body: 'Current stock coverage looks stable for the next few days based on recent local sales.',
      },
    ];
  }

  return [
    {
      title: 'Build History',
      body: hasPricedRows
        ? 'Keep logging sales locally. Forecasts will appear after a few days of activity.'
        : 'Add prices and keep logging sales locally to unlock stronger demand guidance.',
    },
  ];
}

function getDayKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(date);
}

function getMonthKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: timezone,
  }).format(date);
}

function formatCurrency(value: number, currencyCode: string) {
  const rounded = Math.round(value * 100) / 100;

  if (currencyCode === 'PHP') {
    return `P${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
  }

  return `${currencyCode} ${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

function formatCount(value: number) {
  const rounded = Math.round(value * 10) / 10;

  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

function shortenLabel(value: string) {
  return value.length > 10 ? value.slice(0, 10).trimEnd() : value;
}

function extractDays(detail: string) {
  const match = detail.match(/(\d+)\s+days/);
  return match?.[1] ?? '3';
}

function getLeadingCount(detail: string) {
  const match = detail.match(/^(\d+(?:\.\d+)?)/);
  return Number(match?.[1] ?? Number.MAX_SAFE_INTEGER);
}
