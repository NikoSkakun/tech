/**
 * PV module / string I-V model: single-diode, explicit V(I), no forward shunt, one bypass diode per section.
 *
 * Source: `lab-pv` §M1 (module «ЛМ-440», DECISIONS §13; oracle `tools/ref-models/C6-labs/pv_model.py`).
 * Per section k at irradiance G_k [W/m²] and cell temperature Tc [°C]:
 *   Vt = k·(Tc + 273.15)/q,  a = n·(Ns/n_sec)·Vt
 *   Iph_k = Isc·(G_k/1000)·(1 + α·(Tc − 25))
 *   Voc_sec = (Voc/n_sec)·(1 + β·(Tc − 25));  I0 = Isc·(1 + α·(Tc − 25)) / (exp(Voc_sec/a) − 1)
 *   V_k(I) = a·ln((Iph − I)/I0 + 1) − I·Rs/n_sec               (I < Iph)
 *   V_k(I) = −(I − Iph)·R_rev − I·Rs/n_sec                      (I ≥ Iph, reverse branch)
 *   bypass: V_k = max(V_k, −V_bp)
 * A string is the series sum of all sections of all modules (they share one current).
 */
import { bisect, goldenMax } from './num';

export const BOLTZMANN_J_PER_K = 1.380649e-23;
export const ELEMENTARY_CHARGE_C = 1.602176634e-19;

export interface PvModuleSpec {
  /** Short-circuit current at STC, A. */
  iscA: number;
  /** Open-circuit voltage at STC, V. */
  vocV: number;
  /** Datasheet MPP voltage/current at STC (the fitted model gives 33.06 V / 13.31 A). */
  vmpV: number;
  impA: number;
  /** Series-equivalent cells (108 half-cut cells = 2 parallel halves × 54). */
  ns: number;
  /** Bypass sections (one diode each). */
  nSections: number;
  /** Temperature coefficient of Isc, 1/°C. */
  alphaPerC: number;
  /** Temperature coefficient of Voc, 1/°C. */
  betaPerC: number;
  /** Temperature coefficient of Vmp, 1/°C (`lab-pv` §M4 β_mp). */
  betaMpPerC: number;
  /** Nominal module operating temperature, °C. */
  nmotC: number;
  areaM2: number;
  /** Diode ideality factor n. */
  ideality: number;
  /** Module series resistance, Ω (per section Rs/n_sec). */
  rsOhm: number;
  /** Reverse-branch resistance of one section, Ω. */
  rRevOhm: number;
  /** Bypass (Schottky) forward drop, V. */
  vBypassV: number;
}

/** Lab module «ЛМ-440» (`lab-pv` §M1, `_shared-house.md` §4). */
export const LM440: Readonly<PvModuleSpec> = Object.freeze({
  iscA: 13.9,
  vocV: 39.4,
  vmpV: 33.0,
  impA: 13.33,
  ns: 54,
  nSections: 3,
  alphaPerC: 0.00045,
  betaPerC: -0.0025,
  betaMpPerC: -0.0031,
  nmotC: 45,
  areaM2: 1.953,
  ideality: 1.0,
  rsOhm: 0.1477,
  rRevOhm: 540,
  vBypassV: 0.4,
});

/** Thermal voltage k·T/q, V. */
export function thermalVoltageV(tcC: number): number {
  return (BOLTZMANN_J_PER_K * (tcC + 273.15)) / ELEMENTARY_CHARGE_C;
}

/** Cell temperature from the NMOT model: Tc = Ta + (NMOT − 20)/800·G (`lab-pv` §M1, step 6). */
export function cellTemperatureC(ambientC: number, gWm2: number, spec: PvModuleSpec = LM440): number {
  return ambientC + ((spec.nmotC - 20) / 800) * gWm2;
}

export interface SectionParams {
  /** Photocurrent, A. */
  iphA: number;
  /** Saturation current, A. */
  i0A: number;
  /** Modified ideality voltage a = n·Ns_sec·Vt, V. */
  aV: number;
  /** Section series resistance, Ω. */
  rsOhm: number;
  rRevOhm: number;
  vBypassV: number;
}

/** Parameters of one bypass section at irradiance G [W/m²] and cell temperature Tc [°C]. */
export function sectionParams(gWm2: number, tcC: number, spec: PvModuleSpec = LM440): SectionParams {
  const g = Math.max(0, gWm2);
  const tFactor = 1 + spec.alphaPerC * (tcC - 25);
  const a = spec.ideality * (spec.ns / spec.nSections) * thermalVoltageV(tcC);
  const vocSec = (spec.vocV / spec.nSections) * (1 + spec.betaPerC * (tcC - 25));
  return {
    iphA: spec.iscA * (g / 1000) * tFactor,
    // I0(T) chosen so that V_oc at 1000 W/m² follows the datasheet β exactly (§M1).
    i0A: (spec.iscA * tFactor) / Math.expm1(vocSec / a),
    aV: a,
    rsOhm: spec.rsOhm / spec.nSections,
    rRevOhm: spec.rRevOhm,
    vBypassV: spec.vBypassV,
  };
}

