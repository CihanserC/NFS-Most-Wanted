/** Sürüşte tekerleğin süspansiyon, direksiyon ve dönüş durumu (garajda kullanılmaz). */
export type WheelPose = {
  /** Dinlenme konumuna göre dikey kayma (m, yukarı +) */
  dy: number;
  /** Direksiyon açısı (rad, sol +) */
  steer: number;
  /** Yuvarlanma açısı (rad, ileri +) */
  spin: number;
};
