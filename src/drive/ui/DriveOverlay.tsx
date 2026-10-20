import { useEffect, useMemo, useState } from 'react';
import {
  arcPath,
  gaugeAngle,
  gaugeScale,
  gearLabel,
  polar,
  SHIFT_LIGHT_FRACTION,
  GAUGE_START_DEG,
  GAUGE_SWEEP_DEG,
} from '../../core/drive/gauge';
import { formatLapTime } from '../../core/drive/lap';
import { getDefaultTrack } from '../../core/drive/track';
import { useAppStore } from '../../core/store/appStore';
import { useAudioStore } from '../../core/store/audioStore';
import { playUiSound } from '../../audio/uiSound';
import { volumeLabel } from '../../audio/volumeLabel';
import { DRIVE_CAMERAS, useDriveStore } from '../../core/store/driveStore';
import { useGraphicsStore } from '../../core/store/graphicsStore';
import { t } from '../../i18n';
import './drive.css';

const MINIMAP = { size: 150, pad: 10, step: 6 };
/** Devir saati SVG ölçüleri */
const DIAL = { size: 236, r: 100, tickOuter: 98, labelR: 76, needleIn: 60, needleOut: 96 };

function Minimap() {
  const track = getDefaultTrack();
  const hud = useDriveStore((s) => s.hud);
  const { path, project, start } = useMemo(() => {
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
    const s = track.samples[track.startIndex];
    return { path: d, project: proj, start: s ? proj(s.x, s.z) : null };
  }, [track]);
  const [cx, cy] = project(hud.x, hud.z);
  return (
    <svg className="dv-minimap" width={MINIMAP.size} height={MINIMAP.size} aria-hidden>
      <path d={path} className="dv-minimap-track" />
      {start && <circle cx={start[0]} cy={start[1]} r={3} className="dv-minimap-start" />}
      <g transform={`translate(${cx} ${cy}) rotate(${(-hud.heading * 180) / Math.PI + 180})`}>
        <path d="M0 -6 L4 5 L0 3 L-4 5 Z" className="dv-minimap-car" />
      </g>
    </svg>
  );
}

/** Statik kadran katmanı (çentikler, rakamlar, kırmızı bölge); yalnızca kırmızı çizgi değişince çizilir. */
function DialFace({ max, redline }: { max: number; redline: number }) {
  const c = DIAL.size / 2;
  const scale = gaugeScale(redline);
  const end = GAUGE_START_DEG + GAUGE_SWEEP_DEG;
  return (
    <>
      <circle cx={c} cy={c} r={DIAL.r + 12} className="dv-dial-bg" />
      <path d={arcPath(c, c, DIAL.r, GAUGE_START_DEG, end)} className="dv-dial-track" />
      <path
        d={arcPath(c, c, DIAL.r - 3, gaugeAngle(redline, max), end)}
        className="dv-dial-redzone"
      />
      {scale.minors.map((r) => {
        const a = gaugeAngle(r, max);
        const [x0, y0] = polar(c, c, DIAL.tickOuter - 6, a);
        const [x1, y1] = polar(c, c, DIAL.tickOuter, a);
        return <line key={r} x1={x0} y1={y0} x2={x1} y2={y1} className="dv-dial-minor" />;
      })}
      {scale.majors.map((r) => {
        const a = gaugeAngle(r, max);
        const [x0, y0] = polar(c, c, DIAL.tickOuter - 12, a);
        const [x1, y1] = polar(c, c, DIAL.tickOuter, a);
        const [lx, ly] = polar(c, c, DIAL.labelR, a);
        const red = r >= redline;
        return (
          <g key={r}>
            <line
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              className={`dv-dial-major${red ? ' is-red' : ''}`}
            />
            <text x={lx} y={ly} className={`dv-dial-num${red ? ' is-red' : ''}`}>
              {r / 1000}
            </text>
          </g>
        );
      })}
      <text x={c} y={c + 62} className="dv-dial-caption">
        ×1000 rpm
      </text>
    </>
  );
}

