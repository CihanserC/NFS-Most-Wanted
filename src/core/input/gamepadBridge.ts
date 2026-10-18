import {
  driveAxes,
  driveKeys,
  initialPadState,
  menuKeys,
  type DriveAxes,
  type PadSnapshot,
} from './gamepad';

/** Bağlı ilk gamepad'in anlık görüntüsü (yoksa null). */
function activePad(): PadSnapshot | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  for (const pad of navigator.getGamepads()) if (pad?.connected) return pad;
  return null;
}

/** Sürüş için analog giriş; gamepad yoksa null. Klavye girişiyle birleştirilir (input.ts). */
export function readGamepadDrive(): DriveAxes | null {
  const pad = activePad();
  return pad ? driveAxes(pad) : null;
}

export type PadContext = 'menu' | 'drive';

const dispatchKey = (key: string, code: string) =>
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }),
  );

/**
 * Gamepad'i klavye olaylarına çevirir (menü gezintisi, sürüş kısayolları). Arayüz ve oyun tek
 * giriş yolundan (klavye olayları) çalıştığı için ayrıca gamepad bilgisi gerektirmez.
 * context: menüde mi (garaj/duraklat) sürüşte mi; her karede sorulur.
 */
export function startGamepadBridge(context: () => PadContext): () => void {
  let state = initialPadState();
  let frame = 0;
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const pad = activePad();
    if (!pad) {
      state = initialPadState();
      return;
    }
    if (context() === 'menu') {
      const result = menuKeys(pad, state, now);
      state = result.state;
      for (const key of result.keys) dispatchKey(key, key === 'Enter' ? 'Enter' : key);
    } else {
      const result = driveKeys(pad, state);
      state = result.state;
      for (const code of result.codes)
        dispatchKey(code === 'Escape' ? 'Escape' : code.slice(3).toLowerCase(), code);
    }
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
