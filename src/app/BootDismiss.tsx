import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

/** Splash'in kaldırılması için gereken çizilmiş kare sayısı (ilk karelerde shader derlemesi sürer). */
const FRAMES_BEFORE_DISMISS = 4;
const FADE_MS = 500;

/** Canvas içinde çalışır: birkaç kare çizildikten sonra index.html'deki yükleme ekranını kapatır. */
export function BootDismiss() {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > FRAMES_BEFORE_DISMISS) return;
    frames.current++;
    if (frames.current <= FRAMES_BEFORE_DISMISS) return;
    const boot = document.getElementById('boot');
    if (!boot) return;
    // İlk çizilen kareye kadar geçen süre (ölçüm ve hata ayıklama için işaretlenir)
    document.documentElement.dataset.bootMs = String(Math.round(performance.now()));
    boot.classList.add('is-done');
    setTimeout(() => boot.remove(), FADE_MS);
  });
  return null;
}
