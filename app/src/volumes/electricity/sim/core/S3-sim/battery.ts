/**
 * Li-ion cell and pack model: OCV(SOC) per chemistry, R₀ + one RC branch, temperature factors, constant-current
 * discharge, CC/CV charge, pack builder (sS·pP) and a toy ageing model.
 *
 * Source: `lab-battery` §M2–§M4, §M6 (oracle `tools/ref-models/C6-labs/battery_model.py`); pack compatibility with
 * «ЛІ-6» uses the reviewed three-state rule of §M4 and the SOH clamp of §M6 (both absent from the oracle).
 * Explicit Euler with dt = 1 s, as the document prescribes for reproducible fixtures.
 */
import { interp1 } from './num';

export type Chemistry = 'LFP' | 'NMC';

export const OCV_SOC_PCT = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100] as const;
/** Open-circuit voltage tables at 25 °C, V (§M2). */
export const OCV_TABLE: Record<Chemistry, readonly number[]> = {
  LFP: [2.5, 3.1, 3.2, 3.25, 3.28, 3.29, 3.3, 3.31, 3.32, 3.33, 3.34, 3.36, 3.6],
  NMC: [2.75, 3.35, 3.45, 3.55, 3.62, 3.67, 3.72, 3.79, 3.88, 3.97, 4.07, 4.12, 4.19],
};

/** Cell voltage limits, V. */
export const CELL_LIMITS: Record<Chemistry, { uMinV: number; uMaxV: number; uNomV: number }> = {
  LFP: { uMinV: 2.5, uMaxV: 3.65, uNomV: 3.2 },
  NMC: { uMinV: 2.75, uMaxV: 4.2, uNomV: 3.6 },
};

/**
 * OCV(SOC) by linear interpolation; above 100 % a steep tail OCV(100) + 0.5·(SOC − 100) so the CV phase ends
 * (no hysteresis, no temperature dependence — simplified model).
 */
export function ocvV(chem: Chemistry, socPct: number): number {
  const ys = OCV_TABLE[chem];
  if (socPct > 100) return ys[ys.length - 1]! + 0.5 * (socPct - 100);
  return interp1(OCV_SOC_PCT, ys, Math.max(0, socPct));
}

export interface CellSpec {
  id: string;
  chem: Chemistry;
  /** Capacity, Ah. */
  capacityAh: number;
  /** Ohmic resistance at 25 °C, Ω. */
  r0Ohm: number;
  /** RC-branch resistance at 25 °C, Ω. */
  r1Ohm: number;
  /** RC time constant at 25 °C, s. */
  tau1S: number;
  massKg: number;
  /** Datasheet continuous current, A. */
  iMaxA: number;
}

/** Cell library (§M2, 25 °C). */
export const CELLS: Record<'18650-NMC' | '21700-NMC' | 'LFP-100' | 'LFP-314', CellSpec> = {
  '18650-NMC': {
    id: '18650-NMC',
    chem: 'NMC',
    capacityAh: 3,
    r0Ohm: 0.03,
    r1Ohm: 0.03,
    tau1S: 200,
    massKg: 0.047,
    iMaxA: 15,
  },
  '21700-NMC': {
    id: '21700-NMC',
    chem: 'NMC',
    capacityAh: 5,
    r0Ohm: 0.02,
    r1Ohm: 0.02,
    tau1S: 200,
    massKg: 0.069,
    iMaxA: 10,
  },
  'LFP-100': {
    id: 'LFP-100',
    chem: 'LFP',
    capacityAh: 100,
    r0Ohm: 0.0008,
    r1Ohm: 0.0006,
    tau1S: 300,
    massKg: 1.98,
    iMaxA: 100,
  },
  'LFP-314': {
    id: 'LFP-314',
    chem: 'LFP',
    capacityAh: 314,
    r0Ohm: 0.00025,
    r1Ohm: 0.0002,
    tau1S: 300,
    massKg: 5.6,
    iMaxA: 157,
  },
};
export type CellId = keyof typeof CELLS;

/** Resistance multiplier k_R(T) = exp(0.03·(25 − T)) for T < 25, else max(0.8, 1 − 0.01·(T − 25)). */
export function resistanceFactor(tC: number): number {
  return tC < 25 ? Math.exp(0.03 * (25 - tC)) : Math.max(0.8, 1 - 0.01 * (tC - 25));
}

const KQ_T = [-20, -10, 0, 10, 25, 45] as const;
const KQ_F = [0.7, 0.8, 0.9, 0.96, 1.0, 1.0] as const;
/** Available-capacity multiplier at discharge k_Q(T) (linear interpolation, clamped at the ends). */
export function capacityFactor(tC: number): number {
  return interp1(KQ_T, KQ_F, tC);
}