/** Section voltage at current I (A). With `bypass`, the diode clamps it at −V_bp. */
export function sectionVoltageV(p: SectionParams, iA: number, bypass: boolean): number {
  let v: number;
  if (iA < p.iphA) v = p.aV * Math.log((p.iphA - iA) / p.i0A + 1) - iA * p.rsOhm;
  else v = -(iA - p.iphA) * p.rRevOhm - iA * p.rsOhm;
  return bypass ? Math.max(v, -p.vBypassV) : v;
}

export interface PvStringConfig {
  /**
   * Section irradiances per module, W/m²: `modules[m][k]`. A single module at uniform G is `[[G, G, G]]`.
   * All modules share one current (series string).
   */
  modules: readonly (readonly number[])[];
  /** Cell temperature, °C (−40…+90). */
  tcC: number;
  /** Bypass diodes present (default true). */
  bypass?: boolean;
  spec?: PvModuleSpec;
}

/** Convenience: a string of `nModules` identical modules at uniform irradiance. */
export function uniformString(gWm2: number, tcC: number, nModules = 1, bypass = true): PvStringConfig {
  return { modules: Array.from({ length: nModules }, () => [gWm2, gWm2, gWm2]), tcC, bypass };
}

export interface IvPoint {
  vV: number;
  iA: number;
  pW: number;
}

/**
 * Compiled string: section parameters are computed once; `voltageAt(I)` is then cheap enough to be called
 * thousands of times per frame (curve sweep, bisection, MPPT).
 */
export class PvString {
  readonly sections: SectionParams[];
  readonly bypass: boolean;
  /** Largest photocurrent of all sections — upper bound of the current sweep, A. */
  readonly iMaxA: number;
  /** Section count per module (to map flat section index → module). */
  readonly sectionsPerModule: number;

  constructor(cfg: PvStringConfig) {
    const spec = cfg.spec ?? LM440;
    this.bypass = cfg.bypass ?? true;
    this.sectionsPerModule = spec.nSections;
    this.sections = [];
    for (const m of cfg.modules) {
      for (let k = 0; k < spec.nSections; k++) this.sections.push(sectionParams(m[k] ?? 0, cfg.tcC, spec));
    }
    this.iMaxA = this.sections.reduce((mx, p) => Math.max(mx, p.iphA), 0);
  }

  /** String voltage at current I (A). */
  voltageAt(iA: number): number {
    let v = 0;
    for (const p of this.sections) v += sectionVoltageV(p, iA, this.bypass);
    return v;
  }

  /** Voltage of every section at current I (for hot-spot and diode visualisation). */
  sectionVoltagesAt(iA: number): number[] {
    return this.sections.map((p) => sectionVoltageV(p, iA, this.bypass));
  }

  /** Open-circuit voltage V(0), V. */
  vocV(): number {
    return this.iMaxA > 0 ? Math.max(0, this.voltageAt(0)) : 0;
  }

  /** Short-circuit current: root of V(I) = 0 (V(I) decreases monotonically), A. */
  iscA(): number {
    if (this.iMaxA <= 0) return 0;
    let hi = this.iMaxA;
    // In the no-bypass case the root may sit slightly above max(Iph) on the reverse branch.
    while (this.voltageAt(hi) > 0 && hi < 1e3) hi *= 1.05;
    return bisect((i) => this.voltageAt(i), 0, hi, 60);
  }

  /**
   * Operating point with a resistive load R (Ω): solve V(I) = I·R by bisection on [0, I_max] (§M1, step 5).
   */
  operatingPointR(rOhm: number): IvPoint {
    const r = Math.max(1e-6, rOhm);
    const hi = Math.max(this.iscA(), 1e-9);
    const i = bisect((x) => this.voltageAt(x) - x * r, 0, hi, 60);
    const v = this.voltageAt(i);
    return { vV: v, iA: i, pW: v * i };
  }

  /** Current at a given terminal voltage (inverse of V(I) by bisection), A; 0 above V_oc. */
  currentAtV(vV: number): number {
    if (this.iMaxA <= 0 || vV >= this.voltageAt(0)) return 0;
    const isc = this.iscA();
    if (vV <= 0) return isc;
    return bisect((i) => this.voltageAt(i) - vV, 0, isc, 60);
  }

