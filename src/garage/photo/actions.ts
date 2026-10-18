import { usePhotoStore } from '../../core/store/photoStore';
import { useBuildStore } from '../../core/store/stores';
import {
  canvasToBlob,
  captureCanvas,
  downloadBlob,
  photoFileName,
  thumbnailDataUrl,
} from './capture';

/** Garaj slotu için küçük önizleme (mevcut çözünürlükte kare alıp küçültür). */
export async function captureThumbnail(): Promise<string | null> {
  try {
    return thumbnailDataUrl(await captureCanvas());
  } catch {
    return null;
  }
}

/** Seçili çözünürlükte PNG alıp indirir. Hata çeviri anahtarıyla bildirilir. */
export async function takePhoto(): Promise<void> {
  const photo = usePhotoStore.getState();
  if (photo.busy) return;
  photo.setBusy(true);
  photo.setNotice(null);
  try {
    const canvas = await captureCanvas({ pixelRatio: photo.scale });
    const blob = await canvasToBlob(canvas, 'image/png');
    downloadBlob(blob, photoFileName(useBuildStore.getState().build.name));
    usePhotoStore.getState().setNotice('photo.saved');
  } catch {
    usePhotoStore.getState().setNotice('photo.error');
  } finally {
    usePhotoStore.getState().setBusy(false);
  }
}
