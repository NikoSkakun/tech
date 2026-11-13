/**
 * Power-system frequency model — one equivalent rotor for a whole synchronous area (single-node swing equation)
 * with linearised reserves. The ONE frequency model of the course (DECISIONS §9): `grid` §А (steps 2, 3, 4, 10,
 * 12, 14) and `plant-future` M4 (step 6) use it with different scenario parameters.
 *
 *   M·dΔf/dt = −ΔP_event + P_FCR + P_aFRR + P_mFRR + P_O + P_BESS + P_shed − D·Δf          (grid.md §А)
 *   M = 2·H·S_sync/f0  [MW·s/Hz]   (swing equation: d(½Jω²)/dt = ΔP  ⇒  2·H·S/f0 · dΔf/dt = ΔP, linearised at f0)
 *   D = k_L·P_L0       [MW/Hz]     (load self-regulation, k_L = 0,01 1/Hz = 1 %/Hz)
 *
 * Reserves (grid.md §А; DECISIONS §9: UFLS from 49,0 Hz, FCR fully active at ±200 mHz within 30 s):
 *   FCR     P* = clamp(−K_FCR·Δf, −L, +L), first-order lag T_FCR          (K = R_FCR/0,2 Hz, L = R_FCR, T = 6 s)
 *   aFRR    integral controller, dP/dt = clamp(−G·Δf, −R/300 s, +R/300 s), P ∈ [−R, R]
 *   mFRR    on command: linear ramp R/750 s up to R (12,5 min)
 *   LFSM-O  P* = −(f − 50,2)/2,5·P_flex above 50,2 Hz, lag 2 s
 *   BESS    P* = P_max·clamp((−Δf − a)/b, 0, 1), lag τ   — two laws: FCR (plant-future M4: a = 0,01, b = 0,19,
 *           τ = 0,1 s) and FFR (grid §А.6: armed below 49,8 Hz, a = 0,2, b = 0,3, τ = 0,2 s)
 *   UFLS    stages (threshold, fraction of P_L0); a stage trips once after f < threshold for ≥ 0,2 s
 *   Protection: f < 47,5 Hz or f > 51,5 Hz → blackout, integration stops.
 * Explicit Euler with a fixed internal step (default 5 ms, as in the document); frame dt is accumulated so the
 * result does not depend on the frame rate.
 */
import { clamp, FixedStepper } from './math';

export const NOMINAL_FREQUENCY_HZ = 50;

export interface FcrParams {
  enabled: boolean;
  /** Droop gain [MW/Hz]; for a reserve R fully active at 0,2 Hz: R/0,2. */
  gainMWPerHz: number;
  /** Symmetric output limit [MW] (= reserve R_FCR). */
  limitMW: number;
  /** First-order lag [s]; 6 s gives ≈ 99 % in 30 s. */
  timeConstantS: number;
}

export interface AfrrParams {
  enabled: boolean;
  /** Reserve R_aFRR [MW]; output limited to ±R. */
  reserveMW: number;
  /** Integral gain G [MW/(s·Hz)]. */
  gainMWPerHzS: number;
  /** Rate limit: full activation not faster than this [s] (dP/dt ≤ R/T). */
  fullActivationS: number;
}

export interface MfrrParams {
  /** Reserve R_mFRR [MW]; activated by `activateMfrr()`. */
  reserveMW: number;
  /** Linear ramp time to full reserve [s] (750 s = 12,5 min). */
  fullActivationS: number;
}

export interface LfsmOParams {
  enabled: boolean;
  /** Activation threshold [Hz] (50,2). */
  thresholdHz: number;
  /** Flexible generation P_flex [MW] (0,4·P_L0 in the document). */
  flexMW: number;
  /** Band [Hz]: P* = −(f − threshold)/band·P_flex (2,5 Hz ⇔ 5 % droop). */
  bandHz: number;
  timeConstantS: number;
}

export interface UflsStage {
  thresholdHz: number;
  /** Fraction of P_L0 shed when the stage trips. */
  fraction: number;
}

export interface UflsParams {
  enabled: boolean;
  stages: readonly UflsStage[];
  /** f must stay below the threshold continuously for this long [s]. */
  delayS: number;
}

