import { getEnv } from '../config/env';
import { getSupabaseAdminClient } from '../config/supabase';
import { generateGeminiText } from '../services/gemini.service';
import { getStoreByOwnerId } from './store.model';

type AnalyticsMetric = {
  label: string;
  value: string;
  caption: string;
};

type AnalyticsListItem = {
  itemId: string;
  itemName: string;
  detail: string;
  tone?: 'default' | 'warning' | 'positive';
};

type AnalyticsChartPoint = {
  label: string;
  value: number;
  displayValue: string;
};

type AnalyticsRecommendation = {
  title: string;
  body: string;
};

export type AnalyticsSummary = {
  meta: {
    generatedAt: string;
    storeId: string;
    currencyCode: string;
    timezone: string;
    predictionMode: 'deterministic' | 'gemini_enriched';
  };
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
    modelStatus: 'deterministic_fallback' | 'gemini_enriched';
    aiSummary: string | null;
  };
};

type InventoryDashboardRow = {
  id: string;
  name: string;
  unit: string;
  current_stock: number | string;
  low_stock_threshold: number | string;
};

type DailySalesSummaryRow = {
  sale_date: string;
  gross_sales: number | string;
  units_sold: number | string;
  transaction_count: number | string;
};

type MovementRow = {
  item_id: string;
  quantity_delta: number | string;
  movement_type: 'sale' | 'utang_sale' | 'restock' | 'adjustment' | 'opening_stock' | 'correction';
  occurred_at: string;
};

type EnrichedMovement = {
  itemId: string;
  itemName: string;
  unit: string;
  unitsSold: number;
  dayKey: string;
  daysAgo: number;
};

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
};

