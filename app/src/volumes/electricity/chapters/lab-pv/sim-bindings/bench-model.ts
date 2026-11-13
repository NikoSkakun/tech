/**
 * The one model sample of the bench steps (5, 6, 7, 10): light, temperature, per-half-cell shade and the
 * operating point go in; the I-V analysis, the operating point, the section voltages, the branch currents and
 * the hot spots come out. The chart, the readouts and the 3D module all read this object, so numbers and
 * picture cannot disagree. Physics only from `@electricity/sim/lab-pv` (document §M1). No three.js here.
 */
import {
  HALF_CELLS,
  LM440,
  PvString,
  halfCellLocation,
  hotSpots,
  sectionIrradianceFromShade,
  type HotSpot,
  type IvAnalysis,
  type IvPoint,
} from '@electricity/sim/lab-pv';

/** How the operating point is chosen. */
export type Load =
  | { kind: 'resistor'; ohm: number }
  | { kind: 'voltage'; volt: number }
  | { kind: 'mpp' }
  | { kind: 'short' };

export interface BenchInput {
  /** Irradiance in the module plane, W/m². */
  g: number;
  /** Cell temperature, °C. */
  tc: number;
  /** Shade factor 0…1 per half-cell of the first module (document order: row × 6 + column), or null. */
  shade: ArrayLike<number> | null;
  bypass: boolean;
  /** Modules in the string (1 or 10); only the first one is shaded. */
  modules: number;
  load: Load;
}

export interface BenchSample {
  input: BenchInput;
  analysis: IvAnalysis;
  /** Operating point of the whole string. */
  op: IvPoint;
  /** Voltages of the three sections of the first module at the operating current, V. */
  sectionV: number[];
  /** Equivalent irradiance of the three sections of the first module, W/m². */
  sectionG: number[];
  /** Current of the six branches (section × top / bottom) as a share of a full branch (I_sc / 2), 0…1. */
  branch: number[];
  /** Current through the three bypass diodes as a share of I_sc, 0…1. */
  diode: number[];
  /** Hot spots among the sections of the first module (illustrative, document §M1). */
  hot: HotSpot[];
  /** Changes whenever the curve was recomputed (charts redraw only then). */
  curveVersion: number;
}

const POINTS = 300;

/** Light transmitted to the weakest half-cell of every branch (section × [top, bottom]), 0…1. */
function branchLight(shade: ArrayLike<number> | null): number[] {
  const f = [1, 1, 1, 1, 1, 1];
  if (!shade) return f;
  for (let i = 0; i < HALF_CELLS; i++) {
    const loc = halfCellLocation(i);
    const k = loc.section * 2 + (loc.branch === 'top' ? 0 : 1);
    f[k] = Math.min(f[k]!, 1 - Math.min(1, Math.max(0, shade[i] ?? 0)));
  }
  return f;
}

export function createBenchModel() {
  let key = '';
  let version = 0;
  let str: PvString | null = null;
  let analysis: IvAnalysis | null = null;
  let sectionG: number[] = [1000, 1000, 1000];
  let light: number[] = [1, 1, 1, 1, 1, 1];
  let shadeStamp = 0;

  return {
    /** Call when the content of the shade array changed (the array itself is not hashed). */
    touchShade(): void {
      shadeStamp++;
    },
    sample(input: BenchInput): BenchSample {
      const g = Math.max(0, input.g);
      const k = `${g.toFixed(1)}|${input.tc.toFixed(2)}|${input.bypass}|${input.modules}|${input.shade ? shadeStamp : -1}`;
      if (k !== key || !str || !analysis) {
        key = k;
        version++;
        const shade = input.shade ?? new Float64Array(HALF_CELLS);
        sectionG = sectionIrradianceFromShade(g, shade);
        light = branchLight(input.shade);
        const clear = [g, g, g];
        const modules = Array.from({ length: Math.max(1, input.modules) }, (_, m) => (m === 0 ? sectionG : clear));
        str = new PvString({ modules, tcC: input.tc, bypass: input.bypass });
        analysis = str.analyse(POINTS);
      }
      const load = input.load;
      let op: IvPoint;
      if (load.kind === 'resistor') op = str.operatingPointR(load.ohm);
      else if (load.kind === 'mpp') op = analysis.mpp;
      else {
        const v = load.kind === 'short' ? 0 : Math.min(Math.max(0, load.volt), analysis.vocV);
        const i = load.kind === 'short' ? analysis.iscA : str.currentAtV(v);
        op = { vV: v, iA: i, pW: v * i };
      }
      const sectionV = str.sectionVoltagesAt(op.iA).slice(0, 3);
      const iFull = LM440.iscA;
      const branch: number[] = [];
      const diode: number[] = [];
      for (let s = 0; s < 3; s++) {
        const top = light[s * 2]!;
        const bottom = light[s * 2 + 1]!;
        // photo-current of the section; what the string pushes beyond it goes through the diode (if any)
        const own = Math.min(op.iA, (iFull / 2) * (top + bottom) * (g / 1000));
        const sum = top + bottom || 1;
        branch.push(((own * top) / sum / (iFull / 2)) || 0, ((own * bottom) / sum / (iFull / 2)) || 0);
        const bypassed = input.bypass && sectionV[s]! <= -LM440.vBypassV + 1e-6;
        diode.push(bypassed ? Math.max(0, op.iA - own) / iFull : 0);
      }
      const hot = hotSpots(str, op.iA).filter((h) => h.section < 3);
      return { input, analysis, op, sectionV, sectionG, branch, diode, hot, curveVersion: version };
    },
  };
}
export type BenchModel = ReturnType<typeof createBenchModel>;

/** The darkest half-cell of the weakest branch of a section (where the hot spot is drawn), or −1. */
export function hotCellOf(section: number, shade: ArrayLike<number> | null): number {
  if (!shade) return -1;
  let worst = -1;
  let s = 0;
  for (let i = 0; i < HALF_CELLS; i++) {
    if (halfCellLocation(i).section === section && (shade[i] ?? 0) > s) {
      s = shade[i]!;
      worst = i;
    }
  }
  return worst;
}
