import { getEnv } from '../config/env';
import { getSupabaseAdminClient } from '../config/supabase';
import { generateGeminiText } from '../services/gemini.service';
import { getStoreByOwnerId, type Store } from './store.model';

type AssistantInputMode = 'voice' | 'text';
type AssistantOutputMode = 'text' | 'speech' | 'text_and_speech';
type AssistantIntent =
  | 'fast_moving'
  | 'low_stock'
  | 'today_sales'
  | 'utang_balances'
  | 'restock_suggestions'
  | 'mutation_request'
  | 'unsupported';
type LanguageStyle = 'english' | 'filipino' | 'taglish' | 'bisaya';

export type AssistantQueryInput = {
  clientInteractionId: string;
  questionText: string;
  inputMode: AssistantInputMode;
  outputMode: AssistantOutputMode;
};

export type AssistantQueryResult = {
  clientInteractionId: string;
  status: 'answered';
  answerText: string;
  spokenText: string | null;
  actions: unknown[];
};

type AssistantInteractionRow = {
  id: string;
  store_id: string;
  client_interaction_id: string;
  answer_text: string | null;
  spoken_text: string | null;
  actions: unknown;
  status: 'pending' | 'answered' | 'failed';
  error_message: string | null;
};

type InventoryRow = {
  id: string;
  name: string;
  unit: string;
  current_stock: number | string;
  low_stock_threshold: number | string;
  price: number | string;
};

type MovementRow = {
  item_id: string;
  quantity_delta: number | string;
  movement_type: 'sale' | 'utang_sale' | 'restock' | 'adjustment' | 'opening_stock' | 'correction';
  occurred_at: string;
};

type DailySummaryRow = {
  sale_date: string;
  gross_sales: number | string;
  units_sold: number | string;
  transaction_count: number | string;
};

type CustomerUtangRow = {
  display_name: string;
  utang_balance: number | string;
};

