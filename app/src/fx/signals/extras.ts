/**
 * More signal visuals: a sine wave travelling along a wire, a crisp pulse train (PWM) and spectrum bars.
 */
import { BoxGeometry, Color, type Curve, InstancedMesh, Matrix4, Vector3 } from 'three';
import { col, K, SEMANTIC, type ColorLike } from '@/style';
import { RibbonLines } from '../core/ribbon';
import { onTick } from '../core/tick';
import type { Waveform } from './waveforms';

export interface WaveOnCurveOptions {
  color?: ColorLike;
  /** Peak displacement, units. Default 0.2. */
  amplitude?: number;
  /** Wavelength along the curve, units. Default 1. */
  wavelength?: number;
  /** Phase speed, units/s (sign = direction). Default 1. */
  speed?: number;
  /** Direction of the displacement (default +Y); kept perpendicular to the curve automatically. */
  transverse?: Vector3;
  /** Points along the curve. Default 160. */
  samples?: number;
  /** Fraction of the curve over which the wave fades in / out at the ends. Default 0.1. */
  taper?: number;
  width?: number;
  intensity?: number;
}

/** A sine wave travelling along a curve: y(s, t) = A·sin(2π·(s − v·t) / λ). */
export class WaveOnCurve extends RibbonLines {
  amplitude: number;
  wavelength: number;
  /** Phase speed, units/s (tweenable). */
  speed: number;

  constructor(curve: Curve<Vector3>, o: WaveOnCurveOptions = {}) {
    const n = o.samples ?? 160;
    super({ capacity: n + 2, color: o.color ?? SEMANTIC.current, width: o.width ?? 0.035, intensity: o.intensity ?? 1.2, hotCore: 0, dashStrength: 0, endFade: [0.03, 0.03] });
    this.name = 'wave-on-curve';
    this.amplitude = o.amplitude ?? 0.2;
    this.wavelength = o.wavelength ?? 1;
    this.speed = o.speed ?? 1;
    const length = curve.getLength();
    const taper = o.taper ?? 0.1;
    const up = (o.transverse ?? new Vector3(0, 1, 0)).clone().normalize();
    const base = Array.from({ length: n }, (_, i) => curve.getPointAt(i / (n - 1)));
    const normals = base.map((_, i) => {
      const t = curve.getTangentAt(i / (n - 1));
      return up.clone().addScaledVector(t, -up.dot(t)).normalize();
    });
    const points = base.map((p) => p.clone());
    let travelled = 0;
    onTick(this, (_t, dt) => {
      travelled = (travelled + this.speed * dt) % (this.wavelength * 4096);
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const env = Math.min(1, k / taper, (1 - k) / taper);
        const y = this.amplitude * env * Math.sin(((k * length - travelled) / this.wavelength) * Math.PI * 2);
        points[i]!.copy(base[i]!).addScaledVector(normals[i]!, y);
      }
      this.setLines([{ points }]);
    });
  }
}

export function createWaveOnCurve(curve: Curve<Vector3>, o: WaveOnCurveOptions = {}): WaveOnCurve {
  return new WaveOnCurve(curve, o);
}

export interface PulseTrainOptions {
  /** The waveform (e.g. `spwm(0.8, 15)` or `square(0.3)`). */
  wave: Waveform;
  /** Length / height of the strip, units. Defaults 4 / 0.6. */
  length?: number;
  height?: number;
  /** Periods of the fundamental visible along the strip. Default 1. */
  cycles?: number;
  /** Scroll frequency, Hz. Default 0.25. */
  frequency?: number;
  color?: ColorLike;
  width?: number;
}

/** A pulse train with vertical edges (PWM, square waves), scrolling along local X in the XY plane. */
export class PulseTrain extends RibbonLines {
  /** Scroll frequency, Hz (tweenable). */
  frequency: number;
  phase = 0;
  /** Replace the waveform (e.g. new modulation index). */
  wave: Waveform;

