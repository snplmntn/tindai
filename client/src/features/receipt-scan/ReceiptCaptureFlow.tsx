import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

import { PrimaryButton } from '@/components/PrimaryButton';
import {
  cleanupReceiptImageDraft,
  formatReceiptFileSize,
  hasBlockingReceiptIssues,
  type ReceiptImageDraft,
  prepareReceiptImageDraft,
} from '@/features/receipt-scan/receiptCapture';
import { colors } from '@/navigation/colors';

type CameraPhotoResult = {
  path: string;
};

type CameraPermissionState = {
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
};

type CameraModule = {
  Camera: any;
  useCameraDevice: (position: 'back' | 'front') => unknown | null;
  useCameraPermission: () => CameraPermissionState;
};

const fallbackCameraPermission: CameraPermissionState = {
  hasPermission: false,
  requestPermission: async () => false,
};

let cachedCameraModule: CameraModule | null = null;

try {
  const module = require('react-native-vision-camera') as CameraModule;
  cachedCameraModule = module;
} catch (error) {
  if (__DEV__) {
    console.warn('[receipt] camera unavailable, using gallery fallback', error);
  }
}

type ReceiptCaptureFlowProps = {
  visible: boolean;
  onClose: () => void;
  onSaveDraft: (draft: ReceiptImageDraft) => Promise<void> | void;
};

