import { t } from '../../i18n';
import { useAppStore } from '../../core/store/appStore';
import { useBuildStore } from '../../core/store/stores';

export function TopBar() {
  const canUndo = useBuildStore((s) => s.history.past.length > 0);
  const canRedo = useBuildStore((s) => s.history.future.length > 0);
  const { undo, redo } = useBuildStore.getState();
  const turntable = useAppStore((s) => s.turntable);
  const toggleTurntable = useAppStore((s) => s.toggleTurntable);

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
    </div>
  );
}
