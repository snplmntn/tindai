type ReceiptInventoryContextItem = {
  name: string;
  sku: string | null;
  aliases: string[];
};

type ReceiptParsedItemContext = {
  receiptItemId: string;
  rawName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
};

export type GeminiReceiptParsedItem = {
  rawName: string;
  displayName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  confidence: number;
};

export type GeminiReceiptNameEnrichment = {
  items: Array<{
    receiptItemId: string;
    displayName: string;
    confidence: number;
  }>;
};

export type GeminiReceiptParseFallback = {
  items: GeminiReceiptParsedItem[];
};

function extractJsonPayload(rawResponse: string) {
  const trimmed = rawResponse.trim().replace(/^\uFEFF/, '');
  if (trimmed.startsWith('```')) {
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced?.[1]) {
      return extractJsonPayload(fenced[1]);
    }
  }

  const firstObjectIndex = trimmed.indexOf('{');
  const lastObjectIndex = trimmed.lastIndexOf('}');
  if (firstObjectIndex >= 0 && lastObjectIndex > firstObjectIndex) {
    return trimmed.slice(firstObjectIndex, lastObjectIndex + 1).trim();
  }

  return trimmed;
}

export function buildReceiptNameEnrichmentPrompt(params: {
  rawText: string;
  parsedItems: ReceiptParsedItemContext[];
  inventoryItems: ReceiptInventoryContextItem[];
}) {
  return `
You are a JSON API for a sari-sari store receipt app.

Your entire reply must be one valid JSON object.
Do not write markdown.
Do not write code fences.
Do not write explanations.
Do not write notes.
Do not write any text before or after the JSON.
Do not write phrases like "Here is the JSON".
Do not wrap the JSON in quotes.
Your response will be passed directly to JSON.parse().
If you add any extra text, the response will fail and be discarded.
If you cannot comply, return {"items":[]}.

Task:
- Clean abbreviated or code-like receipt item names into clearer full product names when the evidence is strong.
- Prefer names that align with the provided store inventory, SKUs, and aliases.
- Keep the meaning close to the receipt text.
- Do not invent unsupported brands, sizes, variants, or pack counts.
- If unsure, keep the item close to the original receipt wording.

Return exactly this JSON shape:
{
  "items": [
    {
      "receiptItemId": "string",
      "displayName": "string",
      "confidence": 0.0
    }
  ]
}

Rules:
- Include one output item for every parsed item.
- Keep each receiptItemId unchanged.
- confidence must be between 0 and 1.
- displayName must be short, clear, and suitable for a store owner to review.
- Output must be parseable by JSON.parse with no preprocessing.
- The first character of your reply must be {.
- The last character of your reply must be }.
- Reply with the JSON object only. No extra words.

Example valid reply:
{"items":[{"receiptItemId":"receipt-1-item-1","displayName":"Coca-Cola 1.5 Liter","confidence":0.91}]}

Another valid reply:
{
  "items": [
    {
      "receiptItemId": "receipt-1-item-1",
      "displayName": "Cheese Dog",
      "confidence": 0.94
    },
    {
      "receiptItemId": "receipt-1-item-2",
      "displayName": "Select Soy Sauce 350ml",
      "confidence": 0.89
    },
    {
      "receiptItemId": "receipt-1-item-3",
      "displayName": "Wings Powder Floral Fresh 60g",
      "confidence": 0.86
    }
  ]
}

Receipt OCR text:
${params.rawText}

Parsed receipt items:
${JSON.stringify(params.parsedItems, null, 2)}

Store inventory context:
${JSON.stringify(params.inventoryItems, null, 2)}
`.trim();
}

