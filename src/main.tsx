import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/global.css';
import { useAppStore } from './core/store/appStore';
import { useGarageStore } from './core/store/garageStore';
import { useGraphicsStore } from './core/store/graphicsStore';
import { useBuildStore } from './core/store/stores';
import { initPersistence, readLastCar } from './core/storage/persistence';
import { previewCar } from './core/store/carSession';
import { DEFAULT_CAR_ID } from './data/cars';
import { captureCanvas } from './garage/photo/capture';

if (import.meta.env.DEV)
  Object.assign(window, {
    __muscleGarage: { useBuildStore, useAppStore, useGarageStore, useGraphicsStore },
    // Geliştirme: indirme yapmadan kare yakalamayı denemek için
    __muscleGaragePhoto: { captureCanvas },
  });

const root = document.getElementById('root');
if (!root) throw new Error('#root elementi bulunamadı');

// Depo açılır, son oturum geri yüklenir; arayüz beklemeden açılır (yükleme bitince build güncellenir).
// Kalıcılık açılınca son seçilen araç kayıtlı kurulumuyla vitrine konur (seçim ekranı).
void initPersistence()
  .then(async () => {
    const last = await readLastCar(useGarageStore.getState().storage);
    await previewCar(last ?? DEFAULT_CAR_ID, true);
  })
  .catch((error: unknown) => {
    console.warn('[Garage] Kalıcılık başlatılamadı:', error);
  });

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