/** Analog devir saati + ortada dijital hız ve vites; kırmızı çizgiye yaklaşınca vites uyarısı. */
function Speedometer() {
  const speed = useDriveStore((s) => s.hud.speedKmh);
  const rpm = useDriveStore((s) => s.hud.rpm);
  const redline = useDriveStore((s) => s.hud.redlineRpm);
  const gear = useDriveStore((s) => s.hud.gear);
  const reverse = useDriveStore((s) => s.hud.reverse);
  const { max } = useMemo(() => gaugeScale(redline), [redline]);
  const c = DIAL.size / 2;
  const angle = gaugeAngle(rpm, max);
  const shift = !reverse && rpm >= redline * SHIFT_LIGHT_FRACTION;
  const face = useMemo(() => <DialFace max={max} redline={redline} />, [max, redline]);
  const [n0x, n0y] = polar(c, c, DIAL.needleIn, GAUGE_START_DEG);
  const [n1x, n1y] = polar(c, c, DIAL.needleOut, GAUGE_START_DEG);
  return (
    <div className="dv-speedo" aria-label={`${Math.round(speed)} ${t('drive.kmh')}`}>
      <svg width={DIAL.size} height={DIAL.size} className="dv-dial" aria-hidden>
        {face}
        <path
          d={arcPath(c, c, DIAL.r, GAUGE_START_DEG, Math.max(GAUGE_START_DEG + 0.01, angle))}
          className={`dv-dial-fill${rpm >= redline ? ' is-red' : ''}`}
        />
        {/* İbre başlangıç açısında çizilip döndürülür: CSS geçişiyle yumuşak hareket */}
        <g
          className="dv-dial-needle"
          style={{
            transform: `rotate(${angle - GAUGE_START_DEG}deg)`,
            transformOrigin: `${c}px ${c}px`,
          }}
        >
          <line x1={n0x} y1={n0y} x2={n1x} y2={n1y} />
        </g>
      </svg>
      <div className="dv-speed-block">
        <div className={`dv-gear${shift ? ' is-shift' : ''}`}>
          {gearLabel(gear, reverse, speed)}
        </div>
        <div className="dv-speed">{Math.round(speed)}</div>
        <div className="dv-unit">{t('drive.kmh')}</div>
      </div>
    </div>
  );
}

/** Nitro tüpü: devir saatinin solunda dikey çubuk; kullanılırken mavi parlar. */
function NitroGauge() {
  const level = useDriveStore((s) => s.hud.nitro);
  const active = useDriveStore((s) => s.hud.nitroActive);
  if (level === null) return null;
  return (
    <div
      className={`dv-nitro${active ? ' is-active' : ''}${level <= 0.02 ? ' is-empty' : ''}`}
      aria-label={`${t('drive.nitro')} ${Math.round(level * 100)}%`}
    >
      <div className="dv-nitro-tube">
        <span style={{ height: `${level * 100}%` }} />
      </div>
      <div className="dv-nitro-label">N₂O</div>
    </div>
  );
}

function Hud() {
  const hud = useDriveStore((s) => s.hud);
  const fps = useGraphicsStore((s) => s.fps);
  const showFps = useGraphicsStore((s) => s.showFps);
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
      <div className="dv-topright">
        <Minimap />
        {showFps && <div className="dv-fps">{fps} FPS</div>}
      </div>
      <Speedometer />
      <NitroGauge />
      {!lap.running && <div className="dv-banner">{t('drive.crossLine')}</div>}
      {hud.offTrack && <div className="dv-banner is-warn">{t('drive.offTrack')}</div>}
      <div className="dv-menu-hint">
        <kbd>Esc</kbd> {t('drive.menuHint')}
      </div>
    </>
  );
}

type ControlRow = { keys: string[]; pad: string; action: string };

