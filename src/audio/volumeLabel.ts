import { formatPercent, t } from '../i18n';

/** Ses seviyesi etiketi: 100% / 50% / Off (dile göre) */
export const volumeLabel = (volume: number): string =>
  volume <= 0 ? t('ui.off') : formatPercent(volume);
