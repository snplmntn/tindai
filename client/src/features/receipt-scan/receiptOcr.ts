import type { ReceiptImageDraft } from './receiptCapture';

export type ReceiptOcrBlock = {
  text: string;
  lines?: string[];
  recognizedLanguages?: string[];
};

export type ReceiptOcrImageMeta = {
  width: number;
  height: number;
  fileSize: number;
};

export type ReceiptOcrExtraction = {
  provider: 'ml_kit';
  rawText: string;
  ocrBlocks: ReceiptOcrBlock[];
  imageMeta: ReceiptOcrImageMeta;
};

export type ReceiptOcrAssessment = {
  status: 'usable' | 'weak';
  message: string | null;
};

export type ReceiptProcessingState =
  | {
      status: 'idle';
    }
  | {
      status: 'running_ocr' | 'uploading_ocr' | 'parsing_receipt' | 'matching_items' | 'confirming_receipt';
      receiptId: string;
    }
  | {
      status: 'weak_text';
      receiptId: string;
      extraction: ReceiptOcrExtraction;
      message: string;
    }
  | {
      status: 'succeeded';
      receiptId: string;
      extraction: ReceiptOcrExtraction;
      reviewStatus: 'ready_for_parse' | 'needs_retry';
      message: string | null;
    }
  | {
      status: 'failed';
      receiptId: string;
      message: string;
    };

const MIN_USABLE_CHARACTER_COUNT = 12;
const MIN_WORD_COUNT = 3;

type MlKitTextLine = {
  text: string;
};

type MlKitTextBlock = {
  text: string;
  lines: MlKitTextLine[];
  recognizedLanguages?: Array<{
    languageCode: string;
  }>;
};

type MlKitTextRecognitionResult = {
  text: string;
  blocks: MlKitTextBlock[];
};

export function getReceiptImageMeta(draft: ReceiptImageDraft): ReceiptOcrImageMeta {
  return {
    width: draft.width,
    height: draft.height,
    fileSize: draft.fileSize,
  };
}

export function assessReceiptOcrText(rawText: string): ReceiptOcrAssessment {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  const usableCharacterCount = normalized.replace(/[^a-z0-9]/gi, '').length;
  const wordCount = normalized ? normalized.split(' ').length : 0;

  if (!normalized || usableCharacterCount < MIN_USABLE_CHARACTER_COUNT || wordCount < MIN_WORD_COUNT) {
    return {
      status: 'weak',
      message: 'Kaunti pa lang ang nabasang laman ng resibo. Subukan ulit ang mas malinaw na kuha.',
    };
  }

  return {
    status: 'usable',
    message: null,
  };
}

function getReceiptOcrImageUrl(draft: ReceiptImageDraft) {
  return draft.compressedUri || draft.originalUri;
}

function getReceiptOcrImageCandidates(draft: ReceiptImageDraft) {
  return Array.from(new Set([draft.compressedUri, draft.originalUri].filter(Boolean)));
}

function mapMlKitBlocks(blocks: MlKitTextBlock[]): ReceiptOcrBlock[] {
  return blocks
    .filter((block) => block.text.trim())
    .map((block) => ({
      text: block.text,
      lines: block.lines.map((line) => line.text).filter(Boolean),
      recognizedLanguages: (block.recognizedLanguages ?? [])
        .map((language) => language.languageCode)
        .filter(Boolean),
    }));
}

function buildReceiptOcrErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Hindi mabasa ang resibo sa ngayon.';
  }

  const message = error.message.toLowerCase();
  if (message.includes("doesn't seem to be linked") || message.includes('rebuilt the app')) {
    return 'Kailangan munang i-rebuild ang Android app para gumana ang pagbasa ng resibo.';
  }

  if (message.includes('no such file') || message.includes('enoent') || message.includes('cannot open')) {
    return 'Hindi makita ang image file ng resibo. Subukan ulit pumili o kumuha ng larawan.';
  }

  if (message.includes('permission')) {
    return 'Walang pahintulot para basahin ang larawang ito ng resibo.';
  }

  return error.message;
}

function loadTextRecognitionModule() {
  try {
    return require('@react-native-ml-kit/text-recognition').default as {
      recognize: (imageUrl: string) => Promise<MlKitTextRecognitionResult>;
    };
  } catch {
    throw new Error('Hindi pa handa ang OCR module sa build na ito.');
  }
}

export async function extractReceiptText(
  draft: ReceiptImageDraft,
): Promise<ReceiptOcrExtraction> {
  const textRecognition = loadTextRecognitionModule();
  const imageCandidates = getReceiptOcrImageCandidates(draft);

  let lastError: unknown = null;
  for (const imageUrl of imageCandidates) {
    try {
      const result = await textRecognition.recognize(imageUrl);
      return {
        provider: 'ml_kit',
        rawText: result.text,
        ocrBlocks: mapMlKitBlocks(result.blocks ?? []),
        imageMeta: getReceiptImageMeta(draft),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(buildReceiptOcrErrorMessage(lastError));
}

export async function extractReceiptTextWithPlaceholder(draft: ReceiptImageDraft): Promise<ReceiptOcrExtraction> {
  const lines = ['RESTOCK RECEIPT', draft.fileName, `${draft.width}x${draft.height}`, `${Math.max(1, Math.round(draft.fileSize / 1024))}kb`].filter(Boolean);

  return {
    provider: 'ml_kit',
    rawText: lines.join('\n'),
    ocrBlocks: lines.map((line) => ({ text: line })),
    imageMeta: getReceiptImageMeta(draft),
  };
}
