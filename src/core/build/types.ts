/**
 * Aracın tüm modifiye durumunu tutan serileştirilebilir obje.
 * Faz 1 sürümü sadece parçaları içerir; boya, vinil, jant vb. alanlar ilgili fazlarda
 * yeni sürüm + migration ile eklenecek (bkz. migrate.ts).
 */
export type BuildState = {
  version: 1;
  carId: string;
  name: string;
  /** slot id -> seçenek id */
  parts: Record<string, string>;
  updatedAt: string;
};

export const CURRENT_BUILD_VERSION = 1;
