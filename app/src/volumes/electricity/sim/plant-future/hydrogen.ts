/**
 * `plant-future` M1 (PEMFC / SOFC polarisation curve, stack) and M2 (electricity → H₂ → electricity).
 * F = 96 485 C/mol, M(H₂) = 2.016 g/mol, LHV(H₂) = 33.3 kWh/kg.
 */

export interface CellCurveParams {
  uOc: number;
  a: number;
  i0: number;
  r: number;
  m: number;
  n: number;
}

export const PEMFC: CellCurveParams = { uOc: 0.98, a: 0.03, i0: 0.01, r: 0.15, m: 3e-4, n: 4.5 };
/** SOFC (qualitative); i₀ not given → same as PEMFC (see audit). */
export const SOFC: CellCurveParams = { uOc: 1.0, a: 0.01, i0: 0.01, r: 0.25, m: 1e-4, n: 4 };

/** LHV-equivalent voltage of H₂, V. */
export const U_LHV = 1.253;

export interface CellPoint {
  /** Current density, A/cm². */
  i: number;
  voltageV: number;
  /** Power density, W/cm². */
  powerWcm2: number;
  /** η = U/1.253 (LHV). */
  efficiency: number;
  activationV: number;
  ohmicV: number;
  concentrationV: number;
}

/** U(i) = U_oc − A·ln(1 + i/i₀) − r·i − m·e^(n·i), U ≥ 0. */
export function cellPoint(i: number, c: CellCurveParams = PEMFC): CellPoint {
  const act = c.a * Math.log(1 + i / c.i0);
  const ohm = c.r * i;
  const conc = c.m * Math.exp(c.n * i);
  const u = Math.max(0, c.uOc - act - ohm - conc);
  return {
    i,
    voltageV: u,
    powerWcm2: u * i,
    efficiency: u / U_LHV,
    activationV: act,
    ohmicV: ohm,
    concentrationV: conc,
  };
}

/** Maximum power density on 0…iMax (fine grid). */
export function maxPowerPoint(c: CellCurveParams = PEMFC, iMax = 1.6): CellPoint {
  let best = cellPoint(0, c);
  for (let k = 1; k <= 1600; k++) {
    const p = cellPoint((iMax * k) / 1600, c);
    if (p.powerWcm2 > best.powerWcm2) best = p;
  }
  return best;
}

/** Stack: U = N·U_cell, P = U·i·A_cell (A_cell 300 cm²). N 300, i 0.5 → 235 V, 35.3 kW. */
export function stack(nCells: number, i: number, areaCm2 = 300, c: CellCurveParams = PEMFC) {
  const p = cellPoint(i, c);
  const u = nCells * p.voltageV;
  const current = i * areaCm2;
  return {
    voltageV: u,
    currentA: current,
    powerW: u * current,
    cell: p,
    waterGPerS: (current * nCells * 18.015) / (2 * 96485),
  };
}

/* ------------------------------------------------ M2 ------------------------------------------------------ */

/** Charge per kg H₂: 1000/2.016·2·F/3.6e6 = 26.59 kAh (= kWh per volt). */
export const KAH_PER_KG = ((1000 / 2.016) * 2 * 96485) / 3.6e6;
export const H2_LHV_KWH_KG = 33.3;

export interface HydrogenLoop {
  electrolyserKwhPerKg: number;
  electrolyserEtaLhv: number;
  fuelCellKwhPerKg: number;
  roundTrip: number;
  /** Sankey per 100 kWh: into hydrogen (LHV), electrolysis loss, compressor share, fuel-cell electricity, fuel-cell loss. */
  sankey: {
    hydrogen: number;
    electrolysisLoss: number;
    compression: number;
    electricity: number;
    fuelCellLoss: number;
  };
}

/** e_el = 26.59·U_el; η_el = 33.3/e_el; η_rt = U_fc/U_el·(1 − c), c = 0.12 with compression to 700 bar. */
export function hydrogenLoop(uEl: number, uFc: number, compression = false): HydrogenLoop {
  const eEl = KAH_PER_KG * uEl;
  const etaEl = H2_LHV_KWH_KG / eEl;
  const c = compression ? 0.12 : 0;
  const rt = (uFc / uEl) * (1 - c);
  const h = 100 * etaEl;
  // Compressor share expressed at the fuel-cell output, so that hydrogen = electricity + compression + FC loss.
  const comp = (100 * c * uFc) / uEl;
  const el = 100 * rt;
  return {
    electrolyserKwhPerKg: eEl,
    electrolyserEtaLhv: etaEl,
    fuelCellKwhPerKg: KAH_PER_KG * uFc,
    roundTrip: rt,
    sankey: {
      hydrogen: h,
      electrolysisLoss: 100 - h,
      compression: comp,
      electricity: el,
      fuelCellLoss: h - el - comp,
    },
  };
}
