import { BufferAttribute, BufferGeometry } from 'three';

export type Emit = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  size0: number;
  size1: number;
  alpha: number;
  r: number;
  g: number;
  b: number;
};

/** Parçacık havuzu: halka tampon, CPU'da güncellenir, tek Points çizimi. */
export class ParticlePool {
  readonly geometry = new BufferGeometry();
  private readonly pos: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly color: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private readonly alpha0: Float32Array;
  private head = 0;

  constructor(readonly capacity: number) {
    this.pos = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity).fill(1);
    this.life = new Float32Array(capacity).fill(1);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.alpha0 = new Float32Array(capacity);
    this.geometry.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('aSize', new BufferAttribute(this.size, 1));
    this.geometry.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1));
    this.geometry.setAttribute('aColor', new BufferAttribute(this.color, 3));
  }

  emit(e: Emit): void {
    const i = this.head;
    this.head = (this.head + 1) % this.capacity;
    this.pos.set([e.x, e.y, e.z], i * 3);
    this.vel.set([e.vx, e.vy, e.vz], i * 3);
    this.color.set([e.r, e.g, e.b], i * 3);
    this.age[i] = 0;
    this.life[i] = e.life;
    this.size0[i] = e.size0;
    this.size1[i] = e.size1;
    this.alpha0[i] = e.alpha;
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      const age = (this.age[i] as number) + dt / (this.life[i] as number);
      this.age[i] = age;
      if (age >= 1) {
        this.alpha[i] = 0;
        continue;
      }
      this.pos[i * 3] = (this.pos[i * 3] as number) + (this.vel[i * 3] as number) * dt;
      this.pos[i * 3 + 1] = (this.pos[i * 3 + 1] as number) + (this.vel[i * 3 + 1] as number) * dt;
      this.pos[i * 3 + 2] = (this.pos[i * 3 + 2] as number) + (this.vel[i * 3 + 2] as number) * dt;
      // hız sönümü
      this.vel[i * 3] = (this.vel[i * 3] as number) * (1 - 1.5 * dt);
      this.vel[i * 3 + 1] = (this.vel[i * 3 + 1] as number) * (1 - 1.2 * dt);
      this.vel[i * 3 + 2] = (this.vel[i * 3 + 2] as number) * (1 - 1.5 * dt);
      this.size[i] =
        (this.size0[i] as number) + ((this.size1[i] as number) - (this.size0[i] as number)) * age;
      this.alpha[i] = (this.alpha0[i] as number) * (1 - age) * Math.min(1, age * 8);
    }
    for (const name of ['position', 'aSize', 'aAlpha', 'aColor'] as const)
      (this.geometry.getAttribute(name) as BufferAttribute).needsUpdate = true;
    this.geometry.setDrawRange(0, this.capacity);
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
