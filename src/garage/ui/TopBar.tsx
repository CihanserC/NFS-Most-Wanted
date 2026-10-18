import { t } from '../../i18n';
import { leaveToSelect } from '../../core/store/carSession';
import { useAppStore } from '../../core/store/appStore';
import { useGraphicsStore } from '../../core/store/graphicsStore';
import { useBuildStore } from '../../core/store/stores';

/** Dişli çark simgesi (ayarlar). */
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.4 7.4 0 0 0-1.7-1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.5 8.8a.5.5 0 0 0 .1.6l2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
}

/**
 * Üst çubuk: yalnızca temel eylemler. Grafik, ses ve diğer ayarlar dişli çarkın açtığı
 * ayarlar penceresindedir (SettingsDialog).
 */
export function TopBar() {
  const mode = useAppStore((s) => s.mode);
  const canUndo = useBuildStore((s) => s.history.past.length > 0);
  const canRedo = useBuildStore((s) => s.history.future.length > 0);
  const { undo, redo } = useBuildStore.getState();
  const { showFps, fps, drawCalls, triangles, autoNotice } = useGraphicsStore();

  return (
    <div className="gm-topbar">
      {autoNotice && (
        <span key={autoNotice.id} className="gm-notice" role="status">
          {t('ui.autoQualityNotice').replace('{level}', t(`quality.${autoNotice.level}`))}
        </span>
      )}
      {showFps && (
        <span
          className={`gm-fps-readout${fps > 0 && fps < 55 ? ' is-low' : ''}`}
          title={`${t('ui.drawCalls')}: ${drawCalls} · ${t('ui.triangles')}: ${triangles.toLocaleString('tr-TR')}`}
        >
          {fps} FPS
        </span>
      )}
      {mode === 'garage' && (
        <>
          <button type="button" className="gm-chip" onClick={() => void leaveToSelect()}>
            {t('ui.changeCar')}
          </button>
          <button
            type="button"
            className="gm-chip gm-icon"
            onClick={undo}
            disabled={!canUndo}
            aria-label={t('ui.undo')}
            title={`${t('ui.undo')} (Ctrl+Z)`}
          >
            ↶
          </button>
          <button
            type="button"
            className="gm-chip gm-icon"
            onClick={redo}
            disabled={!canRedo}
            aria-label={t('ui.redo')}
            title={`${t('ui.redo')} (Ctrl+Y)`}
          >
            ↷
          </button>
        </>
      )}
      <button
        type="button"
        className="gm-chip gm-icon gm-gear"
        onClick={() => useAppStore.getState().setSettingsOpen(true)}
        aria-label={t('settings.title')}
        title={t('settings.title')}
      >
        <GearIcon />
      </button>
    </div>
  );
}
