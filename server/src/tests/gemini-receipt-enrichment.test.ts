import { describe, expect, it } from 'vitest';

import {
  buildReceiptParseFallbackPrompt,
  buildReceiptNameEnrichmentPrompt,
  validateGeminiReceiptParseFallbackResponse,
  validateGeminiReceiptNameEnrichmentResponse,
} from '../services/gemini-receipt-enrichment';

describe('gemini receipt enrichment', () => {
  it('builds a prompt with parsed items and inventory context', () => {
    const prompt = buildReceiptNameEnrichmentPrompt({
      rawText: 'Select Soy Sauce 200ml/48 96 9.40',
      parsedItems: [
        {
          receiptItemId: 'receipt-1-item-1',
          rawName: 'Select Soy Sauce 200ml/48',
          quantity: 96,
          unitPrice: 9.4,
          lineTotal: 902.4,
        },
      ],
      inventoryItems: [
        {
          name: 'Select Soy Sauce 200ml',
          sku: 'SEL-SOY-200',
          aliases: ['select soy sauce 200ml', 'soy sauce select 200ml'],
        },
      ],
    });

    expect(prompt).toContain('Select Soy Sauce 200ml/48');
    expect(prompt).toContain('Select Soy Sauce 200ml');
    expect(prompt).toContain('receipt-1-item-1');
  });

  it('validates strict JSON-only enrichment output', () => {
    const result = validateGeminiReceiptNameEnrichmentResponse(`{
      "items": [
        {
          "receiptItemId": "receipt-1-item-1",
          "displayName": "Select Soy Sauce 200ml",
          "confidence": 0.93
        }
      ]
    }`);

    expect(result).toEqual({
      items: [
        {
          receiptItemId: 'receipt-1-item-1',
          displayName: 'Select Soy Sauce 200ml',
          confidence: 0.93,
        },
      ],
    });
  });

  it('parses enrichment output even when gemini adds a short preamble', () => {
    const result = validateGeminiReceiptNameEnrichmentResponse(`Here is the JSON:
    {
      "items": [
        {
          "receiptItemId": "receipt-1-item-1",
          "displayName": "Select Soy Sauce 200ml",
          "confidence": 0.93
        }
      ]
    }`);

    expect(result).toEqual({
      items: [
        {
          receiptItemId: 'receipt-1-item-1',
          displayName: 'Select Soy Sauce 200ml',
          confidence: 0.93,
        },
      ],
    });
  });

  it('builds a parse fallback prompt for raw OCR text', () => {
    const prompt = buildReceiptParseFallbackPrompt({
      rawText: 'Select Soy Sauce 200ml/48 96 9.40',
      inventoryItems: [
        {
          name: 'Select Soy Sauce 200ml',
          sku: 'SEL-SOY-200',
          aliases: ['select soy sauce 200ml'],
        },
      ],
    });

    expect(prompt).toContain('Select Soy Sauce 200ml/48 96 9.40');
    expect(prompt).toContain('Your entire reply must be one valid JSON object.');
    expect(prompt).toContain('Do not write phrases like "Here is the JSON".');
  });

  it('validates strict JSON-only fallback parse output', () => {
    const result = validateGeminiReceiptParseFallbackResponse(`{
      "items": [
        {
          "rawName": "Select Soy Sauce 200ml/48",
          "displayName": "Select Soy Sauce 200ml",
          "quantity": 96,
          "unitPrice": 9.4,
          "lineTotal": 902.4,
          "confidence": 0.88
        }
      ]
    }`);

    expect(result).toEqual({
      items: [
        {
          rawName: 'Select Soy Sauce 200ml/48',
          displayName: 'Select Soy Sauce 200ml',
          quantity: 96,
          unitPrice: 9.4,
          lineTotal: 902.4,
          confidence: 0.88,
        },
      ],
    });
  });

  it('parses fallback output even when gemini adds a short preamble', () => {
    const result = validateGeminiReceiptParseFallbackResponse(`Here's the JSON:
    {
      "items": [
        {
          "rawName": "Select Soy Sauce 200ml/48",
          "displayName": "Select Soy Sauce 200ml",
          "quantity": 96,
          "unitPrice": 9.4,
          "lineTotal": 902.4,
          "confidence": 0.88
        }
      ]
    }`);

    expect(result).toEqual({
      items: [
        {
          rawName: 'Select Soy Sauce 200ml/48',
          displayName: 'Select Soy Sauce 200ml',
          quantity: 96,
          unitPrice: 9.4,
          lineTotal: 902.4,
          confidence: 0.88,
        },
      ],
    });
  });
});
