import type { DriveInput } from '../core/drive/drivetrain';
import { readGamepadDrive } from '../core/input/gamepadBridge';

const KEYS = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
} as const;

export type InputSource = {
  read: () => DriveInput;
  /** Geliştirme/test: klavye yerine sabit giriş ver (null: klavyeye dön) */
  override: (input: DriveInput | null) => void;
  dispose: () => void;
};

/** Klavye durumunu izler; her adımda read() ile anlık sürüş girişini verir. */
export function createInputSource(): InputSource {
  const down = new Set<string>();
  let forced: DriveInput | null = null;
  const onDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    down.add(e.code);
  };
  const onUp = (e: KeyboardEvent) => down.delete(e.code);
  const onBlur = () => down.clear();
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  const any = (codes: readonly string[]) => codes.some((c) => down.has(c));
  return {
    read: () => {
      if (forced) return forced;
      const keyboard: DriveInput = {
        throttle: any(KEYS.throttle) ? 1 : 0,
        brake: any(KEYS.brake) ? 1 : 0,
        steer: (any(KEYS.left) ? 1 : 0) - (any(KEYS.right) ? 1 : 0),
        handbrake: any(KEYS.handbrake),
      };
      // Gamepad varsa analog değerlerle birleştirilir (daha büyük olan kazanır)
      const pad = readGamepadDrive();
      if (!pad) return keyboard;
      return {
        throttle: Math.max(keyboard.throttle, pad.throttle),
        brake: Math.max(keyboard.brake, pad.brake),
        steer: Math.max(-1, Math.min(1, keyboard.steer + pad.steer)),
        handbrake: keyboard.handbrake || pad.handbrake,
      };
    },
    override: (input) => {
      forced = input;
    },
    dispose: () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
