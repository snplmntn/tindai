import { getEnv } from '../config/env';
import type { GeminiTransactionVerification } from '../types/gemini';

const ALLOWED_TRANSACTION_INTENTS = ['sale', 'restock', 'utang', 'unknown'] as const;

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
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

export async function generateGeminiText(
  prompt: string,
  options?: {
    responseMimeType?: 'application/json' | 'text/plain';
    responseSchema?: Record<string, unknown>;
  },
): Promise<string | null> {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 180,
          ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          ...(options?.responseSchema ? { responseSchema: options.responseSchema } : {}),
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorBody}`.slice(0, 300));
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
  return text || null;
}

export function validateGeminiTransactionResponse(
  rawResponse: string,
): GeminiTransactionVerification {
  try {
    const parsed = JSON.parse(extractJsonPayload(rawResponse)) as Partial<GeminiTransactionVerification>;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Response must be a JSON object');
    }

    if (!ALLOWED_TRANSACTION_INTENTS.includes(String(parsed.intent) as (typeof ALLOWED_TRANSACTION_INTENTS)[number])) {
      throw new Error(`Invalid intent: ${String(parsed.intent)}`);
    }

    if (
      typeof parsed.confidence !== 'number' ||
      Number.isNaN(parsed.confidence) ||
      parsed.confidence < 0 ||
      parsed.confidence > 1
    ) {
      throw new Error(`Invalid confidence: ${String(parsed.confidence)}`);
    }

    if (!Array.isArray(parsed.items)) {
      throw new Error('Items must be an array');
    }

    if (!parsed.credit || typeof parsed.credit.is_utang !== 'boolean') {
      throw new Error('Invalid credit object');
    }

    if (!Array.isArray(parsed.notes)) {
      throw new Error('Notes must be an array');
    }

    for (const item of parsed.items) {
      if (!item || typeof item !== 'object') {
        throw new Error('Invalid item entry');
      }

      if (typeof item.spoken_name !== 'string' || item.spoken_name.trim().length === 0) {
        throw new Error('Invalid spoken_name');
      }

      if (
        typeof item.matched_item_name !== 'string' ||
        item.matched_item_name.trim().length === 0
      ) {
        throw new Error('Invalid matched_item_name');
      }

      if (
        typeof item.quantity_delta !== 'number' ||
        Number.isNaN(item.quantity_delta) ||
        item.quantity_delta === 0
      ) {
        throw new Error('Invalid quantity_delta');
      }
    }

    return {
      intent: parsed.intent as GeminiTransactionVerification['intent'],
      confidence: parsed.confidence,
      items: parsed.items,
      credit: {
        is_utang: parsed.credit.is_utang,
        customer_name:
          typeof parsed.credit.customer_name === 'string' && parsed.credit.customer_name.trim().length > 0
            ? parsed.credit.customer_name.trim()
            : null,
      },
      notes: parsed.notes.map((note) => String(note)),
    };
  } catch (error) {
    throw new Error(
      `Gemini response validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
