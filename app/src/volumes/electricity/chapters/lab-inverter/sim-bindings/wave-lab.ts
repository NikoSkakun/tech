/**
 * The waveform laboratory behind steps 4 and 5: one set of settings → the bridge waveform (§M2), its spectrum
 * and THD, and the same wave after the LC filter (§M3, with the dead-time error of §M4). No three.js.
 *
 * Everything is recomputed lazily, once, when a setting changed (`analysis` / `filtered` getters): a full
 * 65 536-point analysis costs ≈ 5 ms, so sliders may call `set()` on every move while the frame pays once.
 * The scope asks for instantaneous values through `before(t)` / `after(t)` (t in seconds within the period).
 */
import {
  GRID_F_HZ,
  WAVE_N,
  analyseWave,
  filterWave,
  harmonicBars,
  inverseSpectrum,
  loadResistanceOhm,
  triangleCarrier,
  waveSample,
  type FilteredAnalysis,
  type WaveAnalysis,
  type WaveKind,
  type WaveParams,
} from '@electricity/sim/lab-inverter';

export type LabWave = Exclude<WaveKind, 'ladder'>;
export const PERIOD_S = 1 / GRID_F_HZ;

export interface WaveSettings {
  kind: LabWave;
  /** Carrier frequency, Hz. */
  fcHz: number;
  /** Modulation index. */
  ma: number;
  /** Pulse width of the «модифікований синус», degrees (60…180). */
  pulseDeg: number;
  /** Filter: L (H), C (F), load power (W; 0 = no load). */
  lH: number;
  cF: number;
  loadW: number;
  /** Dead time, s, and its software compensation (applies to the PWM kinds). */
  deadTimeS: number;
  compensation: boolean;
}

export const WAVE_DEFAULTS: Readonly<WaveSettings> = Object.freeze({
  kind: 'spwm_uni',
  fcHz: 20000,
  ma: 0.81,
  pulseDeg: 120,
  lH: 1.5e-3,
  cF: 10e-6,
  loadW: 2000,
  deadTimeS: 0,
  compensation: false,
});

/** DC voltage per form: the square wave runs from the 325 V rig of step 3, the others from the 400 V link. */
export const udcOf = (kind: LabWave): number => (kind === 'square' ? 325 : 400);
export const isPwm = (kind: LabWave): boolean => kind === 'spwm_uni' || kind === 'spwm_bi';

export interface WaveLab {
  readonly settings: Readonly<WaveSettings>;
  set(patch: Partial<WaveSettings>): void;
  /** Bumps whenever a setting changed (cheap change detection for charts). */
  readonly version: number;
  readonly params: WaveParams;
  readonly udcV: number;
  readonly analysis: WaveAnalysis;
  readonly filtered: FilteredAnalysis;
  /** Harmonic amplitudes 1…1000 (peak volts) before / after the filter. */
  readonly barsBefore: Float64Array;
  readonly barsAfter: Float64Array;
  /** Bridge voltage at time t (exact, not sampled). */
  before(tS: number): number;
  /** Filtered output at time t (from the inverse spectrum). */
  after(tS: number): number;
  /** Reference sine (−1…1 · m_a) and carrier (−1…1) at time t. */
  reference(tS: number): number;
  carrier(tS: number): number;
  /** Gate states [S1, S2, S3, S4] at time t (which keys the controller holds on). */
  gates(tS: number): [boolean, boolean, boolean, boolean];
}

export function createWaveLab(initial: Partial<WaveSettings> = {}): WaveLab {
  let s: WaveSettings = { ...WAVE_DEFAULTS, ...initial };
  let version = 1;
  let analysis: WaveAnalysis | null = null;
  let filtered: FilteredAnalysis | null = null;
  let afterSamples: Float64Array | null = null;
  let barsBefore: Float64Array | null = null;
  let barsAfter: Float64Array | null = null;
  const params = (): WaveParams => ({
    kind: s.kind,
    udcV: udcOf(s.kind),
    ma: s.ma,
    fcHz: s.fcHz,
    alphaDeg: (180 - s.pulseDeg) / 2,
    deadTimeS: s.deadTimeS,
    deadTimeCompensation: s.compensation,
  });
  // cached parameter objects: the scope samples `before()` / `gates()` thousands of times per frame
  let p = params();
  let pIdeal: WaveParams = { ...p, deadTimeS: 0 };
  const getAnalysis = (): WaveAnalysis => (analysis ??= analyseWave(p));
  const getFiltered = (): FilteredAnalysis =>
    (filtered ??= filterWave(getAnalysis(), s.lH, s.cF, loadResistanceOhm(s.loadW)));
  const WAVE_KEYS: readonly (keyof WaveSettings)[] = [
    'kind',
    'fcHz',
    'ma',
    'pulseDeg',
    'deadTimeS',
    'compensation',
  ];
  const wrap = (tS: number): number => ((tS % PERIOD_S) + PERIOD_S) % PERIOD_S;

  return {
    get settings() {
      return s;
    },
    set(patch) {
      let wave = false;
      let any = false;
      for (const key of Object.keys(patch) as (keyof WaveSettings)[]) {
        if (patch[key] === undefined || patch[key] === s[key]) continue;
        any = true;
        if (WAVE_KEYS.includes(key)) wave = true;
      }
      if (!any) return;
      s = { ...s, ...patch };
      p = params();
      pIdeal = { ...p, deadTimeS: 0 };
      version++;
      if (wave) {
        analysis = null;
        barsBefore = null;
      }
      filtered = null;
      afterSamples = null;
      barsAfter = null;
    },
    get version() {
      return version;
    },
    get params() {
      return p;
    },
    get udcV() {
      return udcOf(s.kind);
    },
    get analysis() {
      return getAnalysis();
    },
    get filtered() {
      return getFiltered();
    },
    get barsBefore() {
      return (barsBefore ??= harmonicBars(getAnalysis().spectrum, 1000));
    },
    get barsAfter() {
      return (barsAfter ??= harmonicBars(getFiltered().spectrum, 1000));
    },
    before: (tS) => waveSample(p, wrap(tS)),
    after(tS) {
      afterSamples ??= inverseSpectrum(getFiltered().spectrum);
      // linear interpolation between the two nearest samples of the period
      const x = (wrap(tS) / PERIOD_S) * WAVE_N;
      const i = Math.floor(x);
      const a = afterSamples[i % WAVE_N]!;
      const b = afterSamples[(i + 1) % WAVE_N]!;
      return a + (b - a) * (x - i);
    },
    reference: (tS) => s.ma * Math.sin(2 * Math.PI * GRID_F_HZ * tS),
    carrier: (tS) => triangleCarrier(wrap(tS), s.fcHz),
    gates(tS) {
      const t = wrap(tS);
      if (s.kind === 'spwm_uni') {
        const ref = s.ma * Math.sin(2 * Math.PI * GRID_F_HZ * t);
        const tri = triangleCarrier(t, s.fcHz);
        const a = ref >= tri;
        const b = -ref >= tri;
        return [a, !a, b, !b];
      }
      const u = waveSample(pIdeal, t);
      if (u > 0) return [true, false, false, true];
      if (u < 0) return [false, true, true, false];
      return [false, true, false, true]; // zero state of the stepped wave: both lower keys
    },
  };
}