  /**
   * I-V sweep by current: I_j = I_max·j/N, stop at the first V < 0 (§M1); the exact (0, Isc) point is appended
   * so the curve reaches the current axis. Points are ordered by increasing current (decreasing voltage).
   */
  curve(nPts = 400): IvPoint[] {
    const pts: IvPoint[] = [];
    if (this.iMaxA <= 0) return [{ vV: 0, iA: 0, pW: 0 }];
    for (let j = 0; j <= nPts; j++) {
      const i = (this.iMaxA * j) / nPts;
      const v = this.voltageAt(i);
      if (v < 0) break;
      pts.push({ vV: v, iA: i, pW: v * i });
    }
    const isc = this.iscA();
    if (pts.length === 0 || pts[pts.length - 1]!.iA < isc) pts.push({ vV: 0, iA: isc, pW: 0 });
    return pts;
  }

  /** Refine a discrete maximum of P(I) at index j of `curve` with a golden-section search. */
  private refine(pts: IvPoint[], j: number): IvPoint {
    const lo = pts[Math.max(0, j - 1)]!.iA;
    const hi = pts[Math.min(pts.length - 1, j + 1)]!.iA;
    const p = (i: number): number => i * this.voltageAt(i);
    const i = goldenMax(p, lo, hi, 50);
    const best = p(i) >= pts[j]!.pW ? i : pts[j]!.iA;
    const v = this.voltageAt(best);
    return { vV: v, iA: best, pW: v * best };
  }

  /** Global maximum power point (discrete sweep + local refinement). */
  mpp(nPts = 400): IvPoint {
    return this.analyse(nPts).mpp;
  }

  /** Full analysis used by the I-V / P-V charts. */
  analyse(nPts = 400): IvAnalysis {
    const pts = this.curve(nPts);
    let jBest = 0;
    for (let j = 1; j < pts.length; j++) if (pts[j]!.pW > pts[jBest]!.pW) jBest = j;
    const maxima: IvPoint[] = [];
    for (let j = 1; j < pts.length - 1; j++) {
      if (pts[j]!.pW > pts[j - 1]!.pW && pts[j]!.pW >= pts[j + 1]!.pW) maxima.push(this.refine(pts, j));
    }
    const mpp = pts.length > 2 ? this.refine(pts, jBest) : pts[jBest]!;
    // Sort local maxima by voltage ascending for the chart flags.
    maxima.sort((a, b) => a.vV - b.vV);
    return {
      points: pts,
      vocV: this.vocV(),
      iscA: this.iscA(),
      mpp,
      localMaxima: maxima.length ? maxima : [mpp],
      fillFactor: this.vocV() > 0 && this.iscA() > 0 ? mpp.pW / (this.vocV() * this.iscA()) : 0,
    };
  }
}

export interface IvAnalysis {
  /** Sweep points, ordered by increasing current. */
  points: IvPoint[];
  vocV: number;
  iscA: number;
  /** Global MPP. */
  mpp: IvPoint;
  /** All local maxima of P(V) (ascending V); includes the global one. */
  localMaxima: IvPoint[];
  fillFactor: number;
}

/** One-call helper: analyse a string configuration. */
export function analyseString(cfg: PvStringConfig, nPts = 400): IvAnalysis {
  return new PvString(cfg).analyse(nPts);
}

/* ------------------------------------------------------------------------------------------------------------
 * Half-cell shading (step 7). Layout of the 108 half-cells: 6 columns × 18 rows, index = row·6 + col,
 * row 0 at the top, col 0 at the left. Section k = columns 2k and 2k+1 over the full height, made of two
 * parallel branches of 18 half-cells: the top branch (rows 0…8) and the bottom branch (rows 9…17).
 * ---------------------------------------------------------------------------------------------------------- */

export const HALF_CELL_COLS = 6;
export const HALF_CELL_ROWS = 18;
export const HALF_CELLS = HALF_CELL_COLS * HALF_CELL_ROWS;

/** Section (0…2) and branch of a half-cell index. */
export function halfCellLocation(index: number): {
  section: number;
  branch: 'top' | 'bottom';
  row: number;
  col: number;
} {
  const row = Math.floor(index / HALF_CELL_COLS);
  const col = index % HALF_CELL_COLS;
  return { section: Math.floor(col / 2), branch: row < HALF_CELL_ROWS / 2 ? 'top' : 'bottom', row, col };
}

/**
 * Equivalent section irradiances from per-half-cell shade factors s ∈ [0, 1] (`lab-pv` §M1, step 7):
 * G_cell = G·(1 − s); a branch is limited by its weakest half-cell f = min(G_cell)/1000;
 * Iph_k = (Isc/2)·(f_top + f_bottom)·(…) ⇔ G_k = 1000·(f_top + f_bottom)/2.
 * (Simplified model: reverse bias inside a branch is not modelled, only current limitation.)
 */
