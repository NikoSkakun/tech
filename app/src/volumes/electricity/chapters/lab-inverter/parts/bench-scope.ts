/**
 * `benchScope` — the holographic oscilloscope over the bench (the "second luminary" of the studio): a grid
 * screen with two tracks and a row of spectrum bars under it. It only draws: `draw(lab, t0, span)` rebuilds
 * the traces for the time window, `setSpectrum(…)` sets the bars. Colours as the document fixes them: bridge
 * voltage before the filter `violet`, after the filter `yellow`, reference `yellow`, carrier `cyan`.
 *
 * Modes — `pwm`: upper track reference + carrier, lower track pulses + filtered output;
 * `filter`: upper track pulses (before), lower track output (after).
 */
import { Group, Vector3 } from 'three';
import { RibbonLines, createScreen, createSpectrumBars, type SpectrumBars } from '@/fx';
import { SEMANTIC } from '@/style';
import { isPwm, type WaveLab } from '../sim-bindings/wave-lab';

export const SCOPE = { w: 7.8, h: 4.0, trackY: 0.98, trackH: 0.74, bars: 48, barsH: 1.25 } as const;
export type ScopeMode = 'pwm' | 'filter';

export interface BenchScope {
  group: Group;
  mode: ScopeMode;
  /** Redraw the traces for the window [t0, t0 + span] (seconds of the 20 ms period; wraps). */
  /** `dense`: the pulses are too many to resolve in this window — draw them as a fence between their levels. */
  draw(lab: WaveLab, t0: number, span: number, dense?: boolean): void;
  /** Spectrum rows from harmonic amplitudes 1…1000 (peak V): the bridge wave and, optionally, the output. */
  setSpectrum(before: ArrayLike<number>, after: ArrayLike<number> | null, udcV: number): void;
  barsBefore: SpectrumBars;
  barsAfter: SpectrumBars;
  /** Local position on the screen: x = −1…1 across, track = +1 upper / −1 lower, y = −1…1 inside the track. */
  point(x: number, track: 1 | -1, y?: number, out?: Vector3): Vector3;
  /** Local position over bar `i` of the spectrum rows. */
  barPoint(i: number, out?: Vector3): Vector3;
}

/** Harmonic number at the left edge of spectrum bin `i` (log-spaced 1…1000 over `SCOPE.bars` bins). */
export const binStart = (i: number): number => Math.round(10 ** ((i / SCOPE.bars) * 3));
/** Spectrum bin of harmonic h. */
export const binOf = (h: number): number =>
  Math.max(0, Math.min(SCOPE.bars - 1, Math.floor((Math.log10(Math.max(h, 1)) / 3) * SCOPE.bars)));

function ribbon(color: string, width: number, capacity: number, mitre = false): RibbonLines {
  const r = new RibbonLines({
    capacity,
    color,
    width,
    intensity: 1.1,
    hotCore: 0,
    dashStrength: 0,
    endFade: [0.01, 0.01],
    minPixels: 1.8,
    mitre,
    keepHue: true,
  });
  r.frustumCulled = false;
  return r;
}

