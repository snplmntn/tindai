import { describe, expect, it } from 'vitest';

import { validateGeminiTransactionResponse } from '../services/gemini.service';

describe('validateGeminiTransactionResponse', () => {
  it('parses a valid transaction verification payload', () => {
    const result = validateGeminiTransactionResponse(`{
      "intent": "sale",
      "confidence": 0.91,
      "items": [
        {
          "spoken_name": "coke",
          "matched_item_name": "Coke Mismo",
          "quantity_delta": -2
        }
      ],
      "credit": {
        "is_utang": false,
        "customer_name": null
      },
      "notes": []
    }`);

    expect(result.intent).toBe('sale');
    expect(result.confidence).toBe(0.91);
    expect(result.items).toEqual([
      {
        spoken_name: 'coke',
        matched_item_name: 'Coke Mismo',
        quantity_delta: -2,
      },
    ]);
    expect(result.credit).toEqual({
      is_utang: false,
      customer_name: null,
    });
  });

  it('rejects malformed JSON', () => {
    expect(() => validateGeminiTransactionResponse('{')).toThrow(
      'Gemini response validation failed:',
    );
  });

  it('parses json wrapped in markdown fences', () => {
    const result = validateGeminiTransactionResponse(`\`\`\`json
    {
      "intent": "utang",
      "confidence": 0.82,
      "items": [
        {
          "spoken_name": "coke",
          "matched_item_name": "Coke Mismo",
          "quantity_delta": -1
        }
      ],
      "credit": {
        "is_utang": true,
        "customer_name": "Mang Juan"
      },
      "notes": []
    }
    \`\`\``);

    expect(result.intent).toBe('utang');
    expect(result.credit).toEqual({
      is_utang: true,
      customer_name: 'Mang Juan',
    });
  });

  it('rejects invalid confidence values', () => {
    expect(() =>
      validateGeminiTransactionResponse(`{
        "intent": "sale",
        "confidence": 2,
        "items": [],
        "credit": {
          "is_utang": false
        },
        "notes": []
      }`),
    ).toThrow('Gemini response validation failed: Invalid confidence: 2');
  });
});
