import { create } from 'zustand';
import type { LapState } from '../drive/lap';
import { initialLap } from '../drive/lap';

export const DRIVE_CAMERAS = ['chase', 'chase_low', 'hood', 'bumper'] as const;
export type DriveCamera = (typeof DRIVE_CAMERAS)[number];

export const TIMES_OF_DAY = ['sunset', 'night'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** HUD'a basılan anlık değerler (düşük sıklıkla güncellenir). */
export type DriveHud = {
  speedKmh: number;
  rpm: number;
  redlineRpm: number;
  gear: number;
  reverse: boolean;
  lap: LapState;
  /** Mevcut turun süresi (sn); süre akmıyorsa null */
  currentLap: number | null;
  /** Minimap için araç dünya konumu ve yönü */
  x: number;
  z: number;
  heading: number;
  offTrack: boolean;
  /** Nitro tüpü 0..1; null = nitro takılı değil */
  nitro: number | null;
  nitroActive: boolean;
};

/** Duraklatma menüsünün gösterdiği sayfa */
export type PauseView = 'main' | 'controls';

export type DriveState = {
  /** Fizik dünyası kuruldu mu (yükleme göstergesi) */
  ready: boolean;
  paused: boolean;
  pauseView: PauseView;
  cameraIndex: number;
  timeOfDay: TimeOfDay;
  hud: DriveHud;
  /** Her artışta sürücü aracı pist başlangıcına yeniden yerleştirir */
  restartTick: number;
  /** Her artışta aracı bulunduğu pist noktasına geri koyar */
  respawnTick: number;
  setHud: (hud: DriveHud) => void;
  setReady: (ready: boolean) => void;
  setPaused: (paused: boolean) => void;
  setPauseView: (view: PauseView) => void;
  /** Esc: kontroller sayfasındaysa menüye döner, değilse duraklatmayı açar/kapatır */
  escape: () => void;
  cycleCamera: () => void;
  toggleTimeOfDay: () => void;
  restart: () => void;
  respawn: () => void;
  /** Atölyeden pite girerken sıfırlar (en iyi tur oturum boyunca korunur) */
  begin: () => void;
};

export const initialHud = (): DriveHud => ({
  speedKmh: 0,
  rpm: 0,
  redlineRpm: 6000,
  gear: 1,
  reverse: false,
  lap: initialLap(),
  currentLap: null,
  x: 0,
  z: 0,
  heading: 0,
  offTrack: false,
  nitro: null,
  nitroActive: false,
});

export const useDriveStore = create<DriveState>()((set) => ({
  ready: false,
  paused: false,
  pauseView: 'main',
  cameraIndex: 0,
  timeOfDay: 'sunset',
  hud: initialHud(),
  restartTick: 0,
  respawnTick: 0,
  setHud: (hud) => set({ hud }),
  setReady: (ready) => set({ ready }),
  setPaused: (paused) => set({ paused, pauseView: 'main' }),
  setPauseView: (pauseView) => set({ pauseView }),
  escape: () =>
    set((s) =>
      s.paused && s.pauseView !== 'main'
        ? { pauseView: 'main' }
        : { paused: !s.paused, pauseView: 'main' },
    ),
  cycleCamera: () => set((s) => ({ cameraIndex: (s.cameraIndex + 1) % DRIVE_CAMERAS.length })),
  toggleTimeOfDay: () => set((s) => ({ timeOfDay: s.timeOfDay === 'sunset' ? 'night' : 'sunset' })),
  restart: () => set((s) => ({ restartTick: s.restartTick + 1, hud: initialHud() })),
  respawn: () => set((s) => ({ respawnTick: s.respawnTick + 1 })),
  begin: () => set({ paused: false, pauseView: 'main', ready: false, hud: initialHud() }),
}));
