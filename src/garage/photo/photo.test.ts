import { beforeEach, describe, expect, it } from 'vitest';
import {
  PHOTO_DEFAULTS,
  PHOTO_LIMITS,
  PHOTO_SCALES,
  usePhotoStore,
} from '../../core/store/photoStore';
import { t } from '../../i18n';
import {
  captureCanvas,
  clampPixelRatio,
  MAX_PIXELS,
  MAX_SIDE_PX,
  photoFileName,
  photoOutputSize,
  registerCapture,
} from './capture';

describe('fotoğraf çıktı boyutu', () => {
  it('makul boyutta istenen oran aynen uygulanır', () => {
    expect(clampPixelRatio(2, 1280, 720)).toBe(2);
    expect(photoOutputSize(3, 1280, 720)).toMatchObject({ width: 3840, height: 2160, ratio: 3 });
  });

  it('büyük ekranlarda kenar ve toplam piksel sınırına kısaltılır', () => {
    const wide = photoOutputSize(4, 3840, 2160);
    expect(wide.ratio).toBeLessThan(4);
    expect(Math.max(wide.width, wide.height)).toBeLessThanOrEqual(MAX_SIDE_PX);
    expect(wide.width * wide.height).toBeLessThanOrEqual(MAX_PIXELS + 1e5);
    // 1×'de ekran boyutu korunur
    expect(photoOutputSize(1, 3840, 2160)).toMatchObject({ width: 3840, height: 2160 });
  });

  it('çok küçük/aşırı değerler güvenli aralıkta kalır', () => {
    expect(clampPixelRatio(0.01, 1280, 720)).toBeGreaterThanOrEqual(0.25);
    expect(clampPixelRatio(100, 1280, 720)).toBeLessThanOrEqual(MAX_SIDE_PX / 1280);
  });
});

describe('fotoğraf dosya adı', () => {
  it('Türkçe karakterler ve zaman damgası', () => {
    const d = new Date(2026, 9, 18, 15, 30, 12);
    expect(photoFileName('Şahin Çıkışı', d)).toBe('sahin-cikisi-20261018-153012.png');
    expect(photoFileName('???', d)).toBe('muscle-garage-20261018-153012.png');
  });
});

describe('yakalama köprüsü', () => {
  it('kayıtlı işleyici yoksa anlaşılır hata verir, kayıttan sonra isteği iletir', async () => {
    await expect(captureCanvas()).rejects.toThrow();
    const fake = { width: 10, height: 5 } as unknown as HTMLCanvasElement;
    let received: unknown = null;
    const unregister = registerCapture((options) => {
      received = options;
      return Promise.resolve(fake);
    });
    expect(await captureCanvas({ pixelRatio: 3 })).toBe(fake);
    expect(received).toEqual({ pixelRatio: 3 });
    unregister();
    await expect(captureCanvas()).rejects.toThrow();
  });
});

describe('fotoğraf ayarları (store)', () => {
  beforeEach(() => usePhotoStore.getState().reset());

  it('varsayılanlar ve sınırlar', () => {
    const s = usePhotoStore.getState();
    expect(s.fov).toBe(PHOTO_DEFAULTS.fov);
    s.set({ fov: 500, bokeh: -3, focusRange: 99, exposure: 9 });
    const after = usePhotoStore.getState();
    expect(after.fov).toBe(PHOTO_LIMITS.fov.max);
    expect(after.bokeh).toBe(PHOTO_LIMITS.bokeh.min);
    expect(after.focusRange).toBe(PHOTO_LIMITS.focusRange.max);
    expect(after.exposure).toBe(PHOTO_LIMITS.exposure.max);
  });

  it('geçersiz çözünürlük yok sayılır, geçerli olan uygulanır', () => {
    usePhotoStore.getState().set({ scale: 3 });
    expect(usePhotoStore.getState().scale).toBe(3);
    usePhotoStore.getState().set({ scale: 7 as never });
    expect(usePhotoStore.getState().scale).toBe(3);
    expect(PHOTO_SCALES).toContain(usePhotoStore.getState().scale);
  });

  it('arayüz gizleme ve sıfırlama', () => {
    usePhotoStore.getState().setHideUi(true);
    usePhotoStore.getState().set({ dofEnabled: true, exposure: 1 });
    usePhotoStore.getState().reset();
    expect(usePhotoStore.getState()).toMatchObject({
      hideUi: false,
      dofEnabled: false,
      exposure: 0,
    });
  });
});

describe('çeviriler', () => {
  it('garaj ve fotoğraf anahtarlarının hepsi tanımlı', () => {
    const keys = [
      'garage.name',
      'garage.save',
      'garage.saved',
      'garage.loaded',
      'garage.imported',
      'garage.deleted',
      'garage.copied',
      'garage.newProject.notice',
      'garage.error.slot_limit',
      'garage.error.not_found',
      'garage.error.corrupt',
      'garage.error.invalid_json',
      'garage.error.wrong_car',
      'garage.error.storage',
      'garage.error.clipboard',
      'photo.take',
      'photo.saved',
      'photo.error',
      'photo.output',
      'photo.showUi',
    ];
    for (const key of keys) expect(t(key)).not.toBe(key);
  });
});