export interface BessParams {
  enabled: boolean;
  /** Rated power P_max [MW]. */
  maxMW: number;
  /** Response starts at a deviation of `startDeviationHz` below nominal… */
  startDeviationHz: number;
  /** …and is full `spanHz` further down. */
  spanHz: number;
  /** First-order lag τ [s]. */
  timeConstantS: number;
  /** FFR arming threshold [Hz] (null = always armed). Once armed it stays armed until reset. */
  armBelowHz: number | null;
}

export interface FrequencyParams {
  f0Hz: number;
  /** Pre-event load P_L0 [MW] (UFLS fractions and D refer to it). */
  loadMW: number;
  /** Rated power of synchronous machines S_sync [MW]. */
  syncMW: number;
  /** Inertia constant H [s]. */
  inertiaH: number;
  /** Load self-regulation k_L [1/Hz]. */
  loadDampingPerHz: number;
  /** Additional inertia M [MW·s/Hz] of the rest of an interconnection (grid §А.4). */
  extraInertiaMWsPerHz: number;
  /** Additional damping D [MW/Hz] of the rest of an interconnection (grid §А.4). */
  extraDampingMWPerHz: number;
  fcr: FcrParams;
  afrr: AfrrParams;
  mfrr: MfrrParams;
  lfsmO: LfsmOParams;
  ufls: UflsParams;
  bess: BessParams;
  /** Generator protection band [Hz]: outside it → blackout. */
  protectionMinHz: number;
  protectionMaxHz: number;
  /** Internal Euler step [s] (document: 5 ms; §А.5/§А.6 control points: 2 ms). */
  integrationStepS: number;
}

export type FrequencyBand = 'normal' | 'alert' | 'emergency' | 'blackout';

export interface FrequencyState {
  timeS: number;
  fHz: number;
  deltaFHz: number;
  /** Current dΔf/dt [Hz/s]. */
  rocofHzPerS: number;
  /** RoCoF right after the most recent event [Hz/s] (= −ΔP/M when starting from balance). */
  rocofAtEventHzPerS: number;
  /** Sum of events ΔP_event [MW]; positive = deficit. */
  eventMW: number;
  /** Time of the first event [s] (null before any). */
  eventTimeS: number | null;
  pFcrMW: number;
  pAfrrMW: number;
  pMfrrMW: number;
  pLfsmOMW: number;
  pBessMW: number;
  pShedMW: number;
  /** Load self-regulation response −D·Δf [MW] (positive when frequency is low). */
  pDampingMW: number;
  mfrrActive: boolean;
  bessArmed: boolean;
  /** Per stage: trip time [s] or null. */
  uflsTripTimesS: (number | null)[];
  uflsStagesTripped: number;
  nadirHz: number;
  nadirTimeS: number;
  peakHz: number;
  peakTimeS: number;
  blackout: boolean;
  blackoutTimeS: number | null;
  /** normal |Δf| ≤ 50 mHz; alert ≤ 200 mHz; emergency beyond; blackout after protection trip. */
  band: FrequencyBand;
}

/** UFLS stages of grid §А / plant-future M4 (NC ER, 6 stages from 49,0 Hz). */
export const UFLS_STAGES_UA: readonly UflsStage[] = [
  { thresholdHz: 49.0, fraction: 0.05 },
  { thresholdHz: 48.8, fraction: 0.08 },
  { thresholdHz: 48.6, fraction: 0.08 },
  { thresholdHz: 48.4, fraction: 0.08 },
  { thresholdHz: 48.2, fraction: 0.08 },
  { thresholdHz: 48.0, fraction: 0.08 },
];

/** FCR fully activated at 200 mHz (DECISIONS §9) with lag T. */
export function fcrFromReserve(reserveMW: number, timeConstantS = 6, enabled = true): FcrParams {
  return { enabled, gainMWPerHz: reserveMW / 0.2, limitMW: reserveMW, timeConstantS };
}

/** BESS as an FCR participant (plant-future M4): dead band 10 mHz, full at 200 mHz, τ = 0,1 s. */
export function bessFcrLaw(maxMW: number): BessParams {
  return { enabled: maxMW > 0, maxMW, startDeviationHz: 0.01, spanHz: 0.19, timeConstantS: 0.1, armBelowHz: null };
}