/** Per-minute sample of a discharge/charge run. */
export interface CellSample {
  timeS: number;
  ah: number;
  socPct: number;
  /** Terminal voltage, V. */
  voltageV: number;
  /** OCV at the same SOC (the «show OCV» dashed curve), V. */
  ocvV: number;
  currentA: number;
  /** Running energy since the start of the run, Wh (out of the cell on discharge, into it on charge; M3). */
  wh: number;
  /** Running Joule heat Σ I·|U − U_OCV|·dt since the start of the run, J (M3). */
  heatJ: number;
}

export interface DischargeResult {
  ah: number;
  wh: number;
  minutes: number;
  /** Mean terminal voltage Wh/Ah, V. */
  meanVoltageV: number;
  /** Joule heat Σ I·(U_OCV − U)·dt, J. */
  heatJ: number;
  /** Samples every 60 s (including t = 0 and the cut-off point). */
  curve: CellSample[];
  /** Voltage at index len/2 of the per-minute curve («U на половині Ah»). */
  midVoltageV: number;
  /** Current above the datasheet continuous limit (amber chip). */
  overCurrent: boolean;
}

/**
 * Constant-current discharge at c-rate C (I = C·Q) from soc0 to U_min (§M2):
 *   v = OCV(soc) − I·R0 − v1;  v1 += dt·(I/C1 − v1/(R1·C1));  soc −= I·dt/3600/Q_eff·100
 * R0, R1 scale with k_R(T); C1 = τ1/R1(25 °C) is temperature independent; Q_eff = Q·k_Q(T).
 */
export function discharge(cell: CellSpec, cRate: number, tC = 25, soc0Pct = 100, dtS = 1): DischargeResult {
  const lim = CELL_LIMITS[cell.chem];
  const qEff = cell.capacityAh * capacityFactor(tC);
  const i = cRate * cell.capacityAh;
  const kr = resistanceFactor(tC);
  const r0 = cell.r0Ohm * kr;
  const r1 = cell.r1Ohm * kr;
  const c1 = cell.tau1S / cell.r1Ohm;
  let soc = soc0Pct;
  let v1 = 0;
  let ah = 0;
  let wh = 0;
  let t = 0;
  let heat = 0;
  const curve: CellSample[] = [];
  let v = 0;
  for (let guard = 0; guard < 400000; guard++) {
    const ocv = ocvV(cell.chem, soc);
    v = ocv - i * r0 - v1;
    if (t % 60 === 0) curve.push({ timeS: t, ah, socPct: soc, voltageV: v, ocvV: ocv, currentA: i, wh, heatJ: heat });
    if (v <= lim.uMinV || soc <= 0 || i <= 0) break;
    v1 += dtS * (i / c1 - v1 / (r1 * c1));
    soc -= ((i * dtS) / 3600 / qEff) * 100;
    ah += (i * dtS) / 3600;
    wh += (v * i * dtS) / 3600;
    heat += i * (ocv - v) * dtS;
    t += dtS;
  }
  if (curve[curve.length - 1]!.timeS !== t) {
    curve.push({ timeS: t, ah, socPct: soc, voltageV: v, ocvV: ocvV(cell.chem, soc), currentA: i, wh, heatJ: heat });
  }
  // The document's «half» index is taken on the per-minute series only.
  const perMinute = curve.filter((s) => s.timeS % 60 === 0);
  return {
    ah,
    wh,
    minutes: t / 60,
    meanVoltageV: ah > 0 ? wh / ah : 0,
    heatJ: heat,
    curve,
    midVoltageV: perMinute[Math.floor(perMinute.length / 2)]!.voltageV,
    overCurrent: i > cell.iMaxA + 1e-9,
  };
}

export type PlatingRisk = 'none' | 'amber' | 'red';

/** Lithium-plating warning (§M3): T < 0 °C (any current) → red; T < 10 °C ∧ C > 0.5 → amber. */
export function platingRisk(tC: number, cRate: number): PlatingRisk {
  if (tC < 0) return 'red';
  if (tC < 10 && cRate > 0.5) return 'amber';
  return 'none';
}

export interface ChargeResult {
  /** Time of the CC phase, min (total time if CV was never reached). */
  ccMinutes: number;
  /** SOC at the CC → CV switch, % (null if CV never reached). */
  socAtCvPct: number | null;
  totalMinutes: number;
  /** Time to reach 80 % SOC, min (null if never). */
  minutesTo80: number | null;
  /** Final SOC (may slightly exceed 100 % in the model; UI clamps). */
  finalSocPct: number;
  ah: number;
  /** Samples every 60 s plus the last point. */
  curve: (CellSample & { phase: 'CC' | 'CV' })[];
  plating: PlatingRisk;
  /** U_max above the chemistry limit (4.20 V NMC, 3.65 V LFP) → red «Перезаряд». */
  overcharge: boolean;
}

