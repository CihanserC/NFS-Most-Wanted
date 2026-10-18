import { useAudioStore } from '../core/store/audioStore';

/** Menü sesleri: Web Audio ile sentezlenen kısa tıklamalar (ses dosyası gerekmez). */
export type UiSound = 'move' | 'confirm' | 'back' | 'error';

type Tone = {
  freq: number;
  end?: number;
  start: number;
  length: number;
  type: OscillatorType;
  gain: number;
};

/** Her ses birkaç kısa tonun birleşimidir (frekans, süre ve zarf sabit tablo). */
const SOUNDS: Record<UiSound, Tone[]> = {
  move: [{ freq: 880, end: 760, start: 0, length: 0.045, type: 'square', gain: 0.05 }],
  confirm: [
    { freq: 520, start: 0, length: 0.07, type: 'square', gain: 0.06 },
    { freq: 780, start: 0.06, length: 0.11, type: 'square', gain: 0.06 },
  ],
  back: [{ freq: 420, end: 300, start: 0, length: 0.09, type: 'triangle', gain: 0.08 }],
  error: [
    { freq: 200, start: 0, length: 0.09, type: 'sawtooth', gain: 0.06 },
    { freq: 150, start: 0.09, length: 0.12, type: 'sawtooth', gain: 0.06 },
  ],
};

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Menü sesi çalar; ses kapalıysa ya da Web Audio yoksa sessizce atlar. */
export function playUiSound(sound: UiSound): void {
  const volume = useAudioStore.getState().volume;
  if (volume <= 0) return;
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const tone of SOUNDS[sound]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    const t0 = now + tone.start;
    osc.frequency.setValueAtTime(tone.freq, t0);
    if (tone.end) osc.frequency.linearRampToValueAtTime(tone.end, t0 + tone.length);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(tone.gain * volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + tone.length + 0.02);
  }
}
