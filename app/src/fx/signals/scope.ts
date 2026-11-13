/**
 * Scope — a 3D oscilloscope: a grid screen with up to several glowing traces (phase colours by default).
 * A channel shows either an analytic waveform that runs with the scope's phase (`setWave`), or live data
 * (`setSamples` / `push` — a rolling trace fed by a simulation).
 */
import { Group, Vector3 } from 'three';
import { SEMANTIC, type ColorLike } from '@/style';
import { RibbonLines } from '../core/ribbon';
import { onTick } from '../core/tick';
import { createScreen, type Screen } from './screen';
import type { Waveform } from './waveforms';

export interface ScopeOptions {
  /** Screen size, units. Default 4 × 2.4. */
  width?: number;
  height?: number;
  /** Trace colours (one per channel). Default the three phases L1 / L2 / L3. */
  channels?: readonly ColorLike[];
  /** Points per trace. Default 160. */
  samples?: number;
  /** Periods visible across the screen for analytic waveforms. Default 2. */
  cycles?: number;
  /** Display frequency of analytic waveforms in Hz — already slowed down for the eye. Default 0.5. */
  frequency?: number;
  /** Trace thickness, units. Default 0.035. */
  lineWidth?: number;
  accent?: ColorLike;
}

interface Channel {
  line: RibbonLines;
  points: Vector3[];
  wave: Waveform | null;
  amplitude: number;
  data: Float32Array;
  dirty: boolean;
}

/** Oscilloscope. Create through `createScope()`. */
export class Scope extends Group {
  readonly screen: Screen;
  /** Display frequency, Hz (tweenable). */
  frequency: number;
  /** Phase of the analytic waveforms at the left edge, radians (integrated from `frequency`). */
  phase = 0;
  /** Stop the traces (a "frozen" screenshot of the signal). */
  frozen = false;
  private readonly channels: Channel[];
  private readonly w: number;
  private readonly h: number;
  private readonly cycles: number;

  constructor(o: ScopeOptions = {}) {
    super();
    this.name = 'scope';
    this.w = o.width ?? 4;
    this.h = o.height ?? 2.4;
    this.cycles = o.cycles ?? 2;
    this.frequency = o.frequency ?? 0.5;
    const n = o.samples ?? 160;
    this.screen = createScreen({ width: this.w, height: this.h, accent: o.accent });
    this.add(this.screen);
    const colors = o.channels ?? [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3];
    this.channels = colors.map((color, i) => {
      const line = new RibbonLines({ capacity: n + 2, color, width: o.lineWidth ?? 0.035, intensity: 1.05, hotCore: 0, dashStrength: 0, endFade: [0.01, 0.01], minPixels: 1.8 });
      line.position.z = 0.02 + i * 0.004; // traces float just above the glass, in a fixed order
      line.renderOrder = 2 + i;
      this.add(line);
      return { line, points: Array.from({ length: n }, () => new Vector3()), wave: null, amplitude: 1, data: new Float32Array(n), dirty: true };
    });
    onTick(this, (_t, dt) => {
      if (!this.frozen) this.phase = (this.phase + dt * this.frequency * Math.PI * 2) % (Math.PI * 2 * 1024);
      this.redraw();
    });
  }

  /** Channel `i` shows an analytic waveform with the given amplitude (1 = full half-height of the screen). */
  setWave(i: number, wave: Waveform | null, amplitude = 1): void {
    const c = this.channels[i];
    if (!c) return;
    c.wave = wave;
    c.amplitude = amplitude;
    c.dirty = true;
  }

  /** Channel `i` shows these samples (values −1…1, left → right; resampled to the trace resolution). */
  setSamples(i: number, values: ArrayLike<number>): void {
    const c = this.channels[i];
    if (!c) return;
    c.wave = null;
    const n = c.data.length;
    for (let k = 0; k < n; k++) c.data[k] = values[Math.min(values.length - 1, Math.round((k / (n - 1)) * (values.length - 1)))] ?? 0;
    c.dirty = true;
  }

  /** Rolling trace: append one value on the right, the rest shifts left. */
  push(i: number, value: number): void {
    const c = this.channels[i];
    if (!c) return;
    c.wave = null;
    c.data.copyWithin(0, 1);
    c.data[c.data.length - 1] = value;
    c.dirty = true;
  }

  /** Brightness of one trace (0 hides the channel; tweenable through a proxy). */
  setChannelIntensity(i: number, intensity: number): void {
    const c = this.channels[i];
    if (c) c.line.intensity = intensity;
  }

  private redraw(): void {
    const halfW = this.w * 0.5 * 0.94;
    const halfH = this.h * 0.5 * 0.8;
    for (const c of this.channels) {
      if (!c.wave && !c.dirty) continue;
      const n = c.points.length;
      for (let k = 0; k < n; k++) {
        const x = k / (n - 1);
        const v = c.wave ? c.wave(this.phase + x * this.cycles * Math.PI * 2) * c.amplitude : c.data[k]!;
        c.points[k]!.set((x * 2 - 1) * halfW, Math.max(-1.15, Math.min(1.15, v)) * halfH, 0);
      }
      c.line.setLines([{ points: c.points }]);
      c.dirty = false;
    }
  }
}

export function createScope(o: ScopeOptions = {}): Scope {
  return new Scope(o);
}
