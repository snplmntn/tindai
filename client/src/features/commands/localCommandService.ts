import type { LocalInventoryItem } from '@/features/local-db/types';
import { parseOfflineCommand, type ParserResult } from '@/features/parser/offlineParser';

type LedgerService = {
  applyReadyParserResult: (
    storeId: string,
    parserResult: ParserResult,
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
}: {
  rawText: string;
  storeId: string;
  inventoryItems: LocalInventoryItem[];
  ledgerService: LedgerService;
}): Promise<LocalCommandResult> {
  const parserResult = parseOfflineCommand(rawText, inventoryItems);

  if (parserResult.intent === 'question') {
    return {
      status: 'online_required',
      parserResult,
    };
  }

  if (parserResult.status === 'ready_to_apply') {
    const applied = await ledgerService.applyReadyParserResult(storeId, parserResult);

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
