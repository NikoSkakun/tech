/**
 * A process the reader scrubs with a slider: melting, boiling.
 *
 * The slider gives a coordinate s (0 … 1) — heat received so far. Forward, the picture is the live simulation: the
 * conditions of the sample follow s (`conditions`), and s cannot run ahead of the molecules (`pace`: simulated time
 * that one unit of s takes). Every state passed is kept as a frame. Backward, the picture replays the kept frames —
 * heat taken away is the same road walked back. At rest the simulation lives on at the conditions of that s.
 * Deterministic: the same slider motions give the same frames.
 */
import type { WaterMd } from './md';

export interface ProcessSpec {
  md: WaterMd;
  /** Set heating, lid and the like for the coordinate s. */
  conditions(md: WaterMd, s: number): void;
  /** Model temperature of the sample at s (to restart the molecules' motion after a rewind). */
  temperature(s: number): number;
  /** Simulated time units that the whole road (s from 0 to 1) takes near s. */
  pace(s: number): number;
  /** Number of kept frames along the road (default 320). */
  frames?: number;
}

interface Frame {
  pos: Float32Array;
  quat: Float32Array;
  alive: Uint8Array;
  bond: Float32Array;
  bondTo: Int32Array;
  warmth: Float32Array;
  lidY: number;
}

export class Process {
  readonly md: WaterMd;
  /** The coordinate on screen. */
  shown = 0;
  /** What is drawn: positions (3 per molecule), quaternions (4), presence, bonds per hydrogen, warmth, the lid. */
  readonly pos: Float32Array;
  readonly quat: Float32Array;
  readonly alive: Uint8Array;
  readonly bond: Float32Array;
  readonly bondTo: Int32Array;
  readonly warmth: Float32Array;
  lidY: number;
  /** The simulation's own coordinate (≥ `shown` while the picture replays kept frames). */
  private at = 0;
  private readonly kept: (Frame | undefined)[];
  private readonly n: number;
  private restarts = 0;

  constructor(private readonly spec: ProcessSpec) {
    const md = (this.md = spec.md);
    const n = md.capacity;
    this.n = spec.frames ?? 320;
    this.kept = new Array<Frame | undefined>(this.n + 1);
    this.pos = new Float32Array(3 * n);
    this.quat = new Float32Array(4 * n);
    this.alive = new Uint8Array(n);
    this.bond = new Float32Array(2 * n);
    this.bondTo = new Int32Array(2 * n);
    this.warmth = new Float32Array(n);
    this.lidY = md.lidY;
    spec.conditions(md, 0);
    md.computeForces();
    this.keep(0);
    this.showLive();
  }

  private snapshot(): Frame {
    const { md } = this;
    const c = md.count;
    return {
      pos: Float32Array.from(md.pos.subarray(0, 3 * c)),
      quat: Float32Array.from(md.quat.subarray(0, 4 * c)),
      alive: md.alive.slice(0, c),
      bond: md.bond.slice(0, 2 * c),
      bondTo: md.bondTo.slice(0, 2 * c),
      warmth: md.warmth.slice(0, c),
      lidY: md.lidY,
    };
  }

  private keep(k: number): void {
    this.kept[k] = this.snapshot();
  }

  private showLive(): void {
    const { md } = this;
    const c = md.count;
    for (let i = 0; i < 3 * c; i++) this.pos[i] = md.pos[i]!;
    for (let i = 0; i < 4 * c; i++) this.quat[i] = md.quat[i]!;
    this.alive.set(md.alive.subarray(0, c));
    this.bond.set(md.bond.subarray(0, 2 * c));
    this.bondTo.set(md.bondTo.subarray(0, 2 * c));
    this.warmth.set(md.warmth.subarray(0, c));
    this.lidY = md.lidY;
  }