/** Grid-forming BESS fast frequency response (grid §А.6): armed below 49,8 Hz, full at 49,5 Hz, τ = 0,2 s. */
export function bessFfrLaw(maxMW: number): BessParams {
  return { enabled: maxMW > 0, maxMW, startDeviationHz: 0.2, spanHz: 0.3, timeConstantS: 0.2, armBelowHz: 49.8 };
}

const OFF_BESS: BessParams = { ...bessFcrLaw(0), enabled: false };

function baseParams(loadMW: number): Omit<FrequencyParams, 'syncMW' | 'inertiaH' | 'fcr' | 'afrr' | 'mfrr'> {
  return {
    f0Hz: NOMINAL_FREQUENCY_HZ,
    loadMW,
    loadDampingPerHz: 0.01,
    extraInertiaMWsPerHz: 0,
    extraDampingMWPerHz: 0,
    lfsmO: { enabled: false, thresholdHz: 50.2, flexMW: 0.4 * loadMW, bandHz: 2.5, timeConstantS: 2 },
    ufls: { enabled: true, stages: UFLS_STAGES_UA, delayS: 0.2 },
    bess: OFF_BESS,
    protectionMinHz: 47.5,
    protectionMaxHz: 51.5,
    integrationStepS: 0.005,
  };
}

/** Toggles common to the grid scenarios. */
export interface ScenarioToggles {
  inertiaH?: number;
  fcr?: boolean;
  afrr?: boolean;
  ufls?: boolean;
  lfsmO?: boolean;
}

/** grid §А «Острів» (Ukraine-scale island): P_L0 15 GW, S_sync 12 GW, H 4 s, FCR 500, aFRR 1000/2000, mFRR 1000. */
export function islandScenario(t: ScenarioToggles = {}): FrequencyParams {
  const b = baseParams(15000);
  return {
    ...b,
    syncMW: 12000,
    inertiaH: t.inertiaH ?? 4,
    fcr: fcrFromReserve(500, 6, t.fcr ?? true),
    afrr: { enabled: t.afrr ?? false, reserveMW: 1000, gainMWPerHzS: 2000, fullActivationS: 300 },
    mfrr: { reserveMW: 1000, fullActivationS: 750 },
    lfsmO: { ...b.lfsmO, enabled: t.lfsmO ?? false },
    ufls: { ...b.ufls, enabled: t.ufls ?? true },
  };
}

/** grid §А «Континент» (CE): P_L0 300 GW, S_sync 300 GW, H 5 s, FCR 3000, aFRR 3000/20 000, mFRR 3000. */
export function continentScenario(t: ScenarioToggles = {}): FrequencyParams {
  const b = baseParams(300000);
  return {
    ...b,
    syncMW: 300000,
    inertiaH: t.inertiaH ?? 5,
    fcr: fcrFromReserve(3000, 6, t.fcr ?? true),
    afrr: { enabled: t.afrr ?? false, reserveMW: 3000, gainMWPerHzS: 20000, fullActivationS: 300 },
    mfrr: { reserveMW: 3000, fullActivationS: 750 },
    lfsmO: { ...b.lfsmO, enabled: t.lfsmO ?? false },
    ufls: { ...b.ufls, enabled: t.ufls ?? true },
  };
}

/**
 * grid §А.4 «Україна в складі CE»: island reserves plus the rest of the continent:
 * M_tot = M_isl + 2·5·285 000/50 = M_isl + 57 000;  D_tot = D_isl + 2850;  R_FCR = 500 + 2500.
 */
export function ukraineInCeScenario(t: ScenarioToggles = {}): FrequencyParams {
  const isl = islandScenario(t);
  return {
    ...isl,
    extraInertiaMWsPerHz: (2 * 5 * 285000) / NOMINAL_FREQUENCY_HZ,
    extraDampingMWPerHz: 2850,
    fcr: fcrFromReserve(3000, 6, t.fcr ?? true),
  };
}

/** grid §А.6: H = 6·(1 − x) + 0,5 s for an inverter share x ∈ [0,1; 0,9]. */
export function inertiaForInverterShare(x: number): number {
  return 6 * (1 - clamp(x, 0, 1)) + 0.5;
}

