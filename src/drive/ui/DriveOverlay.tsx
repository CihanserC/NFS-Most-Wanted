import { useEffect, useMemo, useState } from 'react';
import { formatLapTime } from '../../core/drive/lap';
import { getDefaultTrack } from '../../core/drive/track';
import { useAppStore } from '../../core/store/appStore';
import { DRIVE_CAMERAS, useDriveStore } from '../../core/store/driveStore';
import { useGraphicsStore } from '../../core/store/graphicsStore';
import { t } from '../../i18n';
import './drive.css';

const RPM_SEGMENTS = 28;
const MINIMAP = { size: 150, pad: 10, step: 6 };

function Minimap() {
  const track = getDefaultTrack();
  const hud = useDriveStore((s) => s.hud);
  const { path, project } = useMemo(() => {
    const pts = track.samples.filter((_, i) => i % MINIMAP.step === 0);
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const minX = Math.min(...xs);
    const minZ = Math.min(...zs);
    const span = Math.max(Math.max(...xs) - minX, Math.max(...zs) - minZ);
    const scale = (MINIMAP.size - MINIMAP.pad * 2) / span;
    const proj = (x: number, z: number): [number, number] => [
      MINIMAP.pad + (x - minX) * scale,
      MINIMAP.pad + (z - minZ) * scale,
    ];
    const d =
      pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${proj(p.x, p.z).map((v) => v.toFixed(1))}`)
        .join(' ') + ' Z';
    return { path: d, project: proj };
  }, [track]);
  const [cx, cy] = project(hud.x, hud.z);
  return (
    <svg className="dv-minimap" width={MINIMAP.size} height={MINIMAP.size} aria-hidden>
      <path d={path} className="dv-minimap-track" />
      <g transform={`translate(${cx} ${cy}) rotate(${(-hud.heading * 180) / Math.PI + 180})`}>
        <path d="M0 -6 L4 5 L0 3 L-4 5 Z" className="dv-minimap-car" />
      </g>
    </svg>
  );
}

function RpmBar() {
  const rpm = useDriveStore((s) => s.hud.rpm);
  const redline = useDriveStore((s) => s.hud.redlineRpm);
  const lit = Math.round((Math.min(rpm, redline) / redline) * RPM_SEGMENTS);
  return (
    <div className="dv-rpm" aria-label={`${Math.round(rpm)} rpm`}>
      {Array.from({ length: RPM_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`${i < lit ? 'is-lit' : ''}${i >= RPM_SEGMENTS * 0.82 ? ' is-red' : ''}`}
        />
      ))}
    </div>
  );
}

function Hud() {
  const hud = useDriveStore((s) => s.hud);
  const cameraIndex = useDriveStore((s) => s.cameraIndex);
  const fps = useGraphicsStore((s) => s.fps);
  const showFps = useGraphicsStore((s) => s.showFps);
  const gear = hud.reverse ? 'R' : String(hud.gear);
  const lap = hud.lap;
  return (
    <>
      <div className="dv-lap">
        <div className="dv-lap-row">
          <span>{t('drive.lap')}</span>
          <strong>{lap.running ? lap.laps + 1 : '–'}</strong>
        </div>
        <div className="dv-lap-time">{formatLapTime(hud.currentLap)}</div>
        <div className="dv-lap-row">
          <span>{t('drive.last')}</span>
          <strong>{formatLapTime(lap.lastLap)}</strong>
        </div>
        <div className="dv-lap-row is-best">
          <span>{t('drive.best')}</span>
          <strong>{formatLapTime(lap.bestLap)}</strong>
        </div>
        {lap.invalid && <div className="dv-warn">{t('drive.lapInvalid')}</div>}
      </div>
      <Minimap />
      <div className="dv-speedo">
        <RpmBar />
        <div className="dv-speed-row">
          <div className="dv-gear">{gear}</div>
          <div className="dv-speed">{Math.round(hud.speedKmh)}</div>
          <div className="dv-unit">{t('drive.kmh')}</div>
        </div>
      </div>
      {!lap.running && <div className="dv-banner">{t('drive.crossLine')}</div>}
      {hud.offTrack && <div className="dv-banner is-warn">{t('drive.offTrack')}</div>}
      <div className="dv-keys">
        <span>W/S {t('drive.keys.throttle')}</span>
        <span>A/D {t('drive.keys.steer')}</span>
        <span>{t('drive.keys.space')}</span>
        <span>
          C {t('drive.keys.camera')}: {t(`driveCamera.${DRIVE_CAMERAS[cameraIndex]}`)}
        </span>
        <span>R {t('drive.keys.reset')}</span>
        <span>Esc {t('drive.keys.pause')}</span>
        {showFps && <span className="dv-fps">{fps} FPS</span>}
      </div>
    </>
  );
}

type PauseItem = { id: string; label: string };

function PauseMenu() {
  const timeOfDay = useDriveStore((s) => s.timeOfDay);
  const muted = useDriveStore((s) => s.muted);
  const [index, setIndex] = useState(0);

  const leave = () => {
    useDriveStore.getState().setPaused(false);
    const app = useAppStore.getState();
    app.selectCategory(null);
    app.setMode('garage');
  };
  const items: PauseItem[] = [
    { id: 'resume', label: t('drive.pause.resume') },
    { id: 'restart', label: t('drive.pause.restart') },
    { id: 'time', label: `${t('drive.pause.time')}: ${t(`timeOfDay.${timeOfDay}`)}` },
    { id: 'sound', label: `${t('drive.pause.sound')}: ${muted ? t('ui.off') : t('ui.on')}` },
    { id: 'garage', label: t('drive.pause.garage') },
  ];

  const activate = (id: string) => {
    const s = useDriveStore.getState();
    if (id === 'resume') s.setPaused(false);
    else if (id === 'restart') {
      s.restart();
      s.setPaused(false);
    } else if (id === 'time') s.toggleTimeOfDay();
    else if (id === 'sound') s.toggleMuted();
    else if (id === 'garage') leave();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') setIndex((i) => (i + 1) % items.length);
      else if (e.key === 'ArrowUp') setIndex((i) => (i - 1 + items.length) % items.length);
      else if (e.key === 'Enter') activate(items[index]?.id ?? 'resume');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="dv-pause">
      <div className="dv-pause-panel">
        <div className="dv-pause-title">{t('drive.pause.title')}</div>
        <ul>
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                className={i === index ? 'is-active' : ''}
                onMouseEnter={() => setIndex(i)}
                onClick={() => activate(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Sürüş kısayolları: Esc duraklat, C kamera, R geri koy, N gün/gece, M ses. */
function useDriveKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const s = useDriveStore.getState();
      if (e.code === 'Escape') s.setPaused(!s.paused);
      else if (s.paused) return;
      else if (e.code === 'KeyC') s.cycleCamera();
      else if (e.code === 'KeyR') s.respawn();
      else if (e.code === 'KeyN') s.toggleTimeOfDay();
      else if (e.code === 'KeyM') s.toggleMuted();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Test sürüşü arayüzü: HUD, minimap, yükleme ve duraklatma menüsü. */
export function DriveOverlay() {
  useDriveKeys();
  const ready = useDriveStore((s) => s.ready);
  const paused = useDriveStore((s) => s.paused);
  return (
    <div className="dv-root">
      {ready ? <Hud /> : <div className="dv-loading">{t('drive.loading')}</div>}
      {paused && <PauseMenu />}
    </div>
  );
}
