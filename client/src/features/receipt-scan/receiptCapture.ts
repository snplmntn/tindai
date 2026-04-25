import { Image } from 'react-native';
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

const RECEIPT_MAX_DIMENSION = 1600;
const RECEIPT_JPEG_QUALITY = 82;
const RECEIPT_TMP_SUBDIR = 'receipt-scans';

function getExpoFileSystemLegacy() {
  try {
    // `expo-file-system/legacy` ships with Expo SDK and provides stable async file helpers.
    return require('expo-file-system/legacy') as {
      cacheDirectory?: string;
      getInfoAsync: (path: string) => Promise<{ exists: boolean }>;
      makeDirectoryAsync: (path: string, options?: { intermediates?: boolean }) => Promise<void>;
      deleteAsync: (path: string, options?: { idempotent?: boolean }) => Promise<void>;
    };
  } catch {
    return null;
  }
}

function getReceiptTempDirectoryPath() {
  const fileSystem = getExpoFileSystemLegacy();
  if (fileSystem?.cacheDirectory) {
    return `${fileSystem.cacheDirectory}${RECEIPT_TMP_SUBDIR}`;
  }

  return null;
}

function buildReceiptDraftId() {
  return `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureFileUri(pathOrUri: string) {
  const value = pathOrUri.trim();
  if (!value) {
    return value;
  }

  if (value.startsWith('content://') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('file://')) {
    return value;
  }

  if (value.startsWith('file:/')) {
    const normalizedPath = value.replace(/^file:\/*/i, '');
    return `file:///${normalizedPath}`;
  }

  if (value.startsWith('/')) {
    return `file://${value}`;
  }

  return `file:///${value}`;
}

export function getReceiptTempPath(extension = 'jpg') {
  const tempDir = getReceiptTempDirectoryPath();
  const fileName = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  if (!tempDir) {
    return fileName;
  }

  return `${tempDir}/${fileName}`;
}

export async function ensureReceiptTempDirectory() {
  const fileSystem = getExpoFileSystemLegacy();
  const tempDir = getReceiptTempDirectoryPath();
  if (!fileSystem || !tempDir) {
    return null;
  }

  await fileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
  return tempDir;
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
  const receiptTempDir = await ensureReceiptTempDirectory();

  let compressed: Awaited<ReturnType<typeof ImageResizer.createResizedImage>>;
  try {
    // `react-native-image-resizer` expects outputPath to be a directory, not a file path.
    compressed = await ImageResizer.createResizedImage(
      input.uri,
      RECEIPT_MAX_DIMENSION,
      RECEIPT_MAX_DIMENSION,
      'JPEG',
      RECEIPT_JPEG_QUALITY,
      0,
      receiptTempDir ?? undefined,
      false,
      {
        mode: 'contain',
        onlyScaleDown: true,
      },
    );
  } catch (error) {
    const message =
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : 'Hindi naihanda ang larawan ng resibo.';
    throw new Error(`Hindi naihanda ang larawan ng resibo: ${message}`);
  }

  const tempPath = compressed.path;
  const tempUri = ensureFileUri(compressed.uri || compressed.path);
  const fileSystem = getExpoFileSystemLegacy();
  if (fileSystem) {
    const fileInfo = await fileSystem.getInfoAsync(tempPath);
    if (!fileInfo.exists) {
      throw new Error('Hindi makita ang naihandang image file ng resibo.');
    }
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

  const fileSystem = getExpoFileSystemLegacy();
  if (!fileSystem) {
    return;
  }

  const exists = await fileSystem.getInfoAsync(draft.tempPath);
  if (exists.exists) {
    await fileSystem.deleteAsync(draft.tempPath, { idempotent: true });
  }
}