export function sectionIrradianceFromShade(gWm2: number, shade: ArrayLike<number>): number[] {
  const minTop = [Infinity, Infinity, Infinity];
  const minBot = [Infinity, Infinity, Infinity];
  for (let idx = 0; idx < HALF_CELLS; idx++) {
    const s = Math.min(1, Math.max(0, shade[idx] ?? 0));
    const gc = gWm2 * (1 - s);
    const loc = halfCellLocation(idx);
    const arr = loc.branch === 'top' ? minTop : minBot;
    arr[loc.section] = Math.min(arr[loc.section]!, gc);
  }
  return [0, 1, 2].map((k) => (minTop[k]! + minBot[k]!) / 2);
}

/** Module outline (`_shared-house.md` §4): 1722 × 1134 mm, portrait. */
export const MODULE_SIZE_MM = { width: 1134, height: 1722 } as const;

/** Rectangle of half-cell `index` in module millimetres (x right, y down, origin top-left; cells tile the area). */
export function halfCellRectMm(index: number): { x0: number; y0: number; x1: number; y1: number } {
  const { row, col } = halfCellLocation(index);
  const w = MODULE_SIZE_MM.width / HALF_CELL_COLS;
  const h = MODULE_SIZE_MM.height / HALF_CELL_ROWS;
  return { x0: col * w, y0: row * h, x1: (col + 1) * w, y1: (row + 1) * h };
}

/** Point-in-polygon (even-odd rule). */
function insidePolygon(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface ShadowShape {
  /** Polygon in module millimetres (see `halfCellRectMm`). */
  polygon: readonly (readonly [number, number])[];
  /** Opacity 0…1 (leaf 1, chimney stripe 0.7, snow 1, bird 1). */
  opacity: number;
}

/**
 * Shade factor per half-cell = covered area fraction × opacity (step 7), estimated by 8×8 supersampling.
 * Overlapping shadows combine multiplicatively in transmitted light: s = 1 − Π(1 − s_i).
 */
export function shadeFromShapes(shapes: readonly ShadowShape[], samples = 8): Float64Array {
  const out = new Float64Array(HALF_CELLS);
  for (let idx = 0; idx < HALF_CELLS; idx++) {
    const r = halfCellRectMm(idx);
    let transmitted = 1;
    for (const sh of shapes) {
      let hit = 0;
      for (let a = 0; a < samples; a++) {
        for (let b = 0; b < samples; b++) {
          const x = r.x0 + ((a + 0.5) / samples) * (r.x1 - r.x0);
          const y = r.y0 + ((b + 0.5) / samples) * (r.y1 - r.y0);
          if (insidePolygon(x, y, sh.polygon)) hit++;
        }
      }
      transmitted *= 1 - (hit / (samples * samples)) * Math.min(1, Math.max(0, sh.opacity));
    }
    out[idx] = 1 - transmitted;
  }
  return out;
}

export interface HotSpot {
  /** Flat section index in the string. */
  section: number;
  /** Section voltage at the operating current (≤ 0 in reverse mode), V. */
  sectionVoltageV: number;
  /** Illustrative dissipation P_hot ≈ (17·0.6 V + |V_k|)·I/2, W (does not affect the curves). */
  pHotW: number;
  /** Brightness for display: P_hot clamped to 200 W («оцінка»). */
  displayW: number;
  /** `orange` when the bypass diode limits |V_k| to V_bp, `red` (pulsing) otherwise. */
  colour: 'orange' | 'red';
}

/**
 * Hot-spot visualisation (`lab-pv` §M1): a section is in reverse mode when V_k(I) ≤ 0 at the operating current.
 */
export function hotSpots(str: PvString, iA: number): HotSpot[] {
  const out: HotSpot[] = [];
  str.sectionVoltagesAt(iA).forEach((vk, k) => {
    if (vk <= 0 && iA > 0) {
      const p = ((17 * 0.6 + Math.abs(vk)) * iA) / 2;
      const bypassClamped = str.bypass && vk <= -str.sections[k]!.vBypassV + 1e-9;
      out.push({
        section: k,
        sectionVoltageV: vk,
        pHotW: p,
        displayW: Math.min(200, p),
        colour: bypassClamped ? 'orange' : 'red',
      });
    }
  });
  return out;
}

/** Module-level power optimisers (step 7): every module at its own MPP, P = Σ P_mp,i·η_opt, η_opt = 0.985. */
export function optimiserPowerW(cfg: PvStringConfig, etaOpt = 0.985): number {
  let p = 0;
  for (const m of cfg.modules) {
    p += new PvString({ ...cfg, modules: [m] }).mpp(300).pW;
  }
  return p * etaOpt;
}
