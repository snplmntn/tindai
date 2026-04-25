import { describe, expect, it } from 'vitest';

import { parseOfflineCommand } from './offlineParser';
import type { LocalInventoryItem } from '@/features/local-db/types';

const inventory: LocalInventoryItem[] = [
  {
    id: 'item-coke',
    storeId: 'store-1',
    name: 'Coke Mismo',
    aliases: ['coke', 'coke mismo', 'mismo coke'],
    unit: 'pcs',
    price: 20,
    currentStock: 12,
    lowStockThreshold: 4,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
  {
    id: 'item-safeguard',
    storeId: 'store-1',
    name: 'Safeguard',
    aliases: ['safeguard'],
    unit: 'pcs',
    price: 25,
    currentStock: 8,
    lowStockThreshold: 3,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
  {
    id: 'item-eggs',
    storeId: 'store-1',
    name: 'Itlog',
    aliases: ['itlog', 'itlog na pula', 'egg', 'eggs'],
    unit: 'pcs',
    price: 10,
    currentStock: 30,
    lowStockThreshold: 6,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
];

describe('parseOfflineCommand', () => {
  it.each([
    ['Nakabenta ako ng dalawang Coke Mismo.', 'sale', 'item-coke', 2],
    ['Bawas isang Safeguard.', 'sale', 'item-safeguard', 1],
    ['Tatlong itlog nabenta.', 'sale', 'item-eggs', 3],
  ] as const)('parses ready demo sale command: %s', (rawText, intent, itemId, quantity) => {
    const result = parseOfflineCommand(rawText, inventory);

    expect(result).toMatchObject({
      raw_text: rawText,
      intent,
      status: 'ready_to_apply',
      credit: { is_utang: false },
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: itemId,
        quantity,
        quantity_delta: -quantity,
      }),
    ]);
  });

  it('parses a ready utang command with customer notes and item decrement', () => {
    const result = parseOfflineCommand('Kumuha si Mang Juan ng dalawang Coke, ilista mo muna.', inventory);

    expect(result).toMatchObject({
      intent: 'utang',
      status: 'ready_to_apply',
      credit: {
        is_utang: true,
        customer_name: 'Mang Juan',
      },
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-coke',
        quantity: 2,
        quantity_delta: -2,
      }),
    ]);
  });

  it('parses a restock command as an inventory increment', () => {
    const result = parseOfflineCommand('Dagdag limang Coke Mismo.', inventory);

    expect(result).toMatchObject({
      intent: 'restock',
      status: 'ready_to_apply',
      credit: { is_utang: false },
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-coke',
        quantity: 5,
        quantity_delta: 5,
      }),
    ]);
  });

  it('routes a low-stock business question without mutation items', () => {
    const result = parseOfflineCommand('Ano ang low stock ngayon?', inventory);

    expect(result).toMatchObject({
      intent: 'question',
      status: 'needs_confirmation',
      credit: { is_utang: false },
    });
    expect(result.items).toEqual([]);
    expect(result.notes).toContain('online_required');
  });

  it('avoids substring alias false positives from unrelated words', () => {
    const result = parseOfflineCommand('Tatlong megga sardinas nabenta.', inventory);

    expect(result.intent).toBe('unknown');
    expect(result.status).toBe('unparsed');
    expect(result.items).toEqual([]);
  });

  it('requires confirmation for utang when customer name is missing', () => {
    const result = parseOfflineCommand('Kumuha ng dalawang Coke, ilista mo muna.', inventory);

    expect(result.intent).toBe('utang');
    expect(result.status).toBe('needs_confirmation');
    expect(result.credit).toEqual({ is_utang: true });
    expect(result.notes).toContain('missing_customer_name');
  });

  it('returns unparsed when no dynamic local inventory item matches', () => {
    const result = parseOfflineCommand('Nakabenta ako ng dalawang Sprite.', inventory);

    expect(result.intent).toBe('unknown');
    expect(result.status).toBe('unparsed');
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.items).toEqual([]);
  });

  it.each([
    ['Nabaligya ko ug duha ka Coke Mismo.', 'sale', 'item-coke', 2],
    ['Idugang ang upat ka itlog.', 'restock', 'item-eggs', 4],
    ['Palihog lista sa utang ni Aling Nena ang tulo ka Safeguard.', 'utang', 'item-safeguard', 3],
  ] as const)('parses bisaya command variants: %s', (rawText, intent, itemId, quantity) => {
    const result = parseOfflineCommand(rawText, inventory);

    expect(result.intent).toBe(intent);
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: itemId,
        quantity,
        quantity_delta: intent === 'restock' ? quantity : -quantity,
      }),
    ]);
    expect(result.status).toBe('ready_to_apply');
  });

  it('parses mixed bisaya and english quantity phrases', () => {
    const result = parseOfflineCommand('Bawas one ka Safeguard lang.', inventory);

    expect(result).toMatchObject({
      intent: 'sale',
      status: 'ready_to_apply',
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-safeguard',
        quantity: 1,
        quantity_delta: -1,
      }),
    ]);
  });

  it('parses bisaya stock question as online-required and read-only', () => {
    const result = parseOfflineCommand('Unsa ang low stock karon?', inventory);

    expect(result).toMatchObject({
      intent: 'question',
      status: 'needs_confirmation',
    });
    expect(result.items).toEqual([]);
    expect(result.notes).toContain('online_required');
  });
});