/**
 * CC/CV charge (§M3): CC at I = C·Q until OCV + I·R0 + v1 ≥ U_max, then CV with
 * I = clamp((U_max − OCV − v1)/R0, 0, I_cc), stop at I ≤ 0.05·Q. 48 h guard.
 */
export function chargeCcCv(
  cell: CellSpec,
  cRate: number,
  opts: { uMaxV?: number; tC?: number; soc0Pct?: number; iTermC?: number; dtS?: number } = {},
): ChargeResult {
  const uMax = opts.uMaxV ?? CELL_LIMITS[cell.chem].uMaxV;
  const tC = opts.tC ?? 25;
  const dt = opts.dtS ?? 1;
  const kr = resistanceFactor(tC);
  const r0 = cell.r0Ohm * kr;
  const r1 = cell.r1Ohm * kr;
  const c1 = cell.tau1S / cell.r1Ohm;
  const q = cell.capacityAh;
  const icc = cRate * q;
  const iTerm = (opts.iTermC ?? 0.05) * q;
  let soc = opts.soc0Pct ?? 0;
  let v1 = 0;
  let t = 0;
  let ah = 0;
  let phase: 'CC' | 'CV' = 'CC';
  let tCv: number | null = null;
  let socCv: number | null = null;
  let t80: number | null = null;
  let i = icc;
  let wh = 0;
  let heatJ = 0;
  const curve: ChargeResult['curve'] = [];
  for (;;) {
    if (phase === 'CC') {
      i = icc;
      const v = ocvV(cell.chem, soc) + i * r0 + v1;
      if (v >= uMax) {
        phase = 'CV';
        tCv = t;
        socCv = soc;
      }
    }
    if (phase === 'CV') {
      i = Math.max(0, Math.min((uMax - ocvV(cell.chem, soc) - v1) / r0, icc));
      if (i <= iTerm) break;
    }
    if (t % 60 === 0) {
      const ocv = ocvV(cell.chem, soc);
      curve.push({ timeS: t, ah, socPct: soc, voltageV: ocv + i * r0 + v1, ocvV: ocv, currentA: i, phase, wh, heatJ });
    }
    // running totals for the samples (M3): energy into the cell and the overpotential heat I·(U − U_OCV)
    const vNow = ocvV(cell.chem, soc) + i * r0 + v1;
    wh += (vNow * i * dt) / 3600;
    heatJ += i * (vNow - ocvV(cell.chem, soc)) * dt;
    v1 += dt * (i / c1 - v1 / (r1 * c1));
    soc += ((i * dt) / 3600 / q) * 100;
    ah += (i * dt) / 3600;
    t += dt;
    if (t80 === null && soc >= 80) t80 = t;
    if (t > 48 * 3600 || icc <= 0) break;
  }
  const ocvEnd = ocvV(cell.chem, soc);
  curve.push({ timeS: t, ah, socPct: soc, voltageV: ocvEnd + i * r0 + v1, ocvV: ocvEnd, currentA: i, phase, wh, heatJ });
  return {
    ccMinutes: (tCv ?? t) / 60,
    socAtCvPct: socCv,
    totalMinutes: t / 60,
    minutesTo80: t80 === null ? null : t80 / 60,
    finalSocPct: soc,
    ah,
    curve,
    plating: platingRisk(tC, cRate),
    overcharge: uMax > CELL_LIMITS[cell.chem].uMaxV + 1e-9,
  };
}

/* ------------------------------------------------ §M4 pack builder ----------------------------------------- */

export interface PackResult {
  series: number;
  parallel: number;
  uNomV: number;
  uMaxV: number;
  uMinV: number;
  capacityAh: number;
  energyKwh: number;
  iMaxA: number;
  pMaxKw: number;
  resistanceMOhm: number;
  /** Cells × 1.25 (housing, BMS, busbars), kg. */
  massKg: number;
  whPerKg: number;
  cells: number;
  /** Compatibility with the «ЛІ-6» battery port (40…60 V). */
  li6: Li6Compatibility;
}

export type Li6Compatibility =
  | { verdict: 'ok' }
  | { verdict: 'partial'; reason: 'discharge-stops-at-40V' }
  | { verdict: 'fail'; reason: 'overvoltage' | 'undervoltage' };