  constructor(o: PulseTrainOptions) {
    super({ capacity: 1400, color: o.color ?? SEMANTIC.current, width: o.width ?? 0.03, intensity: 1.1, hotCore: 0, dashStrength: 0, endFade: [0.02, 0.02], minPixels: 1.6, mitre: true });
    this.name = 'pulse-train';
    this.wave = o.wave;
    this.frequency = o.frequency ?? 0.25;
    const length = o.length ?? 4;
    const half = (o.height ?? 0.6) / 2;
    const cycles = o.cycles ?? 1;
    const fine = 1200; // scan resolution used to find the edges
    onTick(this, (_t, dt) => {
      this.phase = (this.phase + dt * this.frequency * Math.PI * 2) % (Math.PI * 2);
      const points: Vector3[] = [];
      let last = NaN;
      for (let i = 0; i <= fine && points.length < 1390; i++) {
        const k = i / fine;
        const v = this.wave(this.phase + k * cycles * Math.PI * 2);
        const x = (k - 0.5) * length;
        // a point pair at every jump keeps the edge vertical; flat stretches need only their end points
        if (v !== last) {
          if (!Number.isNaN(last)) points.push(new Vector3(x, last * half, 0));
          points.push(new Vector3(x, v * half, 0));
          last = v;
        } else if (i === fine) points.push(new Vector3(x, v * half, 0));
      }
      this.setLines([{ points }]);
    });
  }
}

export function createPulseTrain(o: PulseTrainOptions): PulseTrain {
  return new PulseTrain(o);
}

export interface SpectrumBarsOptions {
  /** Number of bars. */
  count: number;
  /** Total width / maximum bar height, units. Defaults 3 / 1.5. */
  width?: number;
  height?: number;
  /** Colour of the bars, and of the first bar (the fundamental). Defaults `sky` / `yellow`. */
  color?: ColorLike;
  fundamental?: ColorLike;
  /** Smoothing rate toward new values, 1/s. Default 8. */
  response?: number;
}

/** Spectrum bars standing on the local XZ plane along X; `set(values)` with amplitudes 0…1. */
export class SpectrumBars extends InstancedMesh {
  private readonly target: Float32Array;
  private readonly current: Float32Array;

  constructor(o: SpectrumBarsOptions) {
    const width = o.width ?? 3;
    const pitch = width / o.count;
    super(new BoxGeometry(pitch * 0.68, 1, pitch * 0.68).translate(0, 0.5, 0), K.glow({ color: 'white', intensity: 1.35, falloff: 0.6, edge: 0.8 }), o.count);
    this.name = 'spectrum-bars';
    this.target = new Float32Array(o.count);
    this.current = new Float32Array(o.count);
    const main = col(o.color ?? 'sky');
    const first = col(o.fundamental ?? 'yellow');
    for (let i = 0; i < o.count; i++) this.setColorAt(i, i === 0 ? first : new Color().copy(main));
    const m = new Matrix4();
    const height = o.height ?? 1.5;
    const response = o.response ?? 8;
    onTick(this, (_t, dt) => {
      const k = 1 - Math.exp(-response * Math.min(dt, 0.1));
      for (let i = 0; i < o.count; i++) {
        this.current[i]! += (this.target[i]! - this.current[i]!) * (dt > 0 ? k : 1);
        m.makeScale(1, Math.max(this.current[i]! * height, 0.012), 1).setPosition((i + 0.5) * pitch - width / 2, 0, 0);
        this.setMatrixAt(i, m);
      }
      this.instanceMatrix.needsUpdate = true;
    });
  }

  /** New amplitudes (0…1 of the full height); bars ease toward them. */
  set(values: ArrayLike<number>): void {
    for (let i = 0; i < this.target.length; i++) this.target[i] = Math.max(0, Math.min(1, values[i] ?? 0));
  }
}

export function createSpectrumBars(o: SpectrumBarsOptions): SpectrumBars {
  return new SpectrumBars(o);
}
