import { describe, expect, it, vi } from 'vitest';

import { handleLocalCommand } from './localCommandService';
import type { LocalInventoryItem } from '@/features/local-db/types';

const inventory: LocalInventoryItem[] = [
  {
    id: 'item-coke',
    storeId: 'store-1',
    name: 'Coke Mismo',
    aliases: ['coke', 'coke mismo'],
    unit: 'pcs',
    price: 20,
    currentStock: 12,
    lowStockThreshold: 4,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
];

describe('handleLocalCommand', () => {
  it('applies ready inventory parser results through the local ledger', async () => {
    const ledgerService = {
      applyReadyParserResult: vi.fn().mockResolvedValue({
        transactionId: 'transaction-1',
        clientMutationId: 'client-mutation-1',
      }),
    };

    const result = await handleLocalCommand({
      rawText: 'Nakabenta ako ng dalawang Coke Mismo.',
      storeId: 'store-1',
      inventoryItems: inventory,
      ledgerService,
    });

    expect(result.status).toBe('applied');
    expect(result.parserResult.status).toBe('ready_to_apply');
    expect(ledgerService.applyReadyParserResult).toHaveBeenCalledWith('store-1', result.parserResult);
  });

  it('routes questions as online-required without mutating the ledger', async () => {
    const ledgerService = {
      applyReadyParserResult: vi.fn(),
    };

    const result = await handleLocalCommand({
      rawText: 'Ano ang low stock ngayon?',
      storeId: 'store-1',
      inventoryItems: inventory,
      ledgerService,
    });

    expect(result.status).toBe('online_required');
    expect(result.parserResult.intent).toBe('question');
    expect(ledgerService.applyReadyParserResult).not.toHaveBeenCalled();
  });
});
