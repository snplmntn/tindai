import { describe, expect, it } from 'vitest';

import { parseOfflineCommand } from './offlineParser';
import type { LocalInventoryItem } from '@/features/local-db/types';

const inventory: LocalInventoryItem[] = [
  {
    id: 'item-coke',
    storeId: 'store-1',
    name: 'Coke Mismo',
    aliases: ['coke', 'coke mismo', 'coca cola'],
    unit: 'pcs',
    cost: null,
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
    cost: null,
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
    cost: null,
    price: 10,
    currentStock: 30,
    lowStockThreshold: 6,
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
];

describe('PRD Demo Command Set (Section 17)', () => {
  it('parses: Nakabenta ako ng dalawang Coke Mismo at isang Safeguard.', () => {
    const result = parseOfflineCommand('Nakabenta ako ng dalawang Coke Mismo at isang Safeguard.', inventory);

    console.log('Command 1 result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('sale');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      item_id: 'item-coke',
      quantity_delta: -2,
    });
    expect(result.items[1]).toMatchObject({
      item_id: 'item-safeguard',
      quantity_delta: -1,
    });
  });

  it('parses: Tatlong itlog nabenta.', () => {
    const result = parseOfflineCommand('Tatlong itlog nabenta.', inventory);

    console.log('Command 2 result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('sale');
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-eggs',
        quantity_delta: -3,
      }),
    ]);
  });

  it('parses: Kumuha si Mang Juan ng dalawang Coke Mismo, ilista mo muna.', () => {
    const result = parseOfflineCommand('Kumuha si Mang Juan ng dalawang Coke Mismo, ilista mo muna.', inventory);

    console.log('Command 3 result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('utang');
    expect(result.credit.is_utang).toBe(true);
    expect(result.credit.customer_name).toBe('Mang Juan');
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-coke',
        quantity_delta: -2,
      }),
    ]);
  });

  it('parses: Nabaligya kog duha ka Coke.', () => {
    const result = parseOfflineCommand('Nabaligya kog duha ka Coke.', inventory);

    console.log('Command 4 result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('sale');
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-coke',
        quantity_delta: -2,
      }),
    ]);
  });

  it('parses: Usa ka Safeguard giutang ni Aling Maria.', () => {
    const result = parseOfflineCommand('Usa ka Safeguard giutang ni Aling Maria.', inventory);

    console.log('Command 5 result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('utang');
    expect(result.credit.is_utang).toBe(true);
    expect(result.credit.customer_name).toBe('Aling Maria');
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-safeguard',
        quantity_delta: -1,
      }),
    ]);
  });

  it('parses: Dugang lima ka itlog.', () => {
    const result = parseOfflineCommand('Dugang lima ka itlog.', inventory);

    console.log('Command 6 result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('restock');
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-eggs',
        quantity_delta: 5,
      }),
    ]);
  });

  it('parses: Sold 2 Coke ug 1 Safeguard.', () => {
    const result = parseOfflineCommand('Sold 2 Coke ug 1 Safeguard.', inventory);

    console.log('Command 7 result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('sale');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      item_id: 'item-coke',
      quantity_delta: -2,
    });
    expect(result.items[1]).toMatchObject({
      item_id: 'item-safeguard',
      quantity_delta: -1,
    });
  });

  it('parses: Palista si Junjun, tulo ka itlog.', () => {
    const result = parseOfflineCommand('Palista si Junjun, tulo ka itlog.', inventory);

    console.log('Command 8 result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('utang');
    expect(result.credit.is_utang).toBe(true);
    expect(result.credit.customer_name).toBe('Junjun');
    expect(result.items).toEqual([
      expect.objectContaining({
        item_id: 'item-eggs',
        quantity_delta: -3,
      }),
    ]);
  });
});


describe('Multi-item parsing edge cases', () => {
  it('parses multi-item with "at" connector (Tagalog)', () => {
    const result = parseOfflineCommand('Nakabenta ako ng dalawang Coke Mismo at isang Safeguard.', inventory);

    console.log('Multi-item "at" result:', JSON.stringify(result, null, 2));

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      item_id: 'item-coke',
      quantity_delta: -2,
    });
    expect(result.items[1]).toMatchObject({
      item_id: 'item-safeguard',
      quantity_delta: -1,
    });
  });

  it('parses multi-item with "ug" connector (Bisaya)', () => {
    const result = parseOfflineCommand('Sold 2 Coke ug 1 Safeguard.', inventory);

    console.log('Multi-item "ug" result:', JSON.stringify(result, null, 2));

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      item_id: 'item-coke',
      quantity_delta: -2,
    });
    expect(result.items[1]).toMatchObject({
      item_id: 'item-safeguard',
      quantity_delta: -1,
    });
  });

  it('parses multi-item with "and" connector (English)', () => {
    const result = parseOfflineCommand('Sold 2 Coke and 1 Safeguard.', inventory);

    console.log('Multi-item "and" result:', JSON.stringify(result, null, 2));

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      item_id: 'item-coke',
      quantity_delta: -2,
    });
    expect(result.items[1]).toMatchObject({
      item_id: 'item-safeguard',
      quantity_delta: -1,
    });
  });

  it('parses three items with mixed connectors', () => {
    const result = parseOfflineCommand('Nakabenta ng 2 Coke, 1 Safeguard, at 3 Itlog.', inventory);

    console.log('Three items result:', JSON.stringify(result, null, 2));

    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({ item_id: 'item-coke', quantity_delta: -2 });
    expect(result.items[1]).toMatchObject({ item_id: 'item-safeguard', quantity_delta: -1 });
    expect(result.items[2]).toMatchObject({ item_id: 'item-eggs', quantity_delta: -3 });
  });
});


