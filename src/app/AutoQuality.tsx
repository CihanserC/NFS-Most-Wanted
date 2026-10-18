import { useEffect } from 'react';
import { initialAutoQuality, stepAutoQuality } from '../core/graphics/autoQuality';
import { useAppStore } from '../core/store/appStore';
import { useDriveStore } from '../core/store/driveStore';
import { useGraphicsStore } from '../core/store/graphicsStore';
import { usePhotoStore } from '../core/store/photoStore';

/**
 * Uyarlanabilir kalite: kare hızı sürekli hedefin altındaysa grafik kalitesini bir kademe düşürür
 * (yukarı çıkmaz). Sekme gizliyken, duraklatılmışken ve fotoğraf çekilirken ölçümler yok sayılır.
 */
export function AutoQuality() {
  useEffect(() => {
    let state = initialAutoQuality();
    let last = performance.now();
    return useGraphicsStore.subscribe((graphics, previous) => {
      if (graphics.fps === previous.fps && graphics.drawCalls === previous.drawCalls) return;
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!graphics.autoQuality) {
        state = initialAutoQuality();
        return;
      }
      const paused = useAppStore.getState().mode === 'drive' && useDriveStore.getState().paused;
      const result = stepAutoQuality(state, {
        fps: graphics.fps,
        dt,
        quality: graphics.quality,
        active: document.visibilityState === 'visible' && !paused && !usePhotoStore.getState().busy,
      });
      state = result.state;
      if (result.lowerTo) useGraphicsStore.getState().lowerQualityAuto(result.lowerTo);
    });
  }, []);
  return null;
}
