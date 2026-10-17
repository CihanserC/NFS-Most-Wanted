import { t } from '../../i18n';
import { useAppStore } from '../../core/store/appStore';
import { QUALITY_LEVELS, TONE_MAPPINGS, useGraphicsStore } from '../../core/store/graphicsStore';
import { useBuildStore } from '../../core/store/stores';

const next = <T,>(list: readonly T[], v: T): T => list[(list.indexOf(v) + 1) % list.length] as T;

export function TopBar() {
  const canUndo = useBuildStore((s) => s.history.past.length > 0);
  const canRedo = useBuildStore((s) => s.history.future.length > 0);
  const { undo, redo } = useBuildStore.getState();
  const turntable = useAppStore((s) => s.turntable);
  const toggleTurntable = useAppStore((s) => s.toggleTurntable);
  const { quality, toneMapping, showFps, fps, drawCalls, triangles } = useGraphicsStore();
  const { setQuality, setToneMapping, setShowFps } = useGraphicsStore.getState();

  return (
    <div className="gm-topbar">
      <button type="button" className="gm-chip" onClick={undo} disabled={!canUndo}>
        {t('ui.undo')}
      </button>
      <button type="button" className="gm-chip" onClick={redo} disabled={!canRedo}>
        {t('ui.redo')}
      </button>
      <button type="button" className="gm-chip" onClick={toggleTurntable}>
        {t('ui.turntable')}: {turntable ? t('ui.on') : t('ui.off')}
      </button>
      <button
        type="button"
        className="gm-chip"
        onClick={() => setQuality(next(QUALITY_LEVELS, quality))}
      >
        {t('ui.quality')}: {t(`quality.${quality}`)}
      </button>
      <button
        type="button"
        className="gm-chip"
        onClick={() => setToneMapping(next(TONE_MAPPINGS, toneMapping))}
      >
        {t('ui.toneMapping')}: {t(`toneMapping.${toneMapping}`)}
      </button>
      <button
        type="button"
        className={`gm-chip gm-fps${fps > 0 && fps < 55 ? ' is-low' : ''}`}
        onClick={() => setShowFps(!showFps)}
        title={`${t('ui.fpsToggle')} · ${t('ui.drawCalls')}: ${drawCalls} · ${t('ui.triangles')}: ${triangles.toLocaleString('tr-TR')}`}
      >
        {showFps ? `${fps} FPS` : 'FPS'}
      </button>
    </div>
  );
}
