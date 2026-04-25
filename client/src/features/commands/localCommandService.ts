import type { LocalInventoryItem } from '@/features/local-db/types';
import { parseOfflineCommand, type ParserResult } from '@/features/parser/offlineParser';

export type CommandSource = 'typed' | 'voice' | 'manual';

type LedgerService = {
  applyReadyParserResult: (
    storeId: string,
    parserResult: ParserResult,
    options?: { source?: CommandSource },
  ) => Promise<{ transactionId: string; clientMutationId: string }>;
};

export type LocalCommandResult = {
  status: 'applied' | 'needs_confirmation' | 'online_required' | 'unparsed';
  parserResult: ParserResult;
  transactionId?: string;
  clientMutationId?: string;
};

export async function handleLocalCommand({
  rawText,
  storeId,
  inventoryItems,
  ledgerService,
  source = 'typed',
}: {
  rawText: string;
  storeId: string;
  inventoryItems: LocalInventoryItem[];
  ledgerService: LedgerService;
  source?: CommandSource;
}): Promise<LocalCommandResult> {
  const parserResult = parseOfflineCommand(rawText, inventoryItems);

  if (parserResult.intent === 'question') {
    return {
      status: 'online_required',
      parserResult,
    };
  }

  if (parserResult.status === 'ready_to_apply') {
    const applied = await ledgerService.applyReadyParserResult(storeId, parserResult, { source });

    return {
      status: 'applied',
      parserResult,
      transactionId: applied.transactionId,
      clientMutationId: applied.clientMutationId,
    };
  }

  return {
    status: parserResult.status === 'needs_confirmation' ? 'needs_confirmation' : 'unparsed',
    parserResult,
  };
}

export async function applyConfirmedParserResult({
  storeId,
  parserResult,
  ledgerService,
  source = 'typed',
  customerName,
}: {
  storeId: string;
  parserResult: ParserResult;
  ledgerService: LedgerService;
  source?: CommandSource;
  customerName?: string;
}): Promise<LocalCommandResult> {
  const normalizedCustomerName = customerName?.trim();

  const readyResult: ParserResult = {
    ...parserResult,
    confidence: Math.max(parserResult.confidence, 0.85),
    status: 'ready_to_apply',
    credit:
      parserResult.credit.is_utang && !parserResult.credit.customer_name && normalizedCustomerName
        ? {
            ...parserResult.credit,
            customer_name: normalizedCustomerName,
          }
        : parserResult.credit,
    notes: parserResult.notes.filter((note) => note !== 'missing_customer_name'),
  };

  if (readyResult.credit.is_utang && !readyResult.credit.customer_name) {
    throw new Error('Customer name is required for utang.');
  }

  const applied = await ledgerService.applyReadyParserResult(storeId, readyResult, { source });

  return {
    status: 'applied',
    parserResult: readyResult,
    transactionId: applied.transactionId,
    clientMutationId: applied.clientMutationId,
  };
}