/** grid §А.6 «Мережа майбутнього»: island with H(x), FCR 500, UFLS on, optional grid-forming BESS FFR 800 MW. */
export function futureGridScenario(inverterShare: number, bessMW: number): FrequencyParams {
  return {
    ...islandScenario({ inertiaH: inertiaForInverterShare(inverterShare) }),
    bess: bessFfrLaw(bessMW),
    integrationStepS: 0.002,
  };
}

/** plant-future M4: island, H 2…6 s, FCR 500 MW, BESS in FCR 0…1000 MW (aFRR, mFRR, LFSM-O off). */
export function islandWithBessFcrScenario(inertiaH: number, bessMW: number): FrequencyParams {
  return { ...islandScenario({ inertiaH }), bess: bessFcrLaw(bessMW) };
}

/** Kinetic energy stored in the rotating masses [MW·s] = H·S_sync (grid step 3 «E_k» chips). */
export function kineticEnergyMWs(inertiaH: number, syncMW: number): number {
  return inertiaH * syncMW;
}

/** Initial RoCoF [Hz/s] after a step deficit ΔP from balance: −ΔP·f0/(2·H·S) (grid step 2). */
export function initialRocofHzPerS(deficitMW: number, inertiaH: number, syncMW: number, f0Hz = NOMINAL_FREQUENCY_HZ): number {
  return (-deficitMW * f0Hz) / (2 * inertiaH * syncMW);
}

/** Classification of a frequency deviation (normal band ±50 mHz, FCR full at ±200 mHz; DECISIONS §9). */
export function frequencyBand(deltaFHz: number, blackout: boolean): FrequencyBand {
  if (blackout) return 'blackout';
  const a = Math.abs(deltaFHz);
  return a <= 0.05 + 1e-12 ? 'normal' : a <= 0.2 + 1e-12 ? 'alert' : 'emergency';
}

export interface FrequencyModel {
  readonly state: Readonly<FrequencyState>;
  readonly params: Readonly<FrequencyParams>;
  /** Advance by `dt` seconds of simulated time (any dt; integrated with the fixed internal step). */
  step(dt: number): void;
  /** Replace parameters (toggles, H…) keeping the dynamic state. */
  set(params: Partial<FrequencyParams>): void;
  /** Back to balance at t = 0 (Δf = 0, all P = 0, no events). */
  reset(): void;
  /** Add a power event [MW] now: positive = deficit (unit trip, load increase), negative = surplus. */
  addEvent(deltaMW: number): void;
  /** Dispatcher command: start the mFRR ramp. */
  activateMfrr(): void;
}

function initialState(nStages: number, f0: number): FrequencyState {
  return {
    timeS: 0,
    fHz: f0,
    deltaFHz: 0,
    rocofHzPerS: 0,
    rocofAtEventHzPerS: 0,
    eventMW: 0,
    eventTimeS: null,
    pFcrMW: 0,
    pAfrrMW: 0,
    pMfrrMW: 0,
    pLfsmOMW: 0,
    pBessMW: 0,
    pShedMW: 0,
    pDampingMW: 0,
    mfrrActive: false,
    bessArmed: false,
    uflsTripTimesS: new Array<number | null>(nStages).fill(null),
    uflsStagesTripped: 0,
    nadirHz: f0,
    nadirTimeS: 0,
    peakHz: f0,
    peakTimeS: 0,
    blackout: false,
    blackoutTimeS: null,
    band: 'normal',
  };
}

export function inertiaMWsPerHz(p: FrequencyParams): number {
  return (2 * p.inertiaH * p.syncMW) / p.f0Hz + p.extraInertiaMWsPerHz;
}

export function dampingMWPerHz(p: FrequencyParams): number {
  return p.loadDampingPerHz * p.loadMW + p.extraDampingMWPerHz;
}

