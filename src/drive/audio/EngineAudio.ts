/** Egzoz tipine göre ses karakteri (§5.2: egzoz sesi tonunu etkiler). */
export const EXHAUST_VOICE: Record<
  string,
  { cutoff: number; gain: number; rumble: number; raspy: number }
> = {
  rear_dual: { cutoff: 1, gain: 1, rumble: 0.5, raspy: 0.35 },
  side_pipes: { cutoff: 1.7, gain: 1.25, rumble: 0.4, raspy: 0.8 },
  quad: { cutoff: 0.85, gain: 1.15, rumble: 0.9, raspy: 0.3 },
};

const DEFAULT_VOICE = { cutoff: 1, gain: 1, rumble: 0.5, raspy: 0.35 };

export type AudioFrame = {
  rpm: number;
  throttle: number;
  speed: number;
  /** 0..1 lastik kayması */
  slip: number;
  supercharged: boolean;
  /** 0..1 ana ses seviyesi (0 = sessiz) */
  volume: number;
  paused: boolean;
};

const TWO_PI_SMOOTH = 0.04;
/** V8: devir başına 4 ateşleme */
const FIRINGS_PER_REV = 4;
const MASTER_GAIN = 0.55;

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Web Audio ile sentezlenmiş motor, süperşarjör, lastik ve rüzgar sesi (gerçek ses dosyaları
 * gelene kadar yer tutucu). Tarayıcı izin verene kadar sessiz kalır.
 */
export class EngineAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private oscA!: OscillatorNode;
  private oscB!: OscillatorNode;
  private oscRumble!: OscillatorNode;
  private oscWhine!: OscillatorNode;
  private engineFilter!: BiquadFilterNode;
  private engineGain!: GainNode;
  private rumbleGain!: GainNode;
  private rasp!: GainNode;
  private whineGain!: GainNode;
  private squealFilter!: BiquadFilterNode;
  private squealGain!: GainNode;
  private windGain!: GainNode;
  private sources: AudioScheduledSourceNode[] = [];

  constructor(private readonly exhaust: string) {}

  /** Kullanıcı etkileşiminden sonra çağır (autoplay politikası). */
  start(): void {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const voice = EXHAUST_VOICE[this.exhaust] ?? DEFAULT_VOICE;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.Q.value = 1.4;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(8 + voice.raspy * 18);
    shaper.oversample = '2x';
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;

    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'square';
    this.oscRumble = ctx.createOscillator();
    this.oscRumble.type = 'triangle';
    const gainA = ctx.createGain();
    gainA.gain.value = 0.55;
    const gainB = ctx.createGain();
    gainB.gain.value = 0.3;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0.5 * voice.rumble;
    this.oscA.connect(gainA).connect(shaper);
    this.oscB.connect(gainB).connect(shaper);
    this.oscRumble.connect(this.rumbleGain).connect(this.engineFilter);
    shaper.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master);

    // Egzoz hırıltısı: gürültü, gaz ve rpm ile artar
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 2);
    noise.loop = true;
    const raspFilter = ctx.createBiquadFilter();
    raspFilter.type = 'bandpass';
    raspFilter.frequency.value = 900;
    raspFilter.Q.value = 0.8;
    this.rasp = ctx.createGain();
    this.rasp.gain.value = 0;
    noise.connect(raspFilter).connect(this.rasp).connect(this.master);

    // Süperşarjör uğultusu
    this.oscWhine = ctx.createOscillator();
    this.oscWhine.type = 'sine';
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.oscWhine.connect(this.whineGain).connect(this.master);

    // Lastik çığlığı
    const squeal = ctx.createBufferSource();
    squeal.buffer = noiseBuffer(ctx, 2);
    squeal.loop = true;
    this.squealFilter = ctx.createBiquadFilter();
    this.squealFilter.type = 'bandpass';
    this.squealFilter.Q.value = 9;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    squeal.connect(this.squealFilter).connect(this.squealGain).connect(this.master);

    // Rüzgar / yol gürültüsü
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer(ctx, 2);
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(windFilter).connect(this.windGain).connect(this.master);

    this.sources = [this.oscA, this.oscB, this.oscRumble, this.oscWhine, noise, squeal, wind];
    for (const s of this.sources) s.start();
  }

  /** Tarayıcı AudioContext'i askıya aldıysa kullanıcı etkileşiminde sürdür. */
  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  update(f: AudioFrame): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const voice = EXHAUST_VOICE[this.exhaust] ?? DEFAULT_VOICE;
    const silent = f.volume <= 0 || f.paused;
    const set = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, TWO_PI_SMOOTH);

    set(this.master.gain, silent ? 0 : MASTER_GAIN * f.volume);
    const fire = (Math.max(f.rpm, 600) / 60) * FIRINGS_PER_REV;
    set(this.oscA.frequency, fire);
    set(this.oscB.frequency, fire / 2);
    set(this.oscRumble.frequency, fire / 4);
    const load = 0.35 + f.throttle * 0.65;
    set(this.engineFilter.frequency, (320 + f.rpm * 0.28 + f.throttle * 700) * voice.cutoff);
    set(this.engineGain.gain, (0.07 + load * 0.2) * voice.gain);
    set(this.rasp.gain, f.throttle * 0.05 * voice.raspy * Math.min(1, f.rpm / 4000));
    set(this.whineGain.gain, f.supercharged ? 0.012 + f.throttle * 0.035 : 0);
    set(this.oscWhine.frequency, 380 + f.rpm * 0.55);
    set(this.squealFilter.frequency, 1100 + f.slip * 700 + f.speed * 6);
    set(this.squealGain.gain, f.slip > 0.25 ? Math.min(1, f.slip) * 0.16 : 0);
    set(this.windGain.gain, Math.min(1, f.speed / 70) * 0.1);
  }

  stop(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // zaten durmuş olabilir
      }
    }
    this.sources = [];
    void this.ctx?.close();
    this.ctx = null;
  }
}