/** Kontroller sayfası: klavye ve gamepad eşlemesi (input.ts, gamepad.ts ve useDriveKeys ile aynı). */
function ControlsPanel() {
  const cameraIndex = useDriveStore((s) => s.cameraIndex);
  const rows: ControlRow[] = [
    { keys: ['W', '↑'], pad: 'RT', action: t('drive.controls.throttle') },
    { keys: ['S', '↓'], pad: 'LT', action: t('drive.controls.brake') },
    {
      keys: ['A', 'D', '← →'],
      pad: t('drive.controls.padStick'),
      action: t('drive.controls.steer'),
    },
    { keys: [t('drive.controls.space')], pad: 'A / X', action: t('drive.controls.handbrake') },
    { keys: ['Shift'], pad: 'RB', action: t('drive.controls.nitro') },
    {
      keys: ['C'],
      pad: 'Y',
      action: `${t('drive.controls.camera')} (${t(`driveCamera.${DRIVE_CAMERAS[cameraIndex]}`)})`,
    },
    { keys: ['R'], pad: 'B', action: t('drive.controls.reset') },
    { keys: ['N'], pad: '–', action: t('drive.controls.time') },
    { keys: ['M'], pad: '–', action: t('drive.controls.sound') },
    { keys: ['Esc'], pad: 'Start', action: t('drive.controls.pause') },
  ];
  return (
    <div className="dv-controls">
      <div className="dv-pause-title">{t('drive.pause.controls')}</div>
      <table>
        <thead>
          <tr>
            <th>{t('drive.controls.action')}</th>
            <th>{t('drive.controls.keyboard')}</th>
            <th>{t('drive.controls.gamepad')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.action}>
              <td>{r.action}</td>
              <td>
                {r.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </td>
              <td>
                <kbd>{r.pad}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dv-controls-note">{t('drive.controls.note')}</p>
      <button
        type="button"
        className="dv-back is-active"
        onClick={() => useDriveStore.getState().setPauseView('main')}
      >
        ‹ {t('drive.controls.back')}
      </button>
    </div>
  );
}

type PauseItem = { id: string; label: string };

function PauseMenu() {
  const timeOfDay = useDriveStore((s) => s.timeOfDay);
  const view = useDriveStore((s) => s.pauseView);
  const volume = useAudioStore((s) => s.volume);
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
    { id: 'controls', label: t('drive.pause.controls') },
    { id: 'time', label: `${t('drive.pause.time')}: ${t(`timeOfDay.${timeOfDay}`)}` },
    { id: 'sound', label: `${t('drive.pause.sound')}: ${volumeLabel(volume)}` },
    { id: 'garage', label: t('drive.pause.garage') },
  ];

  const activate = (id: string) => {
    const s = useDriveStore.getState();
    if (id === 'resume') s.setPaused(false);
    else if (id === 'restart') {
      s.restart();
      s.setPaused(false);
    } else if (id === 'controls') s.setPauseView('controls');
    else if (id === 'time') s.toggleTimeOfDay();
    else if (id === 'sound') useAudioStore.getState().cycleVolume();
    else if (id === 'garage') leave();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view === 'controls') {
        if (e.key === 'Enter' || e.key === 'Backspace') {
          playUiSound('back');
          useDriveStore.getState().setPauseView('main');
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        playUiSound('move');
        setIndex((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        playUiSound('move');
        setIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        playUiSound('confirm');
        activate(items[index]?.id ?? 'resume');
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="dv-pause">
      {view === 'controls' ? (
        <ControlsPanel />
      ) : (
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
      )}
    </div>
  );
}

/** Sürüş kısayolları: Esc duraklat/geri, C kamera, R geri koy, N gün/gece, M ses. */
function useDriveKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const s = useDriveStore.getState();
      if (e.code === 'Escape') s.escape();
      else if (s.paused) return;
      else if (e.code === 'KeyC') s.cycleCamera();
      else if (e.code === 'KeyR') s.respawn();
      else if (e.code === 'KeyN') s.toggleTimeOfDay();
      else if (e.code === 'KeyM') useAudioStore.getState().cycleVolume();
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