export function createFrequencyModel(initial: FrequencyParams): FrequencyModel {
  let p: FrequencyParams = { ...initial };
  let st = initialState(p.ufls.stages.length, p.f0Hz);
  let uflsTimers = new Array<number>(p.ufls.stages.length).fill(0);
  let stepper = new FixedStepper(p.integrationStepS);

  function rhs(): number {
    // Net accelerating power [MW]
    return (
      -st.eventMW + st.pFcrMW + st.pAfrrMW + st.pMfrrMW + st.pLfsmOMW + st.pBessMW + st.pShedMW - dampingMWPerHz(p) * st.deltaFHz
    );
  }

  function euler(h: number): void {
    const M = inertiaMWsPerHz(p);
    const df = st.deltaFHz;
    const f = p.f0Hz + df;
    const dDf = rhs() / M;

    // FCR (proportional, lagged)
    // (switched off → output decays with the same lag)
    const fcrTarget = p.fcr.enabled ? clamp(-p.fcr.gainMWPerHz * df, -p.fcr.limitMW, p.fcr.limitMW) : 0;
    const dFcr = (fcrTarget - st.pFcrMW) / Math.max(p.fcr.timeConstantS, h);

    // aFRR (rate-limited integral)
    let dAfrr = 0;
    if (p.afrr.enabled) {
      const rate = p.afrr.reserveMW / p.afrr.fullActivationS;
      dAfrr = clamp(-p.afrr.gainMWPerHzS * df, -rate, rate);
    }

    // mFRR (linear ramp after the command)
    const dMfrr = st.mfrrActive ? p.mfrr.reserveMW / p.mfrr.fullActivationS : 0;

    // LFSM-O
    const oTarget =
      p.lfsmO.enabled && f > p.lfsmO.thresholdHz ? (-(f - p.lfsmO.thresholdHz) / p.lfsmO.bandHz) * p.lfsmO.flexMW : 0;
    const dO = (oTarget - st.pLfsmOMW) / Math.max(p.lfsmO.timeConstantS, h);

    // BESS (FCR or FFR law)
    const b = p.bess;
    if (b.enabled && b.armBelowHz !== null && f < b.armBelowHz) st.bessArmed = true;
    const bessOn = b.enabled && (b.armBelowHz === null || st.bessArmed);
    const bTarget = bessOn ? b.maxMW * clamp((-df - b.startDeviationHz) / b.spanHz, 0, 1) : 0;
    const dB = (bTarget - st.pBessMW) / Math.max(b.timeConstantS, h);

    st.deltaFHz = df + h * dDf;
    st.pFcrMW += h * dFcr;
    if (p.afrr.enabled) st.pAfrrMW = clamp(st.pAfrrMW + h * dAfrr, -p.afrr.reserveMW, p.afrr.reserveMW);
    if (st.mfrrActive) st.pMfrrMW = Math.min(p.mfrr.reserveMW, st.pMfrrMW + h * dMfrr);
    st.pLfsmOMW += h * dO;
    st.pBessMW += h * dB;
    st.rocofHzPerS = dDf;
    st.timeS += h;

    // UFLS — evaluated on the new frequency; a stage trips once after a continuous delay.
    const fNew = p.f0Hz + st.deltaFHz;
    if (p.ufls.enabled) {
      p.ufls.stages.forEach((s, i) => {
        if (st.uflsTripTimesS[i] !== null) return;
        if (fNew < s.thresholdHz) {
          uflsTimers[i]! += h;
          if (uflsTimers[i]! >= p.ufls.delayS - 1e-9) {
            st.uflsTripTimesS[i] = st.timeS;
            st.uflsStagesTripped++;
            st.pShedMW += s.fraction * p.loadMW;
          }
        } else uflsTimers[i] = 0;
      });
    }

    st.fHz = fNew;
    st.pDampingMW = -dampingMWPerHz(p) * st.deltaFHz;
    if (fNew < st.nadirHz) {
      st.nadirHz = fNew;
      st.nadirTimeS = st.timeS;
    }
    if (fNew > st.peakHz) {
      st.peakHz = fNew;
      st.peakTimeS = st.timeS;
    }
    if (fNew < p.protectionMinHz || fNew > p.protectionMaxHz) {
      st.blackout = true;
      st.blackoutTimeS = st.timeS;
    }
    st.band = frequencyBand(st.deltaFHz, st.blackout);
  }

  const model: FrequencyModel = {
    get state() {
      return st;
    },
    get params() {
      return p;
    },
    step(dt: number) {
      const n = stepper.advance(dt);
      for (let i = 0; i < n && !st.blackout; i++) euler(p.integrationStepS);
    },
    set(next: Partial<FrequencyParams>) {
      const stagesChanged = next.ufls !== undefined && next.ufls.stages.length !== p.ufls.stages.length;
      p = { ...p, ...next };
      if (next.integrationStepS !== undefined) stepper = new FixedStepper(p.integrationStepS);
      if (stagesChanged) {
        st.uflsTripTimesS = new Array<number | null>(p.ufls.stages.length).fill(null);
        uflsTimers = new Array<number>(p.ufls.stages.length).fill(0);
      }
      st.rocofHzPerS = st.blackout ? 0 : rhs() / inertiaMWsPerHz(p);
    },
    reset() {
      st = initialState(p.ufls.stages.length, p.f0Hz);
      uflsTimers = new Array<number>(p.ufls.stages.length).fill(0);
      stepper.reset();
    },
    addEvent(deltaMW: number) {
      if (st.blackout || !Number.isFinite(deltaMW)) return;
      st.eventMW += deltaMW;
      if (st.eventTimeS === null) st.eventTimeS = st.timeS;
      st.rocofHzPerS = rhs() / inertiaMWsPerHz(p);
      st.rocofAtEventHzPerS = st.rocofHzPerS;
    },
    activateMfrr() {
      if (!st.blackout) st.mfrrActive = true;
    },
  };
  return model;
}