export function createBenchScope(): BenchScope {
  const group = new Group();
  group.name = 'bench-scope';
  const screen = createScreen({ width: SCOPE.w, height: SCOPE.h, divisions: [10, 8], accent: 'violet' });
  const ref = ribbon(SEMANTIC.current as string, 0.035, 260);
  const carrier = ribbon(SEMANTIC.electron as string, 0.022, 420, true);
  const pulses = ribbon('violet', 0.036, 1500, true);
  const out = ribbon(SEMANTIC.current as string, 0.04, 420);
  [ref, carrier, pulses, out].forEach((r, i) => {
    r.position.z = 0.02 + i * 0.005;
    r.renderOrder = 2 + i;
  });
  // the "now" cursor in the middle of the screen
  const cursor = ribbon('white', 0.014, 4);
  cursor.setLines([
    {
      points: [new Vector3(0, -SCOPE.h * 0.46, 0.04), new Vector3(0, SCOPE.h * 0.46, 0.04)],
      brightness: 0.5,
    },
  ]);
  group.add(screen, ref, carrier, pulses, out, cursor);

  // spectrum rows on a shelf under the screen: bridge wave behind, filtered output in front
  const barsBefore = createSpectrumBars({
    count: SCOPE.bars,
    width: SCOPE.w,
    height: SCOPE.barsH,
    color: 'violet',
    fundamental: 'violet',
  });
  const barsAfter = createSpectrumBars({
    count: SCOPE.bars,
    width: SCOPE.w,
    height: SCOPE.barsH,
    color: 'yellow',
    fundamental: 'yellow',
  });
  barsBefore.position.set(0, -SCOPE.h / 2 - SCOPE.barsH - 0.28, 0);
  barsAfter.position.set(0, -SCOPE.h / 2 - SCOPE.barsH - 0.28, 0.14);
  group.add(barsBefore, barsAfter);

  const halfW = (SCOPE.w / 2) * 0.95;
  const X = (k: number): number => (k * 2 - 1) * halfW;
  const pool: Vector3[] = [];
  let used = 0;
  const v = (x: number, y: number): Vector3 => {
    const p = (pool[used] ??= new Vector3());
    used++;
    return p.set(x, y, 0);
  };
  const smooth = (n: number, yc: number, fn: (k: number) => number): Vector3[] => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= n; i++)
      pts.push(v(X(i / n), yc + SCOPE.trackH * Math.max(-1.25, Math.min(1.25, fn(i / n)))));
    return pts;
  };
  const bins = new Float32Array(SCOPE.bars);
  const fill = (target: SpectrumBars, amps: ArrayLike<number> | null, udcV: number): void => {
    bins.fill(0);
    if (amps) {
      // each bar = the largest harmonic of its log-spaced bin, on a 3.5-decade log scale up to 1.3·U_dc
      const top = Math.log10(udcV * 1.3);
      for (let h = 1; h <= 1000; h++) {
        const a = amps[h - 1] ?? 0;
        const k = a > 0 ? (Math.log10(a) - (top - 3.5)) / 3.5 : 0;
        const b = binOf(h);
        if (k > bins[b]!) bins[b] = k;
      }
    }
    target.set(bins);
  };

  const K_V = 0.8; // ±U_dc (and a reference of 1.0) use 80 % of the track's half height
  const SCAN = 2600;
  const self: BenchScope = {
    group,
    mode: 'pwm',
    barsBefore,
    barsAfter,
    draw(lab, t0, span, dense = false) {
      used = 0;
      const { kind, fcHz } = lab.settings;
      const udc = lab.udcV;
      const pwm = self.mode === 'pwm';
      const yPulse = pwm ? -SCOPE.trackY : SCOPE.trackY;
      ref.visible = pwm;
      carrier.visible = pwm && isPwm(kind);
      if (pwm)
        ref.setLines([{ points: smooth(200, SCOPE.trackY, (k) => lab.reference(t0 + k * span) * K_V) }]);
      if (carrier.visible) {
        // a triangle is straight between its extrema, which fall on multiples of 1 / (2·f_c)
        const pts: Vector3[] = [v(X(0), SCOPE.trackY + SCOPE.trackH * K_V * lab.carrier(t0))];
        const first = Math.ceil(t0 * 2 * fcHz + 1e-9);
        const last = Math.floor((t0 + span) * 2 * fcHz - 1e-9);
        for (let n = first; n <= last && pts.length < 400; n++) {
          const t = n / (2 * fcHz);
          pts.push(v(X((t - t0) / span), SCOPE.trackY + SCOPE.trackH * K_V * (n % 2 === 0 ? -1 : 1)));
        }
        pts.push(v(X(1), SCOPE.trackY + SCOPE.trackH * K_V * lab.carrier(t0 + span)));
        carrier.setLines([{ points: pts }]);
      }
      const pts: Vector3[] = [];
      if (dense) {
        // a fence: at this time base a real scope shows a solid band between the two levels the bridge
        // switches between (0 / ±U for the three-level form, −U / +U for the two-level one)
        const FENCE = 300;
        for (let i = 0; i <= FENCE; i++) {
          const k = i / FENCE;
          const positive = lab.reference(t0 + k * span) >= 0;
          const hi = kind === 'spwm_bi' ? 1 : positive ? 1 : 0;
          const lo = kind === 'spwm_bi' ? -1 : positive ? 0 : -1;
          pts.push(v(X(k), yPulse + SCOPE.trackH * K_V * (i % 2 ? hi : lo)));
          pts.push(v(X(k), yPulse + SCOPE.trackH * K_V * (i % 2 ? lo : hi)));
        }
      } else {
        // scan the window finely; every change of level gets a vertical edge (two points)
        let last = Number.NaN;
        for (let i = 0; i <= SCAN && pts.length < 1480; i++) {
          const k = i / SCAN;
          const u = (lab.before(t0 + k * span) / udc) * K_V;
          if (u !== last) {
            if (!Number.isNaN(last)) pts.push(v(X(k), yPulse + SCOPE.trackH * last));
            pts.push(v(X(k), yPulse + SCOPE.trackH * u));
            last = u;
          } else if (i === SCAN) pts.push(v(X(k), yPulse + SCOPE.trackH * u));
        }
      }
      pulses.setLines([{ points: pts }]);
      out.setLines([{ points: smooth(260, -SCOPE.trackY, (k) => (lab.after(t0 + k * span) / udc) * K_V) }]);
    },
    setSpectrum(before, after, udcV) {
      fill(barsBefore, before, udcV);
      fill(barsAfter, after, udcV);
      barsAfter.visible = after !== null;
    },
    point: (x, track, y = 0, o = new Vector3()) =>
      o.set(x * halfW, track * SCOPE.trackY + y * SCOPE.trackH, 0.05),
    barPoint: (i, o = new Vector3()) =>
      o.set(((i + 0.5) / SCOPE.bars - 0.5) * SCOPE.w, -SCOPE.h / 2 - SCOPE.barsH - 0.28, 0.2),
  };
  return self;
}