describe('Customer extraction edge cases', () => {
  it('extracts multi-word customer name with "si" pattern', () => {
    const result = parseOfflineCommand('Kumuha si Juan Dela Cruz ng 2 Coke.', inventory);

    console.log('Multi-word customer "si" result:', JSON.stringify(result, null, 2));

    expect(result.credit.is_utang).toBe(true);
    expect(result.credit.customer_name).toBe('Juan Dela Cruz');
  });

  it('extracts multi-word customer name with "ni" pattern', () => {
    const result = parseOfflineCommand('Usa ka Safeguard giutang ni Maria Santos.', inventory);

    console.log('Multi-word customer "ni" result:', JSON.stringify(result, null, 2));

    expect(result.credit.is_utang).toBe(true);
    expect(result.credit.customer_name).toBe('Maria Santos');
  });

  it('extracts customer name at end of sentence', () => {
    const result = parseOfflineCommand('Ilista mo ang 2 Coke para kay Mang Tonio.', inventory);

    console.log('Customer at end result:', JSON.stringify(result, null, 2));

    // Should still extract customer even if at end
    expect(result.credit.is_utang).toBe(true);
  });

  it('handles customer name with nickname/honorific', () => {
    const result = parseOfflineCommand('Kumuha si Aling Nena ng 3 Itlog, ilista mo.', inventory);

    console.log('Customer with honorific result:', JSON.stringify(result, null, 2));

    expect(result.credit.is_utang).toBe(true);
    expect(result.credit.customer_name).toContain('Nena');
  });

  it('extracts customer name when quantity follows', () => {
    const result = parseOfflineCommand('Palista si Junjun 3 ka itlog.', inventory);

    console.log('Customer before quantity result:', JSON.stringify(result, null, 2));

    expect(result.credit.is_utang).toBe(true);
    expect(result.credit.customer_name).toBe('Junjun');
    expect(result.items[0].quantity_delta).toBe(-3);
  });
});


describe('Confidence scoring validation', () => {
  it('high confidence (>= 0.60) for clear demo commands', () => {
    const testCases = [
      'Nakabenta ako ng dalawang Coke Mismo at isang Safeguard.',
      'Tatlong itlog nabenta.',
      'Kumuha si Mang Juan ng dalawang Coke Mismo, ilista mo muna.',
      'Nabaligya kog duha ka Coke.',
      'Usa ka Safeguard giutang ni Aling Maria.',
      'Dugang lima ka itlog.',
      'Sold 2 Coke ug 1 Safeguard.',
      'Palista si Junjun, tulo ka itlog.',
    ];

    testCases.forEach((command) => {
      const result = parseOfflineCommand(command, inventory);
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.status).toBe('ready_to_apply');
    });
  });

  it('medium confidence (0.35-0.59) for ambiguous commands', () => {
    const result = parseOfflineCommand('Kumuha ng dalawang Coke, ilista mo muna.', inventory);

    console.log('Ambiguous command result:', JSON.stringify(result, null, 2));

    expect(result.confidence).toBeGreaterThanOrEqual(0.35);
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.status).toBe('needs_confirmation');
    expect(result.notes).toContain('missing_customer_name');
  });

  it('low confidence (< 0.35) for unknown commands', () => {
    const result = parseOfflineCommand('Kuan kato ganina kang Juan', inventory);

    console.log('Unknown command result:', JSON.stringify(result, null, 2));

    expect(result.confidence).toBeLessThan(0.35);
    expect(result.status).toBe('unparsed');
  });

  it('no false positives for substring matches', () => {
    const result = parseOfflineCommand('Tatlong megga sardinas nabenta.', inventory);

    console.log('False positive test result:', JSON.stringify(result, null, 2));

    expect(result.intent).toBe('unknown');
    expect(result.status).toBe('unparsed');
    expect(result.confidence).toBeLessThan(0.35);
  });
});
