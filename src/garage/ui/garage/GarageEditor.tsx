import { useEffect, useRef, useState } from 'react';
import { useGarageStore } from '../../../core/store/garageStore';
import { useBuildStore } from '../../../core/store/stores';
import { exportBuildJson, exportFileName } from '../../../core/storage/garageService';
import { t } from '../../../i18n';
import { downloadBlob } from '../../photo/capture';
import { captureThumbnail } from '../../photo/actions';
import { Section } from '../controls';
import './garageEditor.css';

const NOTICE_MS = 4500;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });

/** Proje adı: yazarken yerel, Enter/odak kaybında projeye uygulanır. */
function NameField() {
  const name = useBuildStore((s) => s.build.name);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) useBuildStore.getState().setName(draft);
    setDraft(null);
  };
  return (
    <label className="ge-name">
      <span>{t('garage.name')}</span>
      <input
        value={draft ?? name}
        maxLength={40}
        spellCheck={false}
        onFocus={() => setDraft(name)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  );
}

function Notice() {
  const notice = useGarageStore((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => useGarageStore.getState().dismissNotice(), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);
  if (!notice) return null;
  const text = t(notice.key).replace('{name}', notice.params?.name ?? '');
  return (
    <p className={`ge-notice is-${notice.kind}`} role="status">
      {text}
    </p>
  );
}

function SlotCard({ id }: { id: string }) {
  const slot = useGarageStore((s) => s.slots.find((x) => x.id === id));
  const current = useGarageStore((s) => s.currentSlotId === id);
  const [confirming, setConfirming] = useState(false);
  if (!slot) return null;
  const { load, remove } = useGarageStore.getState();
  return (
    <li className={`ge-slot${current ? ' is-current' : ''}`}>
      <div className="ge-thumb">
        {slot.thumbnail ? (
          <img src={slot.thumbnail} alt="" />
        ) : (
          <span>{t('garage.noPreview')}</span>
        )}
      </div>
      <div className="ge-slot-info">
        <strong>{slot.name}</strong>
        <small>
          {formatDate(slot.updatedAt)}
          {current && <em> · {t('garage.working')}</em>}
        </small>
        <div className="ge-slot-actions">
          <button type="button" onClick={() => void load(slot.id)}>
            {t('garage.load')}
          </button>
          <button
            type="button"
            className={confirming ? 'is-danger' : ''}
            onClick={() => {
              if (confirming) void remove(slot.id);
              else setConfirming(true);
            }}
            onBlur={() => setConfirming(false)}
          >
            {confirming ? t('garage.confirmDelete') : t('garage.delete')}
          </button>
        </div>
      </div>
    </li>
  );
}

function JsonSection() {
  const [text, setText] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const importText = useGarageStore((s) => s.importText);

  const exportFile = () => {
    const build = useBuildStore.getState().build;
    downloadBlob(
      new Blob([exportBuildJson(build)], { type: 'application/json' }),
      exportFileName(build),
    );
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportBuildJson(useBuildStore.getState().build));
      useGarageStore.setState({ notice: { kind: 'ok', key: 'garage.copied' } });
    } catch {
      useGarageStore.setState({ notice: { kind: 'error', key: 'garage.error.clipboard' } });
    }
  };
  const readFile = async (f: File | undefined) => {
    if (!f) return;
    importText(await f.text());
    if (file.current) file.current.value = '';
  };

  return (
    <Section title={t('garage.share')}>
      <div className="ge-row">
        <button type="button" className="ge-btn" onClick={exportFile}>
          {t('garage.exportFile')}
        </button>
        <button type="button" className="ge-btn" onClick={() => void copy()}>
          {t('garage.copyJson')}
        </button>
        <button type="button" className="ge-btn" onClick={() => file.current?.click()}>
          {t('garage.importFile')}
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
      </div>
      <textarea
        className="ge-json"
        value={text}
        placeholder={t('garage.pasteHint')}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="ge-btn"
        disabled={text.trim() === ''}
        onClick={() => {
          importText(text);
          setText('');
        }}
      >
        {t('garage.importText')}
      </button>
    </Section>
  );
}

/** Garaj: build kaydet/yükle/sil (IndexedDB), JSON dışa/içe aktarma. */
export function GarageEditor() {
  const ids = useGarageStore((s) => s.slots.map((x) => x.id).join('|'));
  const storageKind = useGarageStore((s) => s.storage.kind);
  const currentSlotId = useGarageStore((s) => s.currentSlotId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void useGarageStore.getState().refresh();
  }, []);

  const save = async (asNew: boolean) => {
    setBusy(true);
    try {
      const thumbnail = await captureThumbnail();
      await useGarageStore.getState().save({ asNew, thumbnail });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pe we ge">
      <section>
        <NameField />
        <div className="ge-row">
          <button
            type="button"
            className="ge-btn is-primary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            {currentSlotId ? t('garage.save') : t('garage.saveNew')}
          </button>
          {currentSlotId && (
            <button
              type="button"
              className="ge-btn"
              disabled={busy}
              onClick={() => void save(true)}
            >
              {t('garage.saveAsNew')}
            </button>
          )}
          <button
            type="button"
            className="ge-btn"
            disabled={busy}
            onClick={() => useGarageStore.getState().newProject()}
          >
            {t('garage.newProject')}
          </button>
        </div>
        <Notice />
        {storageKind === 'memory' && <p className="we-info">{t('garage.memoryWarning')}</p>}
      </section>

      <Section title={t('garage.slots')}>
        {ids === '' ? (
          <p className="we-info">{t('garage.empty')}</p>
        ) : (
          <ul className="ge-slots">
            {ids.split('|').map((id) => (
              <SlotCard key={id} id={id} />
            ))}
          </ul>
        )}
      </Section>

      <JsonSection />
    </div>
  );
}
