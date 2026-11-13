/**
 * History of a signal for the oscilloscope traces: samples (t, value) appended every frame, read back as an
 * evenly spaced window ending "now". The scope of this chapter draws the newest value on the LEFT, next to the
 * phasor dial, and lets older values flow to the right — the classic "the sine is the shadow of the rotating
 * arrow" picture. No three.js here.
 */
export class TraceBuffer {
  private readonly t: Float64Array;
  private readonly v: Float32Array;
  private head = 0;
  private count = 0;

  constructor(private readonly capacity = 4096) {
    this.t = new Float64Array(capacity);
    this.v = new Float32Array(capacity);
  }

  clear(): void {
    this.count = 0;
    this.head = 0;
  }

  /** Append a sample (times must not decrease). */
  push(time: number, value: number): void {
    this.t[this.head] = time;
    this.v[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);
  }

  /** Newest time, or −∞ when empty. */
  get last(): number {
    return this.count ? this.t[(this.head - 1 + this.capacity) % this.capacity]! : -Infinity;
  }

  /**
   * Fill `out` with `out.length` values over [now − window, now]: out[0] = now (newest), out[n−1] = oldest.
   * Before the first sample `fill` is used (a flat line), so a fresh step shows a clean start.
   */
  sample(now: number, window: number, out: Float32Array, fill = 0): Float32Array {
    const n = out.length;
    const at = (j: number): number => (this.head - 1 - j + this.capacity * 2) % this.capacity;
    let j = 0; // counts back from the newest sample; only grows because tq decreases with i
    for (let i = 0; i < n; i++) {
      const tq = now - (window * i) / (n - 1);
      while (j < this.count && this.t[at(j)]! > tq) j++;
      if (j >= this.count) {
        out[i] = fill;
        continue;
      }
      const a = at(j);
      if (j === 0) {
        out[i] = this.v[a]!;
        continue;
      }
      const b = at(j - 1);
      const ta = this.t[a]!;
      const tb = this.t[b]!;
      const f = tb > ta ? (tq - ta) / (tb - ta) : 0;
      out[i] = this.v[a]! + (this.v[b]! - this.v[a]!) * f;
    }
    return out;
  }
}
