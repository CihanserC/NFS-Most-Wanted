import { t } from '../i18n';

/** Ses seviyesi etiketi: %100 / %50 / Kapalı */
export const volumeLabel = (volume: number): string =>
  volume <= 0 ? t('ui.off') : `%${Math.round(volume * 100)}`;