type StoreAssistantContext = {
  todayDate: string;
  lowStockItems: Array<{ name: string; currentStock: number; threshold: number; unit: string }>;
  topItemsToday: Array<{ name: string; units: number }>;
  restockCandidates: Array<{ name: string; currentStock: number; threshold: number; soldLast7Days: number; unit: string }>;
  utangTop: Array<{ customerName: string; balance: number }>;
  salesToday: { grossSales: number; unitsSold: number; transactionCount: number };
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDateInTimeZone(isoDate: string | Date, timeZone: string): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getLastNDatesInTimeZone(timeZone: string, days: number) {
  const dates = new Set<string>();
  const now = new Date();
  for (let index = 0; index < days; index += 1) {
    const value = new Date(now);
    value.setUTCDate(now.getUTCDate() - index);
    dates.add(getDateInTimeZone(value, timeZone));
  }

  return dates;
}

function detectLanguageStyle(question: string): LanguageStyle {
  const normalized = question.toLowerCase();
  const bisayaSignals = ['unsa', 'kinsa', 'pila', 'karon', 'baligya', 'ug ', 'kana'];
  const filipinoSignals = ['ano', 'sino', 'ilan', 'magkano', 'ngayon', 'pinakamabenta', 'dapat', 'restock'];
  const englishSignals = ['what', 'who', 'how much', 'today', 'fast moving', 'top selling', 'restock'];

  const hasBisaya = bisayaSignals.some((term) => normalized.includes(term));
  const hasFilipino = filipinoSignals.some((term) => normalized.includes(term));
  const hasEnglish = englishSignals.some((term) => normalized.includes(term));

  if (hasBisaya) {
    return hasEnglish ? 'taglish' : 'bisaya';
  }

  if (hasFilipino && hasEnglish) {
    return 'taglish';
  }

  if (hasFilipino) {
    return 'filipino';
  }

  return 'english';
}

function detectAssistantIntent(question: string): AssistantIntent {
  const normalized = question.toLowerCase();
  const mutationSignals = [
    'ibawas',
    'idagdag',
    'bawas',
    'dagdag',
    'deduct',
    'minus',
    'add ',
    'record sale',
    'log sale',
    'update stock',
  ];

  if (mutationSignals.some((term) => normalized.includes(term))) {
    return 'mutation_request';
  }

  if (
    normalized.includes('fast moving') ||
    normalized.includes('top selling') ||
    normalized.includes('pinakamabenta') ||
    normalized.includes('mabenta')
  ) {
    return 'fast_moving';
  }

  if (normalized.includes('low stock') || normalized.includes('paubos') || normalized.includes('ubos')) {
    return 'low_stock';
  }

  if (
    normalized.includes('sales today') ||
    normalized.includes('benta ko today') ||
    normalized.includes('magkano benta') ||
    normalized.includes('today sales')
  ) {
    return 'today_sales';
  }

  if (normalized.includes('utang') || normalized.includes('who owes') || normalized.includes('may utang')) {
    return 'utang_balances';
  }

  if (normalized.includes('restock') || normalized.includes('reorder') || normalized.includes('i-restock')) {
    return 'restock_suggestions';
  }

  return 'unsupported';
}

function formatCurrencyPhp(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(value);
}

function buildDeterministicAnswer(intent: AssistantIntent, context: StoreAssistantContext, style: LanguageStyle) {
  if (intent === 'mutation_request') {
    if (style === 'english') {
      return 'I can answer questions only. Please log that stock change using the normal command input.';
    }
    if (style === 'bisaya') {
      return 'Pangutana ra ako karon. Palihog i-log ang stock change sa normal nga command input.';
    }
    return 'Pang-tanong lang ako ngayon. Paki-log ang stock change sa normal na command input.';
  }

  if (intent === 'fast_moving') {
    const top = context.topItemsToday[0];
    if (!top) {
      return style === 'english'
        ? 'No sold-item data yet for today.'
        : 'Wala pang sapat na benta data para today.';
    }
    return style === 'english'
      ? `${top.name} is the fastest moving today at ${top.units} units sold.`
      : `${top.name} ang pinaka-fast moving today, ${top.units} units sold.`;
  }

  if (intent === 'low_stock') {
    if (context.lowStockItems.length === 0) {
      return style === 'english' ? 'No low-stock items right now.' : 'Wala namang low-stock items ngayon.';
    }
    const top = context.lowStockItems.slice(0, 2).map((item) => `${item.name} (${item.currentStock} ${item.unit})`).join(', ');
    return style === 'english'
      ? `Low-stock items now: ${top}.`
      : `Ito ang low stock ngayon: ${top}.`;
  }

  if (intent === 'today_sales') {
    if (context.salesToday.transactionCount <= 0) {
      return style === 'english' ? 'No sales transactions yet for today.' : 'Wala pang sales transactions today.';
    }
    return style === 'english'
      ? `Today estimate is ${formatCurrencyPhp(context.salesToday.grossSales)} from ${context.salesToday.unitsSold} units.`
      : `Estimated benta today ay ${formatCurrencyPhp(context.salesToday.grossSales)} mula sa ${context.salesToday.unitsSold} units.`;
  }

  if (intent === 'utang_balances') {
    if (context.utangTop.length === 0) {
      return style === 'english' ? 'No open utang balance right now.' : 'Wala pang open utang balance ngayon.';
    }
    const top = context.utangTop.slice(0, 2).map((entry) => `${entry.customerName} (${formatCurrencyPhp(entry.balance)})`).join(', ');
    return style === 'english'
      ? `Top utang balances: ${top}.`
      : `Ito ang may utang ngayon: ${top}.`;
  }

  if (intent === 'restock_suggestions') {
    if (context.restockCandidates.length === 0) {
      return style === 'english'
        ? 'No urgent restock suggestion right now based on stock and movement.'
        : 'Wala pang urgent restock suggestion ngayon base sa stock at galaw ng benta.';
    }
    const top = context.restockCandidates[0];
    return style === 'english'
      ? `Prioritize restocking ${top.name}; stock is ${top.currentStock} ${top.unit} and sold ${top.soldLast7Days} in the last 7 days.`
      : `Unahin i-restock ang ${top.name}; stock ngayon ${top.currentStock} ${top.unit}, sold ${top.soldLast7Days} sa last 7 days.`;
  }

  return style === 'english'
    ? 'I can currently answer fast-moving items, low stock, sales today, utang balances, and restock suggestions.'
    : 'Sa ngayon nasasagot ko pa lang: fast moving items, low stock, benta today, utang balances, at restock suggestions.';
}

function buildGeminiPrompt(params: {
  questionText: string;
  intent: AssistantIntent;
  languageStyle: LanguageStyle;
  context: StoreAssistantContext;
  fallbackAnswer: string;
}) {
  return [
    'You are an inventory assistant for a sari-sari store.',
    'Return one concise answer only, max 2 short sentences.',
    'Do not mention internal system details.',
    'Never suggest direct mutation execution. This is read-only Q&A.',
    'Use the same user language style: english, filipino, taglish, or bisaya.',
    `language_style=${params.languageStyle}`,
    `intent=${params.intent}`,
    `question=${params.questionText}`,
    `store_context_json=${JSON.stringify(params.context)}`,
    `fallback_if_uncertain=${params.fallbackAnswer}`,
    'If data is missing, say so clearly without inventing numbers.',
  ].join('\n');
}

function answerLanguageMismatch(style: LanguageStyle, answer: string) {
  const normalized = answer.toLowerCase();
  const hasEnglish = /\b(what|today|stock|sales|restock|balance)\b/.test(normalized);
  const hasFilipino = /\b(ngayon|benta|utang|wala|ito|ang)\b/.test(normalized);
  const hasBisaya = /\b(karon|wala pa|ug|baligya|utang)\b/.test(normalized);

  if (style === 'english') {
    return !hasEnglish && (hasFilipino || hasBisaya);
  }

  if (style === 'bisaya') {
    return !hasBisaya && hasEnglish;
  }

  if (style === 'filipino') {
    return !hasFilipino && hasEnglish;
  }

  return false;
}

async function collectStoreAssistantContext(store: Store): Promise<StoreAssistantContext> {
  const supabase = getSupabaseAdminClient();
  const timeZone = store.timezone || 'Asia/Manila';
  const todayDate = getDateInTimeZone(new Date(), timeZone);
  const last7Dates = getLastNDatesInTimeZone(timeZone, 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const [{ data: inventoryRows, error: inventoryError }, { data: movementRows, error: movementsError }] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('id, name, unit, current_stock, low_stock_threshold, price')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .is('archived_at', null)
      .returns<InventoryRow[]>(),
    supabase
      .from('inventory_movements')
      .select('item_id, quantity_delta, movement_type, occurred_at')
      .eq('store_id', store.id)
      .in('movement_type', ['sale', 'utang_sale'])
      .gte('occurred_at', thirtyDaysAgo.toISOString())
      .returns<MovementRow[]>(),
  ]);

  if (inventoryError) {
    throw new Error('Unable to load inventory context.');
  }
  if (movementsError) {
    throw new Error('Unable to load movement context.');
  }

  const { data: summaryRows, error: summaryError } = await supabase
    .from('v_daily_sales_summary')
    .select('sale_date, gross_sales, units_sold, transaction_count')
    .eq('store_id', store.id)
    .order('sale_date', { ascending: false })
    .limit(14)
    .returns<DailySummaryRow[]>();

  if (summaryError) {
    throw new Error('Unable to load sales summary context.');
  }

  const { data: utangRows, error: utangError } = await supabase
    .from('customers')
    .select('display_name, utang_balance')
    .eq('store_id', store.id)
    .gt('utang_balance', 0)
    .order('utang_balance', { ascending: false })
    .limit(5)
    .returns<CustomerUtangRow[]>();

  if (utangError) {
    throw new Error('Unable to load utang context.');
  }

  const inventory = inventoryRows ?? [];
  const itemNameById = new Map(inventory.map((item) => [item.id, item.name]));
  const unitsTodayByItem = new Map<string, number>();
  const unitsLast7ByItem = new Map<string, number>();

  for (const movement of movementRows ?? []) {
    const dateInStore = getDateInTimeZone(movement.occurred_at, timeZone);
    const units = Math.abs(toNumber(movement.quantity_delta));

    if (dateInStore === todayDate) {
      unitsTodayByItem.set(movement.item_id, (unitsTodayByItem.get(movement.item_id) ?? 0) + units);
    }

    if (last7Dates.has(dateInStore)) {
      unitsLast7ByItem.set(movement.item_id, (unitsLast7ByItem.get(movement.item_id) ?? 0) + units);
    }
  }

  const lowStockItems = inventory
    .map((item) => ({
      name: item.name,
      currentStock: toNumber(item.current_stock),
      threshold: toNumber(item.low_stock_threshold),
      unit: item.unit,
    }))
    .filter((item) => item.currentStock <= item.threshold)
    .sort((a, b) => a.currentStock - b.currentStock);

  const topItemsToday = Array.from(unitsTodayByItem.entries())
    .map(([itemId, units]) => ({
      name: itemNameById.get(itemId) ?? 'Unknown Item',
      units,
    }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const restockCandidates = lowStockItems
    .map((item) => {
      const itemId = inventory.find((candidate) => candidate.name === item.name)?.id;
      return {
        ...item,
        soldLast7Days: itemId ? unitsLast7ByItem.get(itemId) ?? 0 : 0,
      };
    })
    .sort((a, b) => {
      const aDeficit = a.threshold - a.currentStock;
      const bDeficit = b.threshold - b.currentStock;
      if (aDeficit !== bDeficit) {
        return bDeficit - aDeficit;
      }
      return b.soldLast7Days - a.soldLast7Days;
    })
    .slice(0, 5);

  const summaryToday = (summaryRows ?? []).find((row) => row.sale_date === todayDate);
  const salesToday = {
    grossSales: summaryToday ? toNumber(summaryToday.gross_sales) : 0,
    unitsSold: summaryToday ? toNumber(summaryToday.units_sold) : 0,
    transactionCount: summaryToday ? toNumber(summaryToday.transaction_count) : 0,
  };

  return {
    todayDate,
    lowStockItems,
    topItemsToday,
    restockCandidates: restockCandidates.map((item) => ({
      name: item.name,
      currentStock: item.currentStock,
      threshold: item.threshold,
      soldLast7Days: item.soldLast7Days,
      unit: item.unit,
    })),
    utangTop: (utangRows ?? []).map((row) => ({
      customerName: row.display_name,
      balance: toNumber(row.utang_balance),
    })),
    salesToday,
  };
}

function normalizeActions(actions: unknown): unknown[] {
  return Array.isArray(actions) ? actions : [];
}

export async function answerAssistantQueryForOwner(
  ownerId: string,
  input: AssistantQueryInput,
): Promise<AssistantQueryResult> {
  const store = await getStoreByOwnerId(ownerId);
  if (!store) {
    throw new Error('Store not found.');
  }

  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from('assistant_interactions')
    .select('id, store_id, client_interaction_id, answer_text, spoken_text, actions, status, error_message')
    .eq('store_id', store.id)
    .eq('client_interaction_id', input.clientInteractionId)
    .maybeSingle<AssistantInteractionRow>();

  if (existingError) {
    throw new Error('Unable to verify assistant interaction idempotency.');
  }

  if (existing && existing.status === 'answered') {
    return {
      clientInteractionId: existing.client_interaction_id,
      status: 'answered',
      answerText: existing.answer_text ?? 'No answer available.',
      spokenText: existing.spoken_text,
      actions: normalizeActions(existing.actions),
    };
  }

  if (existing && existing.status === 'failed') {
    throw new Error(existing.error_message ?? 'This question failed previously.');
  }

  const env = getEnv();
  const languageStyle = detectLanguageStyle(input.questionText);
  const intent = detectAssistantIntent(input.questionText);
  const context = await collectStoreAssistantContext(store);
  const fallbackAnswer = buildDeterministicAnswer(intent, context, languageStyle);

  const { data: created, error: createError } = await supabase
    .from('assistant_interactions')
    .insert({
      store_id: store.id,
      user_id: ownerId,
      client_interaction_id: input.clientInteractionId,
      question_text: input.questionText,
      input_mode: input.inputMode,
      output_mode: input.outputMode,
      model: env.GEMINI_API_KEY ? env.GEMINI_MODEL : 'deterministic_fallback',
      status: 'pending',
      actions: [],
      context_snapshot: {
        intent,
        language_style: languageStyle,
        today_date: context.todayDate,
      },
      request_payload: {
        question_text: input.questionText,
        input_mode: input.inputMode,
        output_mode: input.outputMode,
      },
    })
    .select('id')
    .single<{ id: string }>();

  if (createError || !created) {
    throw new Error('Unable to create assistant interaction.');
  }

  let answerText = fallbackAnswer;
  let responsePayload: Record<string, unknown> = { provider: 'deterministic' };

  try {
    if (intent !== 'unsupported' && intent !== 'mutation_request' && env.GEMINI_API_KEY) {
      const basePrompt = buildGeminiPrompt({
        questionText: input.questionText,
        intent,
        languageStyle,
        context,
        fallbackAnswer,
      });

      const firstTry = await generateGeminiText(basePrompt);
      let finalAnswer = firstTry ?? fallbackAnswer;

      if (answerLanguageMismatch(languageStyle, finalAnswer)) {
        const retryPrompt = `${basePrompt}\n\nRetry in the same language style as the user question.`;
        finalAnswer = (await generateGeminiText(retryPrompt)) ?? finalAnswer;
      }

      answerText = finalAnswer;
      responsePayload = { provider: 'gemini', model: env.GEMINI_MODEL };
    }

    const { error: updateError } = await supabase
      .from('assistant_interactions')
      .update({
        status: 'answered',
        answer_text: answerText,
        spoken_text: null,
        actions: [],
        response_payload: responsePayload,
        answered_at: new Date().toISOString(),
      })
      .eq('id', created.id);

    if (updateError) {
      throw new Error('Unable to finalize assistant interaction.');
    }

    return {
      clientInteractionId: input.clientInteractionId,
      status: 'answered',
      answerText,
      spokenText: null,
      actions: [],
    };
  } catch (error) {
    await supabase
      .from('assistant_interactions')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown assistant failure.',
        response_payload: { provider: 'assistant', failed: true },
      })
      .eq('id', created.id);

    throw error;
  }
}
