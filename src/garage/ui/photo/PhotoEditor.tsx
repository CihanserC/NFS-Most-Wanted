import { useEffect, useState } from 'react';
import { useAppStore } from '../../../core/store/appStore';
import {
  PHOTO_LIMITS,
  PHOTO_SCALES,
  usePhotoStore,
  type PhotoScale,
} from '../../../core/store/photoStore';
import { t } from '../../../i18n';
import { takePhoto } from '../../photo/actions';
import { photoOutputSize } from '../../photo/capture';
import { Choice, Section, Slider } from '../controls';
import '../garage/garageEditor.css';

const noop = () => undefined;

/** Pencere boyutu (tuval tam ekran): çıktı boyutu önizlemesi için. */
function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/** Fotoğraf modu: serbest kamera, FOV, alan derinliği, pozlama ve yüksek çözünürlüklü PNG. */
export function PhotoEditor() {
  const photo = usePhotoStore();
  const { set, setHideUi, reset } = usePhotoStore.getState();
  const turntable = useAppStore((s) => s.turntable);
  const viewport = useViewport();
  const out = photoOutputSize(photo.scale, viewport.w, viewport.h);

  return (
    <div className="pe we ge">
      <section>
        <p className="we-info">{t('photo.controls')}</p>
        <div className="ge-row">
          <button
            type="button"
            className="ge-btn is-primary"
            disabled={photo.busy}
            onClick={() => void takePhoto()}
          >
            {photo.busy ? t('photo.working') : t('photo.take')}
          </button>
          <button type="button" className="ge-btn" onClick={() => setHideUi(true)}>
            {t('photo.hideUi')}
          </button>
        </div>
        {photo.noticeKey && (
          <p className={`ge-notice is-${photo.noticeKey === 'photo.saved' ? 'ok' : 'error'}`}>
            {t(photo.noticeKey)}
          </p>
        )}
      </section>

      <Section title={t('photo.camera')}>
        <Slider
          label={t('photo.fov')}
          value={photo.fov}
          {...PHOTO_LIMITS.fov}
          format={(v) => `${v}°`}
          onPreview={(v) => set({ fov: v })}
          onCommit={noop}
        />
        <label className="we-check">
          <input
            type="checkbox"
            checked={turntable}
            onChange={() => useAppStore.getState().toggleTurntable()}
          />
          {t('ui.turntable')}
        </label>
      </Section>

      <Section title={t('photo.dof')}>
        <label className="we-check">
          <input
            type="checkbox"
            checked={photo.dofEnabled}
            onChange={(e) => set({ dofEnabled: e.target.checked })}
          />
          {t('photo.dofOn')}
        </label>
        {photo.dofEnabled && (
          <>
            <Slider
              label={t('photo.bokeh')}
              value={photo.bokeh}
              {...PHOTO_LIMITS.bokeh}
              format={(v) => v.toFixed(1)}
              onPreview={(v) => set({ bokeh: v })}
              onCommit={noop}
            />
            <Slider
              label={t('photo.focusRange')}
              value={photo.focusRange}
              {...PHOTO_LIMITS.focusRange}
              format={(v) => `${v.toFixed(1)} m`}
              onPreview={(v) => set({ focusRange: v })}
              onCommit={noop}
            />
          </>
        )}
      </Section>

      <Section title={t('photo.exposureTitle')}>
        <Slider
          label={t('photo.exposure')}
          value={photo.exposure}
          {...PHOTO_LIMITS.exposure}
          format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} EV`}
          onPreview={(v) => set({ exposure: v })}
          onCommit={noop}
        />
      </Section>

      <Section title={t('photo.resolution')}>
        <Choice<PhotoScale>
          options={PHOTO_SCALES}
          value={photo.scale}
          label={(s) => `${s}×`}
          onPreview={noop}
          onPick={(s) => set({ scale: s })}
          onLeave={noop}
          columns={4}
        />
        <p className="we-info">
          {t('photo.output').replace('{w}', String(out.width)).replace('{h}', String(out.height))}
          {out.ratio < photo.scale - 0.01 && ` ${t('photo.capped')}`}
        </p>
      </Section>

      <button type="button" className="ge-btn" onClick={reset}>
        {t('photo.reset')}
      </button>
    </div>
  );
}