export interface FrequencyEvent {
  timeS: number;
  /** ΔP [MW], positive = deficit. */
  deltaMW?: number;
  /** Start mFRR at this time. */
  mfrr?: boolean;
}

export interface FrequencySample {
  timeS: number;
  fHz: number;
  pFcrMW: number;
  pAfrrMW: number;
  pMfrrMW: number;
  pLfsmOMW: number;
  pBessMW: number;
  pShedMW: number;
}

export interface FrequencyRun {
  samples: FrequencySample[];
  final: FrequencyState;
}

/**
 * Run a scenario offline (charts, «shadows» of previous attempts, tests). Events are applied at the first internal
 * step whose start time ≥ event time. Samples every `sampleEveryS` (rounded to whole internal steps).
 */
export function simulateFrequency(
  params: FrequencyParams,
  events: readonly FrequencyEvent[],
  durationS: number,
  sampleEveryS = 0.1,
): FrequencyRun {
  const m = createFrequencyModel(params);
  const h = params.integrationStepS;
  const nSteps = Math.round(durationS / h);
  const every = Math.max(1, Math.round(sampleEveryS / h));
  const pending = [...events].sort((a, b) => a.timeS - b.timeS);
  const samples: FrequencySample[] = [];
  const snap = (): void => {
    const s = m.state;
    samples.push({
      timeS: s.timeS,
      fHz: s.fHz,
      pFcrMW: s.pFcrMW,
      pAfrrMW: s.pAfrrMW,
      pMfrrMW: s.pMfrrMW,
      pLfsmOMW: s.pLfsmOMW,
      pBessMW: s.pBessMW,
      pShedMW: s.pShedMW,
    });
  };
  for (let k = 0; k < nSteps; k++) {
    while (pending.length > 0 && pending[0]!.timeS <= m.state.timeS + 1e-9) {
      const e = pending.shift()!;
      if (e.deltaMW !== undefined) m.addEvent(e.deltaMW);
      if (e.mfrr) m.activateMfrr();
    }
    if (k % every === 0) snap();
    m.step(h);
    if (m.state.blackout) break;
  }
  snap();
  return { samples, final: { ...m.state, uflsTripTimesS: [...m.state.uflsTripTimesS] } };
}

/** Frequency at time t [s] from a run's samples (linear interpolation). */
export function sampleAt(run: FrequencyRun, timeS: number): number {
  const s = run.samples;
  if (s.length === 0) return Number.NaN;
  if (timeS <= s[0]!.timeS) return s[0]!.fHz;
  for (let i = 1; i < s.length; i++) {
    const b = s[i]!;
    if (b.timeS >= timeS) {
      const a = s[i - 1]!;
      return a.fHz + ((b.fHz - a.fHz) * (timeS - a.timeS)) / (b.timeS - a.timeS);
    }
  }
  return s[s.length - 1]!.fHz;
}
