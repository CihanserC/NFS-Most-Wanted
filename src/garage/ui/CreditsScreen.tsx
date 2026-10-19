import { useEffect, useState } from 'react';
import { isNonCommercial, validateCredits, type CreditEntry } from '../../core/credits/credits';
import { SOFTWARE_CREDITS } from '../../core/credits/software';
import { useAppStore } from '../../core/store/appStore';
import { t } from '../../i18n';
import './credits.css';

type Assets =
  { status: 'loading' } | { status: 'ready'; list: CreditEntry[] } | { status: 'error' };

/** public/assets/CREDITS.json'u okur ve doğrular (üçüncü taraf model/ses atıfları). */
function useAssetCredits(): Assets {
  const [assets, setAssets] = useState<Assets>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}assets/CREDITS.json`)
      .then((r) =>
        r.ok ? (r.json() as Promise<unknown>) : Promise.reject(new Error(String(r.status))),
      )
      .then((json) => {
        if (cancelled) return;
        const result = validateCredits(json);
        setAssets(result.ok ? { status: 'ready', list: result.value.assets } : { status: 'error' });
      })
      .catch(() => {
        if (!cancelled) setAssets({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return assets;
}

/** Kredi ekranı: açık kaynak yazılımlar + üçüncü taraf varlık atıfları. Esc ya da dışarı tıkla kapatır. */
export function CreditsScreen() {
  const assets = useAssetCredits();
  const close = () => useAppStore.getState().setCreditsOpen(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      close();
    };
    // Yakalama aşamasında: menünün Esc işleyicisi çalışmasın
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div
      className="cr-backdrop"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={t('credits.title')}
    >
      <div className="cr-panel" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{t('credits.title')}</h2>
          <button type="button" onClick={close} aria-label={t('credits.close')}>
            ✕
          </button>
        </header>
        <div className="cr-body">
          <section>
            <h3>{t('credits.assets')}</h3>
            {assets.status === 'loading' && <p>…</p>}
            {assets.status === 'error' && <p className="cr-warn">{t('credits.loadError')}</p>}
            {assets.status === 'ready' && assets.list.length === 0 && (
              <p>{t('credits.noAssets')}</p>
            )}
            {assets.status === 'ready' && assets.list.length > 0 && (
              <ul>
                {assets.list.map((a) => (
                  <li key={`${a.name}-${a.author}`}>
                    <strong>{a.name}</strong> — {a.author}
                    <small>
                      {a.license}
                      {a.usedFor ? ` · ${a.usedFor}` : ''}
                      {a.changes ? ` · ${a.changes}` : ''}
                    </small>
                    {isNonCommercial(a.license) && (
                      <small className="cr-warn">{t('credits.nonCommercial')}</small>
                    )}
                    <a href={a.source} target="_blank" rel="noreferrer noopener">
                      {a.source}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3>{t('credits.software')}</h3>
            <ul>
              {SOFTWARE_CREDITS.map((s) => (
                <li key={s.name}>
                  <strong>{s.name}</strong>
                  <small>
                    {s.license} · {t(s.usedForKey)}
                  </small>
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <p className="cr-note">{t('credits.note')}</p>
        </div>
      </div>
    </div>
  );
}