  /** Draw the kept state at s: positions and orientations between the two nearest frames. */
  private showKept(s: number): void {
    const x = Math.min(this.n, Math.max(0, s * this.n));
    let k = Math.floor(x);
    while (k > 0 && !this.kept[k]) k--;
    const a = this.kept[k]!;
    const b = this.kept[k + 1] ?? a;
    const u = b === a ? 0 : x - k;
    const c = this.md.count;
    for (let i = 0; i < c; i++) {
      // a molecule that has left by the later frame stays where the earlier frame has it
      const w = a.alive[i] && b.alive[i] ? u : 0;
      for (let d = 0; d < 3; d++) this.pos[3 * i + d] = a.pos[3 * i + d]! + (b.pos[3 * i + d]! - a.pos[3 * i + d]!) * w;
      // quaternions: the short way round, renormalised
      const q = 4 * i;
      const dot = a.quat[q]! * b.quat[q]! + a.quat[q + 1]! * b.quat[q + 1]! + a.quat[q + 2]! * b.quat[q + 2]! + a.quat[q + 3]! * b.quat[q + 3]!;
      const sg = dot < 0 ? -1 : 1;
      let l = 0;
      for (let d = 0; d < 4; d++) {
        const v = a.quat[q + d]! + (sg * b.quat[q + d]! - a.quat[q + d]!) * w;
        this.quat[q + d] = v;
        l += v * v;
      }
      l = 1 / Math.sqrt(l);
      for (let d = 0; d < 4; d++) this.quat[q + d]! *= l;
    }
    const near = u < 0.5 ? a : b;
    this.alive.set(a.alive);
    this.bond.set(near.bond);
    this.bondTo.set(near.bondTo);
    this.warmth.set(near.warmth);
    this.lidY = a.lidY + (b.lidY - a.lidY) * u;
  }

  /** Put the simulation into the kept state at s (the motion restarts at the temperature of s, seeded). */
  private restart(s: number): void {
    const { md } = this;
    this.showKept(s);
    const c = md.count;
    for (let i = 0; i < 3 * c; i++) md.pos[i] = this.pos[i]!;
    for (let i = 0; i < 4 * c; i++) md.quat[i] = this.quat[i]!;
    md.alive.set(this.alive.subarray(0, c));
    md.lidY = this.lidY;
    md.lidV = 0;
    md.thermalise(this.spec.temperature(s), 1000 + ++this.restarts);
    md.primed = false;
    this.at = s;
    // frames beyond s belong to a road that will now be walked again
    for (let k = Math.floor(s * this.n) + 1; k <= this.n; k++) this.kept[k] = undefined;
  }

  /**
   * One screen frame. `want`: where the slider asks the picture to be (0 … 1); `time`: simulated time units this
   * frame may spend. Returns the coordinate now on screen (`shown`): it follows `want` at once backward and no
   * faster than the molecules allow forward.
   */
  update(want: number, time: number): number {
    const { md, spec } = this;
    const target = Math.min(1, Math.max(0, want));
    if (target < this.shown - 1e-4) {
      // backward: replay
      this.shown = target;
      this.showKept(target);
      return this.shown;
    }
    if (this.at > this.shown + 1e-4) this.restart(this.shown);
    let steps = Math.max(1, Math.round(time / md.dt));
    const batch = 4;
    while (steps > 0) {
      const n = Math.min(batch, steps);
      steps -= n;
      spec.conditions(md, this.at);
      md.step(n);
      if (this.at < target) {
        const before = Math.floor(this.at * this.n);
        this.at = Math.min(target, this.at + (n * md.dt) / spec.pace(this.at));
        const after = Math.floor(this.at * this.n);
        if (after > before) this.keep(after);
      }
    }
    // at rest the kept frame of this place follows the living sample, so a rewind starts from what is on screen
    if (this.at >= target) this.keep(Math.floor(this.at * this.n));
    this.shown = this.at;
    this.showLive();
    return this.shown;
  }

  /** Jump to s without playing the road (deep links, QA): the simulation runs there unseen. */
  skipTo(s: number, budget = 200000): void {
    const { md, spec } = this;
    const target = Math.min(1, Math.max(0, s));
    if (target < this.at) {
      this.restart(target);
    } else {
      let steps = 0;
      while (this.at < target && steps < budget) {
        spec.conditions(md, this.at);
        md.step(8);
        steps += 8;
        const before = Math.floor(this.at * this.n);
        this.at = Math.min(target, this.at + (8 * md.dt) / spec.pace(this.at));
        const after = Math.floor(this.at * this.n);
        if (after > before) this.keep(after);
      }
    }
    this.shown = this.at;
    this.showLive();
  }
}