export function ReceiptCaptureFlow({ visible, onClose, onSaveDraft }: ReceiptCaptureFlowProps) {
  const cameraRef = useRef<{ takePhoto?: (options?: unknown) => Promise<CameraPhotoResult> } | null>(null);
  const useCameraDeviceHook = cachedCameraModule?.useCameraDevice ?? (() => null);
  const useCameraPermissionHook = cachedCameraModule?.useCameraPermission ?? (() => fallbackCameraPermission);
  const device = useCameraDeviceHook('back');
  const { hasPermission, requestPermission } = useCameraPermissionHook();
  const CameraView = cachedCameraModule?.Camera;
  const isCameraAvailable = Boolean(CameraView);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [draft, setDraft] = useState<ReceiptImageDraft | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || hasPermission) {
      return;
    }

    void requestPermission();
  }, [hasPermission, requestPermission, visible]);

  useEffect(() => {
    if (visible) {
      return;
    }

    setFlashEnabled(false);
    setErrorMessage(null);
    setIsPreparing(false);
  }, [visible]);

  async function prepareDraftFromImage(input: Parameters<typeof prepareReceiptImageDraft>[0]) {
    setIsPreparing(true);
    setErrorMessage(null);

    try {
      if (draft) {
        await cleanupReceiptImageDraft(draft);
      }

      const nextDraft = await prepareReceiptImageDraft(input);
      setDraft(nextDraft);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Hindi naihanda ang larawan ng resibo.');
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleCapturePhoto() {
    if (!isCameraAvailable) {
      setErrorMessage('Hindi maihanda ang camera ngayon. Pumili muna ng larawan mula sa gallery.');
      return;
    }

    try {
      const photoFile = await cameraRef.current?.takePhoto?.({
        flash: flashEnabled ? 'on' : 'off',
        enableShutterSound: true,
      });

      if (!photoFile) {
        setErrorMessage('Hindi nakuha ang larawan ng resibo.');
        return;
      }

      await prepareDraftFromImage({
        uri: `file://${photoFile.path}`,
        source: 'camera',
        fileName: photoFile.path.split('/').pop(),
        mimeType: 'image/jpeg',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Hindi nakuha ang larawan ng resibo.');
    }
  }

  async function handlePickFromGallery() {
    setErrorMessage(null);

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 1,
      });

      if (result.didCancel) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setErrorMessage(result.errorMessage ?? 'Walang napiling larawan ng resibo.');
        return;
      }

      await prepareDraftFromImage({
        uri: asset.uri,
        source: 'gallery',
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        fileName: asset.fileName,
        mimeType: asset.type,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Hindi nakuha ang larawan mula sa gallery.');
    }
  }

  async function handleRetake() {
    await cleanupReceiptImageDraft(draft);
    setDraft(null);
    setErrorMessage(null);
  }

  async function handleClose() {
    if (draft) {
      await cleanupReceiptImageDraft(draft);
      setDraft(null);
    }

    setErrorMessage(null);
    onClose();
  }

  async function handleUseReceipt() {
    if (!draft) {
      return;
    }

    try {
      await onSaveDraft(draft);
      setDraft(null);
      setErrorMessage(null);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Hindi naihanda ang resibo.');
    }
  }

  const hasBlockingIssues = hasBlockingReceiptIssues(draft?.qualityIssues ?? []);

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" visible={visible} onRequestClose={() => void handleClose()}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => void handleClose()} style={styles.headerButton}>
            <Ionicons color={colors.primaryDeep} name="close" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>{draft ? 'Tingnan ang resibo' : 'Kuhanan ang resibo'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {draft ? (
          <ScrollView contentContainerStyle={styles.previewContent}>
            <View style={styles.previewCard}>
              <Image source={{ uri: draft.compressedUri }} style={styles.previewImage} resizeMode="contain" />
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Larawan ng resibo</Text>
              <Text style={styles.summaryMeta}>
                {draft.width} x {draft.height} - {formatReceiptFileSize(draft.fileSize)} -{' '}
                {draft.source === 'camera' ? 'Kinuha sa camera' : 'Galing sa gallery'}
              </Text>
              <Text style={styles.summaryMeta}>Naka-save muna sa phone para sa susunod na hakbang.</Text>
            </View>

            {draft.qualityIssues.length > 0 ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Paki-check muna ang kuha</Text>
                {draft.qualityIssues.map((issue) => (
                  <Text key={`${issue.code}-${issue.message}`} style={styles.warningText}>
                    - {issue.message}
                  </Text>
                ))}
              </View>
            ) : (
              <View style={styles.successCard}>
                <Text style={styles.successTitle}>Mukhang malinaw ang resibo.</Text>
                <Text style={styles.successText}>Pwede mo nang ituloy ang larawang ito.</Text>
              </View>
            )}

            {errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.previewActions}>
              <PrimaryButton
                label="Kuhanan ulit"
                onPress={() => void handleRetake()}
                variant="ghost"
                leadingIcon={<Ionicons color={colors.primaryDeep} name="camera-outline" size={18} />}
              />
              <PrimaryButton
                label="Gamitin ang resibo"
                onPress={handleUseReceipt}
                leadingIcon={<Ionicons color={colors.surface} name="checkmark-outline" size={18} />}
              />
            </View>

            {hasBlockingIssues ? <Text style={styles.blockingHint}>Ayusin muna ang larawan bago ituloy.</Text> : null}
          </ScrollView>
        ) : (
          <View style={styles.captureRoot}>
            {!hasPermission ? (
              <View style={styles.permissionCard}>
                <Ionicons color={colors.primaryDeep} name="camera-outline" size={28} />
                <Text style={styles.permissionTitle}>
                  {isCameraAvailable ? 'Kailangan ng camera access' : 'Hindi maihanda ang camera'}
                </Text>
                <Text style={styles.permissionText}>
                  {isCameraAvailable
                    ? 'Payagan ang camera para makakuha ng litrato ng supplier receipt.'
                    : 'Pwede ka pa ring magpatuloy gamit ang larawan mula sa gallery.'}
                </Text>
                {isCameraAvailable ? <PrimaryButton label="Payagan ang camera" onPress={() => void requestPermission()} /> : null}
                <PrimaryButton
                  label="Pumili sa gallery"
                  onPress={() => void handlePickFromGallery()}
                  variant="ghost"
                  leadingIcon={<Ionicons color={colors.primaryDeep} name="images-outline" size={18} />}
                />
              </View>
            ) : isCameraAvailable && device ? (
              <>
                <View style={styles.cameraCard}>
                  <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    device={device}
                    isActive={visible}
                    photo
                    resizeMode="cover"
                  />
                  <View style={styles.cameraOverlay}>
                    <View style={styles.tipPill}>
                      <Text style={styles.tipText}>Ipatong nang patag at siguraduhing kita ang buong resibo.</Text>
                    </View>
                  </View>
                </View>

                {errorMessage ? (
                  <View style={styles.errorCard}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <View style={styles.captureActions}>
                  <PrimaryButton
                    label="Gallery"
                    onPress={() => void handlePickFromGallery()}
                    variant="ghost"
                    leadingIcon={<Ionicons color={colors.primaryDeep} name="images-outline" size={18} />}
                  />
                  <Pressable
                    onPress={() => setFlashEnabled((current) => !current)}
                    style={[styles.flashButton, flashEnabled ? styles.flashButtonOn : undefined]}
                  >
                    <Ionicons
                      color={flashEnabled ? colors.surface : colors.primaryDeep}
                      name={flashEnabled ? 'flash' : 'flash-off-outline'}
                      size={18}
                    />
                    <Text style={[styles.flashLabel, flashEnabled ? styles.flashLabelOn : undefined]}>
                      {flashEnabled ? 'Flash on' : 'Flash off'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isPreparing}
                    onPress={() => void handleCapturePhoto()}
                    style={[styles.shutterButton, isPreparing ? styles.shutterButtonDisabled : undefined]}
                  >
                    {isPreparing ? (
                      <ActivityIndicator color={colors.surface} size="small" />
                    ) : (
                      <Ionicons color={colors.surface} name="camera" size={24} />
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.permissionCard}>
                <ActivityIndicator color={colors.primaryDeep} size="large" />
                <Text style={styles.permissionTitle}>Inihahanda ang camera</Text>
                <Text style={styles.permissionText}>Sandali lang habang hinahanap ang camera ng phone mo.</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7fbf8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  captureRoot: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 16,
  },
  cameraCard: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#d9e7de',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    padding: 18,
    justifyContent: 'space-between',
  },
  tipPill: {
    alignSelf: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(20, 87, 70, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  captureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flashButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  flashButtonOn: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primaryDeep,
  },
  flashLabel: {
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  flashLabelOn: {
    color: '#ffffff',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: '#dcefe7',
  },
  shutterButtonDisabled: {
    opacity: 0.7,
  },
  permissionCard: {
    marginTop: 32,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  previewContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  previewCard: {
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  previewImage: {
    width: '100%',
    height: 360,
  },
  summaryCard: {
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 6,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  warningCard: {
    borderRadius: 22,
    backgroundColor: '#fff6e6',
    borderWidth: 1,
    borderColor: '#f0d9a9',
    padding: 18,
    gap: 8,
  },
  warningTitle: {
    color: '#6c4d00',
    fontSize: 15,
    fontWeight: '800',
  },
  warningText: {
    color: '#6c4d00',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  successCard: {
    borderRadius: 22,
    backgroundColor: '#eef9f2',
    borderWidth: 1,
    borderColor: '#cfe6d7',
    padding: 18,
    gap: 6,
  },
  successTitle: {
    color: colors.primaryDeep,
    fontSize: 15,
    fontWeight: '800',
  },
  successText: {
    color: colors.primaryDeep,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  errorCard: {
    borderRadius: 18,
    backgroundColor: '#ffebe8',
    borderWidth: 1,
    borderColor: '#f4c7c0',
    padding: 14,
  },
  errorText: {
    color: '#9b1c12',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  previewActions: {
    gap: 12,
  },
  blockingHint: {
    color: '#8b5f00',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
