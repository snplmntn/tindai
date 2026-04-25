import { Image } from 'react-native';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import {
  assessReceiptImageQuality,
  formatReceiptFileSize,
  hasBlockingReceiptIssues,
  type ReceiptQualityIssue,
} from './receiptQuality';

export { assessReceiptImageQuality, formatReceiptFileSize, hasBlockingReceiptIssues };
export type { ReceiptQualityIssue } from './receiptQuality';

export type ReceiptCaptureSource = 'camera' | 'gallery';

export type ReceiptImageInput = {
  uri: string;
  source: ReceiptCaptureSource;
  width?: number;
  height?: number;
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
};

export type ReceiptImageDraft = {
  id: string;
  source: ReceiptCaptureSource;
  originalUri: string;
  compressedUri: string;
  tempPath: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  createdAt: string;
  qualityIssues: ReceiptQualityIssue[];
};

const RECEIPT_TMP_DIR = `${RNFS.CachesDirectoryPath}/receipt-scans`;
const RECEIPT_MAX_DIMENSION = 1600;
const RECEIPT_JPEG_QUALITY = 82;

function buildReceiptDraftId() {
  return `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureFileUri(pathOrUri: string) {
  return pathOrUri.startsWith('file://') ? pathOrUri : `file://${pathOrUri}`;
}

export function getReceiptTempPath(extension = 'jpg') {
  return `${RECEIPT_TMP_DIR}/receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}

export async function ensureReceiptTempDirectory() {
  await RNFS.mkdir(RECEIPT_TMP_DIR);
  return RECEIPT_TMP_DIR;
}

async function getImageDimensions(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

export async function prepareReceiptImageDraft(input: ReceiptImageInput): Promise<ReceiptImageDraft> {
  await ensureReceiptTempDirectory();

  const outputPath = getReceiptTempPath('jpg');
  const compressed = await ImageResizer.createResizedImage(
    input.uri,
    RECEIPT_MAX_DIMENSION,
    RECEIPT_MAX_DIMENSION,
    'JPEG',
    RECEIPT_JPEG_QUALITY,
    0,
    outputPath,
    false,
    {
      mode: 'contain',
      onlyScaleDown: true,
    },
  );

  const tempPath = compressed.path;
  const tempUri = ensureFileUri(compressed.uri || compressed.path);
  const fileExists = await RNFS.exists(tempPath);

  if (!fileExists) {
    throw new Error('Hindi makita ang naihandang image file ng resibo.');
  }

  const dimensions =
    compressed.width > 0 && compressed.height > 0
      ? { width: compressed.width, height: compressed.height }
      : await getImageDimensions(tempUri);

  const fileSize = compressed.size > 0 ? compressed.size : input.fileSize ?? 0;
  const qualityIssues = assessReceiptImageQuality({
    width: dimensions.width,
    height: dimensions.height,
    fileSize,
  });

  return {
    id: buildReceiptDraftId(),
    source: input.source,
    originalUri: input.uri,
    compressedUri: tempUri,
    tempPath,
    fileName: compressed.name || input.fileName || tempPath.split('/').pop() || `${buildReceiptDraftId()}.jpg`,
    mimeType: input.mimeType || 'image/jpeg',
    width: dimensions.width,
    height: dimensions.height,
    fileSize,
    createdAt: new Date().toISOString(),
    qualityIssues,
  };
}

export async function cleanupReceiptImageDraft(draft: ReceiptImageDraft | null | undefined) {
  if (!draft) {
    return;
  }

  const exists = await RNFS.exists(draft.tempPath);
  if (exists) {
    await RNFS.unlink(draft.tempPath);
  }
}
