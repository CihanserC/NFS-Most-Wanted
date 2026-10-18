import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/global.css';
import { useAppStore } from './core/store/appStore';
import { useGarageStore } from './core/store/garageStore';
import { useBuildStore } from './core/store/stores';
import { initPersistence } from './core/storage/persistence';
import { captureCanvas } from './garage/photo/capture';

if (import.meta.env.DEV)
  Object.assign(window, {
    __muscleGarage: { useBuildStore, useAppStore, useGarageStore },
    // Geliştirme: indirme yapmadan kare yakalamayı denemek için
    __muscleGaragePhoto: { captureCanvas },
  });

const root = document.getElementById('root');
if (!root) throw new Error('#root elementi bulunamadı');

// Depo açılır, son oturum geri yüklenir; arayüz beklemeden açılır (yükleme bitince build güncellenir).
void initPersistence().catch((error: unknown) => {
  console.warn('[Garage] Kalıcılık başlatılamadı:', error);
});

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