export function buildReceiptParseFallbackPrompt(params: {
  rawText: string;
  inventoryItems: ReceiptInventoryContextItem[];
}) {
  return `
You are a JSON API for a sari-sari store receipt app.

Your entire reply must be one valid JSON object.
Do not write markdown.
Do not write code fences.
Do not write explanations.
Do not write notes.
Do not write any text before or after the JSON.
Do not write phrases like "Here is the JSON".
Do not wrap the JSON in quotes.
Your response will be passed directly to JSON.parse().
If you add any extra text, the response will fail and be discarded.
If you cannot comply, return {"items":[]}.

Task:
- Find likely stock-in line items from the OCR text.
- Expand abbreviated or code-like names into clear review-friendly names when the evidence is strong.
- Use the provided store inventory, SKUs, and aliases as hints, but do not force a match when the OCR text does not support it.
- Ignore receipt totals, VAT, change, payment, transaction footer text, and customer info.

Return exactly this JSON shape:
{
  "items": [
    {
      "rawName": "string",
      "displayName": "string",
      "quantity": 1,
      "unitPrice": 0,
      "lineTotal": 0,
      "confidence": 0.0
    }
  ]
}

Rules:
- Return only likely stock line items.
- If quantity is unclear, use 1.
- If unitPrice is unclear, return null.
- If lineTotal is unclear, return null.
- confidence must be between 0 and 1.
- displayName must be short and clear for a store owner.
- rawName should stay close to the receipt wording.
- Output must be parseable by JSON.parse with no preprocessing.
- The first character of your reply must be {.
- The last character of your reply must be }.
- Reply with the JSON object only. No extra words.

Example valid reply:
{"items":[{"rawName":"Select Soy Sauce 200ml/48","displayName":"Select Soy Sauce 200ml","quantity":96,"unitPrice":9.4,"lineTotal":902.4,"confidence":0.88}]}

Another valid reply:
{
  "items": [
    {
      "rawName": "CHSDOG",
      "displayName": "Cheese Dog",
      "quantity": 24,
      "unitPrice": 7.5,
      "lineTotal": 180,
      "confidence": 0.93
    },
    {
      "rawName": "Select Soy Sauce 350ml/24",
      "displayName": "Select Soy Sauce 350ml",
      "quantity": 24,
      "unitPrice": 17.6,
      "lineTotal": 422.4,
      "confidence": 0.89
    },
    {
      "rawName": "Wings Solve Pwd Floral Fresh 60g/150",
      "displayName": "Wings Powder Floral Fresh 60g",
      "quantity": 150,
      "unitPrice": 5.85,
      "lineTotal": 877.5,
      "confidence": 0.87
    }
  ]
}

Receipt OCR text:
${params.rawText}

Store inventory context:
${JSON.stringify(params.inventoryItems, null, 2)}
`.trim();
}

export function validateGeminiReceiptNameEnrichmentResponse(
  rawResponse: string,
): GeminiReceiptNameEnrichment {
  try {
    const parsed = JSON.parse(extractJsonPayload(rawResponse)) as Partial<GeminiReceiptNameEnrichment>;

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      throw new Error('items must be an array');
    }

    const items = parsed.items.map((item) => {
      if (!item || typeof item !== 'object') {
        throw new Error('invalid item entry');
      }

      if (typeof item.receiptItemId !== 'string' || item.receiptItemId.trim().length === 0) {
        throw new Error('invalid receiptItemId');
      }

      if (typeof item.displayName !== 'string' || item.displayName.trim().length === 0) {
        throw new Error('invalid displayName');
      }

      if (
        typeof item.confidence !== 'number' ||
        Number.isNaN(item.confidence) ||
        item.confidence < 0 ||
        item.confidence > 1
      ) {
        throw new Error('invalid confidence');
      }

      return {
        receiptItemId: item.receiptItemId.trim(),
        displayName: item.displayName.trim(),
        confidence: item.confidence,
      };
    });

    return { items };
  } catch (error) {
    throw new Error(
      `Gemini receipt enrichment validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function validateGeminiReceiptParseFallbackResponse(
  rawResponse: string,
): GeminiReceiptParseFallback {
  try {
    const parsed = JSON.parse(extractJsonPayload(rawResponse)) as Partial<GeminiReceiptParseFallback>;

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      throw new Error('items must be an array');
    }

    const items = parsed.items.map((item) => {
      if (!item || typeof item !== 'object') {
        throw new Error('invalid item entry');
      }

      if (typeof item.rawName !== 'string' || item.rawName.trim().length === 0) {
        throw new Error('invalid rawName');
      }

      if (typeof item.displayName !== 'string' || item.displayName.trim().length === 0) {
        throw new Error('invalid displayName');
      }

      if (typeof item.quantity !== 'number' || Number.isNaN(item.quantity) || item.quantity <= 0) {
        throw new Error('invalid quantity');
      }

      if (item.unitPrice !== null && item.unitPrice !== undefined && (typeof item.unitPrice !== 'number' || Number.isNaN(item.unitPrice) || item.unitPrice < 0)) {
        throw new Error('invalid unitPrice');
      }

      if (item.lineTotal !== null && item.lineTotal !== undefined && (typeof item.lineTotal !== 'number' || Number.isNaN(item.lineTotal) || item.lineTotal < 0)) {
        throw new Error('invalid lineTotal');
      }

      if (
        typeof item.confidence !== 'number' ||
        Number.isNaN(item.confidence) ||
        item.confidence < 0 ||
        item.confidence > 1
      ) {
        throw new Error('invalid confidence');
      }

      return {
        rawName: item.rawName.trim(),
        displayName: item.displayName.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? null,
        lineTotal: item.lineTotal ?? null,
        confidence: item.confidence,
      };
    });

    return { items };
  } catch (error) {
    throw new Error(
      `Gemini receipt parse fallback validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