type ProductAggregate = {
  itemId: string;
  itemName: string;
  unit: string;
  unitsSold: number;
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

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

function aggregateProductRows(rows: EnrichedMovement[]): ProductAggregate[] {
  const products = new Map<string, ProductAggregate>();

  for (const row of rows) {
    const existing = products.get(row.itemId);
    if (existing) {
      existing.unitsSold += row.unitsSold;
      continue;
    }

    products.set(row.itemId, {
      itemId: row.itemId,
      itemName: row.itemName,
      unit: row.unit,
      unitsSold: row.unitsSold,
    });
  }

  return [...products.values()].sort((left, right) => right.unitsSold - left.unitsSold);
}

function buildSlowMovingItems(inventoryItems: InventoryItem[], rows: EnrichedMovement[]): AnalyticsListItem[] {
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
          detail: 'No sales in 30 days',
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
  inventoryItems: InventoryItem[],
  recentRows: EnrichedMovement[],
  previousRows: EnrichedMovement[],
): DemandDelta[] {
  const recent = aggregateProductRows(recentRows);
  const previous = aggregateProductRows(previousRows);
  const productIds = new Set([
    ...inventoryItems.map((item) => item.id),
    ...recent.map((item) => item.itemId),
    ...previous.map((item) => item.itemId),
  ]);

  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
  const recentById = new Map(recent.map((item) => [item.itemId, item]));
  const previousById = new Map(previous.map((item) => [item.itemId, item]));

  return [...productIds]
    .map((itemId) => {
      const inventoryItem = inventoryById.get(itemId);
      const recentItem = recentById.get(itemId);
      const previousItem = previousById.get(itemId);

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

function buildDailyRevenueTrend(params: {
  summaryByDay: Map<string, DailySalesSummaryRow>;
  nowDate: Date;
  timezone: string;
  currencyCode: string;
}): AnalyticsChartPoint[] {
  const dayFormat = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: params.timezone,
  });
  const points: AnalyticsChartPoint[] = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(params.nowDate.getTime() - index * DAY_IN_MS);
    const key = getDayKey(date, params.timezone);
    const summary = params.summaryByDay.get(key);
    const value = summary ? toNumber(summary.gross_sales) : 0;

    points.push({
      label: dayFormat.format(date),
      value,
      displayValue: formatCurrency(value, params.currencyCode),
    });
  }

  return points;
}

function buildForecasts(inventoryItems: InventoryItem[], recentRows: EnrichedMovement[]): ForecastAggregate[] {
  const recentSales = aggregateProductRows(recentRows);
  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));

  return recentSales
    .map((item) => {
      const inventoryItem = inventoryById.get(item.itemId);
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

function buildRecommendations(params: {
  forecasts: ForecastAggregate[];
  restockSoon: AnalyticsListItem[];
  demandDeltas: DemandDelta[];
  hasPricedRows: boolean;
}): AnalyticsRecommendation[] {
  if (params.restockSoon.length > 0) {
    return params.restockSoon.map((item, index) => ({
      title: index === 0 ? 'Act Soon' : 'Restock Planning',
      body: `${item.itemName} is moving quickly. Restock within ${extractDays(item.detail)} days if sales continue.`,
    }));
  }

  const rising = params.demandDeltas.find((item) => item.delta > 0);
  if (rising) {
    return [
      {
        title: 'Demand Signal',
        body: `${rising.itemName} is trending up this week. Prepare extra stock before the next peak day.`,
      },
    ];
  }

  if (params.forecasts.length > 0) {
    return [
      {
        title: 'Inventory Stable',
        body: 'Current stock coverage looks stable for the next few days based on recent sales.',
      },
    ];
  }

  return [
    {
      title: 'Build History',
      body: params.hasPricedRows
        ? 'Keep recording sales. Forecasts will appear after a few days of activity.'
        : 'Add prices and keep recording sales to unlock stronger demand guidance.',
    },
  ];
}

function buildSalesMetric(params: {
  label: string;
  currencyCode: string;
  grossSales: number;
  unitsSold: number;
}): AnalyticsMetric {
  if (params.grossSales > 0) {
    return {
      label: params.label,
      value: formatCurrency(params.grossSales, params.currencyCode),
      caption: 'Revenue',
    };
  }

  return {
    label: params.label,
    value: `${formatCount(params.unitsSold)} units`,
    caption: 'No priced sales yet',
  };
}

function buildPredictionPrompt(params: {
  storeName: string;
  forecast: AnalyticsListItem[];
  restockSoon: AnalyticsListItem[];
  recommendations: AnalyticsRecommendation[];
}) {
  const forecastLine = params.forecast.length > 0 ? params.forecast.map((item) => item.detail).join(' | ') : 'No forecast items yet';
  const restockLine = params.restockSoon.length > 0 ? params.restockSoon.map((item) => item.itemName).join(', ') : 'No urgent restock';
  const recommendationLine =
    params.recommendations.length > 0
      ? params.recommendations.map((item) => `${item.title}: ${item.body}`).join(' | ')
      : 'No recommendation yet';

  return [
    'You are helping a small store owner.',
    'Rewrite the analytics into one short practical summary (max 2 sentences, plain language, no markdown).',
    `Store: ${params.storeName}`,
    `Forecast: ${forecastLine}`,
    `Restock soon: ${restockLine}`,
    `Recommendations: ${recommendationLine}`,
  ].join('\n');
}

function clipSummaryText(value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 220) {
    return trimmed;
  }

  return `${trimmed.slice(0, 217).trimEnd()}...`;
}

export async function getAnalyticsSummaryForOwner(ownerId: string): Promise<AnalyticsSummary> {
  const store = await getStoreByOwnerId(ownerId);
  if (!store) {
    throw new Error('Store not found.');
  }

  const timezone = store.timezone || 'Asia/Manila';
  const nowDate = new Date();
  const todayKey = getDayKey(nowDate, timezone);
  const currentMonthKey = getMonthKey(nowDate, timezone);
  const movementWindowStart = new Date(nowDate.getTime() - 40 * DAY_IN_MS).toISOString();
  const summaryWindowStart = getDayKey(new Date(nowDate.getTime() - 120 * DAY_IN_MS), timezone);

  const supabase = getSupabaseAdminClient();
  const [inventoryResult, summaryResult, movementResult] = await Promise.all([
    supabase
      .from('v_inventory_dashboard')
      .select('id, name, unit, current_stock, low_stock_threshold')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .returns<InventoryDashboardRow[]>(),
    supabase
      .from('v_daily_sales_summary')
      .select('sale_date, gross_sales, units_sold, transaction_count')
      .eq('store_id', store.id)
      .gte('sale_date', summaryWindowStart)
      .order('sale_date', { ascending: false })
      .returns<DailySalesSummaryRow[]>(),
    supabase
      .from('inventory_movements')
      .select('item_id, quantity_delta, movement_type, occurred_at')
      .eq('store_id', store.id)
      .in('movement_type', ['sale', 'utang_sale'])
      .gte('occurred_at', movementWindowStart)
      .returns<MovementRow[]>(),
  ]);

  if (inventoryResult.error) {
    throw new Error('Unable to load inventory analytics.');
  }

  if (summaryResult.error) {
    throw new Error('Unable to load sales analytics.');
  }

  if (movementResult.error) {
    throw new Error('Unable to load movement analytics.');
  }

  const inventoryItems = (inventoryResult.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    currentStock: toNumber(item.current_stock),
    lowStockThreshold: toNumber(item.low_stock_threshold),
  }));

  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
  const summaryRows = summaryResult.data ?? [];
  const summaryByDay = new Map(summaryRows.map((row) => [row.sale_date, row]));
  const movementRows = movementResult.data ?? [];

  const enrichedMovements: EnrichedMovement[] = movementRows
    .map((row) => {
      const unitsSold = Math.abs(toNumber(row.quantity_delta));
      if (unitsSold <= 0) {
        return null;
      }

      const occurredAtDate = new Date(row.occurred_at);
      const inventoryItem = inventoryById.get(row.item_id);
      return {
        itemId: row.item_id,
        itemName: inventoryItem?.name ?? 'Unknown Item',
        unit: inventoryItem?.unit ?? 'pcs',
        unitsSold,
        dayKey: getDayKey(occurredAtDate, timezone),
        daysAgo: Math.floor((nowDate.getTime() - occurredAtDate.getTime()) / DAY_IN_MS),
      };
    })
    .filter((row): row is EnrichedMovement => row !== null && row.daysAgo >= 0);

  const recent7Rows = enrichedMovements.filter((row) => row.daysAgo < 7);
  const previous7Rows = enrichedMovements.filter((row) => row.daysAgo >= 7 && row.daysAgo < 14);
  const last30Rows = enrichedMovements.filter((row) => row.daysAgo < 30);

  const salesTodaySummary = summaryByDay.get(todayKey);
  const salesTodayGross = salesTodaySummary ? toNumber(salesTodaySummary.gross_sales) : 0;
  const salesTodayUnits = salesTodaySummary ? toNumber(salesTodaySummary.units_sold) : 0;

  const monthRows = summaryRows.filter((row) => getMonthKey(new Date(`${row.sale_date}T00:00:00.000Z`), timezone) === currentMonthKey);
  const salesThisMonthGross = monthRows.reduce((total, row) => total + toNumber(row.gross_sales), 0);
  const salesThisMonthUnits = monthRows.reduce((total, row) => total + toNumber(row.units_sold), 0);
  const hasPricedRows = summaryRows.some((row) => toNumber(row.gross_sales) > 0);

  const overview = {
    salesToday: buildSalesMetric({
      label: 'Sales Today',
      currencyCode: store.currencyCode,
      grossSales: salesTodayGross,
      unitsSold: salesTodayUnits,
    }),
    salesThisMonth: buildSalesMetric({
      label: 'Sales This Month',
      currencyCode: store.currencyCode,
      grossSales: salesThisMonthGross,
      unitsSold: salesThisMonthUnits,
    }),
    topSelling: aggregateProductRows(last30Rows)
      .slice(0, 3)
      .map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        detail: `${formatCount(item.unitsSold)} ${item.unit} sold in 30 days`,
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
      .map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        detail: `${formatCount(item.unitsSold)} ${item.unit} sold in 7 days`,
        tone: 'positive' as const,
      })),
    slowMoving: buildSlowMovingItems(inventoryItems, last30Rows),
  };

  const demandDeltas = buildDemandDeltas(inventoryItems, recent7Rows, previous7Rows);
  const insights = {
    salesTrend: buildDailyRevenueTrend({
      summaryByDay,
      nowDate,
      timezone,
      currencyCode: store.currencyCode,
    }),
    demandTrend: demandDeltas
      .filter((item) => item.delta !== 0)
      .slice(0, 5)
      .map((item) => ({
        label: shortenLabel(item.itemName),
        value: Math.abs(item.delta),
        displayValue: `${item.delta > 0 ? '+' : ''}${formatCount(item.delta)} ${item.unit}`,
      })),
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
    emptyState:
      new Set(enrichedMovements.map((row) => row.dayKey)).size === 0
        ? 'Need at least 7 days of sales to detect demand shifts.'
        : null,
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

  let recommendations = buildRecommendations({
    forecasts,
    restockSoon,
    demandDeltas,
    hasPricedRows,
  });
  let modelStatus: 'deterministic_fallback' | 'gemini_enriched' = 'deterministic_fallback';
  let aiSummary: string | null = null;

  const env = getEnv();
  if (env.GEMINI_API_KEY) {
    try {
      const rawSummary = await generateGeminiText(
        buildPredictionPrompt({
          storeName: store.name,
          forecast: forecasts.slice(0, 3).map((item) => ({
            itemId: item.itemId,
            itemName: item.itemName,
            detail: `${formatCount(item.recentUnits)} ${item.unit} sold in 7 days · ${Math.ceil(item.daysUntilStockout)} days of stock`,
          })),
          restockSoon,
          recommendations,
        }),
      );

      if (typeof rawSummary === 'string' && rawSummary.trim()) {
        aiSummary = clipSummaryText(rawSummary);
        recommendations = [{ title: 'AI Summary', body: aiSummary }, ...recommendations].slice(0, 4);
        modelStatus = 'gemini_enriched';
      }
    } catch {
      // Keep deterministic forecast output if Gemini is unavailable.
    }
  }

  const predictions = {
    forecast: forecasts.slice(0, 3).map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      detail: `${formatCount(item.recentUnits)} ${item.unit} sold in 7 days · ${Math.ceil(item.daysUntilStockout)} days of stock`,
    })),
    restockSoon,
    recommendations,
    emptyState: forecasts.length === 0 ? 'Forecasts will appear after a few days of sales.' : null,
    modelStatus,
    aiSummary,
  };

  return {
    meta: {
      generatedAt: nowDate.toISOString(),
      storeId: store.id,
      currencyCode: store.currencyCode,
      timezone,
      predictionMode: modelStatus === 'gemini_enriched' ? 'gemini_enriched' : 'deterministic',
    },
    overview,
    insights,
    predictions,
  };
}