/** «ЛІ-6» battery window, V. */
export const LI6_BATTERY_WINDOW = { minV: 40, maxV: 60 } as const;

/**
 * Three-state compatibility (§M4): ok — U_min ≥ 40 ∧ U_max ≤ 60; partial — U_max ≤ 60 ∧ U_min < 40 ∧ U_nom ≥ 40;
 * fail — U_max > 60 (overvoltage) ∨ U_nom < 40 (undervoltage).
 */
export function li6Compatibility(uMinV: number, uNomV: number, uMaxV: number): Li6Compatibility {
  const eps = 1e-9;
  if (uMaxV > LI6_BATTERY_WINDOW.maxV + eps) return { verdict: 'fail', reason: 'overvoltage' };
  if (uNomV < LI6_BATTERY_WINDOW.minV - eps) return { verdict: 'fail', reason: 'undervoltage' };
  if (uMinV >= LI6_BATTERY_WINDOW.minV - eps) return { verdict: 'ok' };
  return { verdict: 'partial', reason: 'discharge-stops-at-40V' };
}

/** Pack sS·pP (§M4). */
export function buildPack(cell: CellSpec, series: number, parallel: number): PackResult {
  const s = Math.max(1, Math.round(series));
  const p = Math.max(1, Math.round(parallel));
  const lim = CELL_LIMITS[cell.chem];
  const uNom = s * lim.uNomV;
  const q = p * cell.capacityAh;
  const w = (uNom * q) / 1000;
  const iMax = p * cell.iMaxA;
  const m = 1.25 * s * p * cell.massKg;
  return {
    series: s,
    parallel: p,
    uNomV: uNom,
    uMaxV: s * lim.uMaxV,
    uMinV: s * lim.uMinV,
    capacityAh: q,
    energyKwh: w,
    iMaxA: iMax,
    pMaxKw: (uNom * iMax) / 1000,
    resistanceMOhm: (1000 * s * cell.r0Ohm) / p,
    massKg: m,
    whPerKg: (1000 * w) / m,
    cells: s * p,
    li6: li6Compatibility(s * lim.uMinV, uNom, s * lim.uMaxV),
  };
}

/* ------------------------------------------------ §M6 toy ageing ------------------------------------------- */

export const AGEING_COEFFS: Record<Chemistry, { a: number; b: number }> = {
  LFP: { a: 0.02, b: 0.029 },
  NMC: { a: 0.03, b: 0.118 },
};

export interface AgeingInput {
  chem: Chemistry;
  years: number;
  /**
   * Full equivalent cycles per year. The UI slider «циклів на рік» gives cycles of depth DoD:
   * use `fecPerYearFromCycles(n, dod)`; the document's control points give FEC/year directly.
   */
  fecPerYear: number;
  /** Depth of discharge, % (10…100). */
  dodPct: number;
  /** Temperature, °C (0…45). */
  tempC: number;
  /** Average SOC, % (20…100). */
  socAvgPct: number;
}

/** FEC/year = n_cycles_per_year·DoD/100. */
export function fecPerYearFromCycles(cyclesPerYear: number, dodPct: number): number {
  return (cyclesPerYear * dodPct) / 100;
}

/** Below this SOH the UI draws the curve dashed with the «поза межами моделі» chip. */
export const AGEING_MODEL_FLOOR = 0.6;

/**
 * SOH(t) = 1 − a·f_T·f_SOC·√t − b·√(DoD/100)·FEC/1000, f_T = 2^((T − 25)/10), f_SOC = 0.5 + SOC_avg/100,
 * clamped at 0 (illustrative model, §M6).
 */
export function stateOfHealth(x: AgeingInput): number {
  const { a, b } = AGEING_COEFFS[x.chem];
  const fT = 2 ** ((x.tempC - 25) / 10);
  const fSoc = 0.5 + x.socAvgPct / 100;
  const years = Math.max(0, x.years);
  const fec = x.fecPerYear * years;
  return Math.max(0, 1 - a * fT * fSoc * Math.sqrt(years) - (b * Math.sqrt(x.dodPct / 100) * fec) / 1000);
}

/** Years until SOH reaches `target` (bisection on the monotone SOH(t)); null if not within `maxYears`. */
export function yearsToSoh(x: Omit<AgeingInput, 'years'>, target = 0.8, maxYears = 60): number | null {
  if (stateOfHealth({ ...x, years: maxYears }) > target) return null;
  let lo = 0;
  let hi = maxYears;
  for (let k = 0; k < 60; k++) {
    const m = 0.5 * (lo + hi);
    if (stateOfHealth({ ...x, years: m }) > target) lo = m;
    else hi = m;
  }
  return 0.5 * (lo + hi);
}
