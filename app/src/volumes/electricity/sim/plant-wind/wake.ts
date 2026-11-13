/**
 * `plant-wind` M5 (step 8): Jensen wake with a Gaussian cross profile, quadratic superposition, 4 × 4 farm,
 * wake steering. Reviewed model: δ_ij = δ₀·exp(−(y − y_c)²/(2σ²)), σ = r_w/2, r_w = D/2 + k·x,
 * δ₀ = (1 − √(1 − C_T))·(D/(D + 2kx))², δ_j = √(Σ δ_ij²), v_j = v·(1 − δ_j).
 * Steering: all rows except the last downstream one yaw by γ = 20°; wake centre y_c = 0.25·x·tan γ;
 * a yawed turbine produces P·cos³γ.
 */
import { DEG } from '../core/S3-sim/num';
import { TURBINE_6MW, ratedSpeed, turbinePowerW, type TurbineSpec } from '../core/S3-sim/wind';

export const WAKE_K = { onshore: 0.075, offshore: 0.04 } as const;
export const STEER_YAW_DEG = 20;

/** Thrust coefficient: 0.8 below rated, 0.8·(v_r/v)² above. */
export function thrustCoefficient(vMs: number, t: TurbineSpec = TURBINE_6MW): number {
  const vr = ratedSpeed(t);
  return vMs > vr ? 0.8 * (vr / vMs) ** 2 : 0.8;
}

/** Velocity deficit at downstream distance x and lateral offset y from the wake centre line (all in metres). */
export function wakeDeficit(xM: number, yFromCentreM: number, dM: number, ct: number, k: number): number {
  if (xM <= 0) return 0;
  const rw = dM / 2 + k * xM;
  const d0 = (1 - Math.sqrt(Math.max(0, 1 - ct))) * (dM / (dM + 2 * k * xM)) ** 2;
  const sigma = rw / 2;
  return d0 * Math.exp(-(yFromCentreM ** 2) / (2 * sigma * sigma));
}

export interface FarmParams {
  /** Free-stream speed, m/s (default 8). */
  vMs: number;
  /** Direction the wind comes FROM, degrees (270 = from the west, along the rows). */
  windFromDeg: number;
  /** Row spacing along the 270° axis, in rotor diameters (3…12, default 7). */
  rowSpacingD: number;
  /** Spacing inside a row (cross-wind), in D (fixed 5). */
  inRowSpacingD: number;
  k: number;
  steering: boolean;
  rows: number;
  perRow: number;
  turbine: TurbineSpec;
}

export const FARM_DEFAULTS: FarmParams = {
  vMs: 8,
  windFromDeg: 270,
  rowSpacingD: 7,
  inRowSpacingD: 5,
  k: WAKE_K.onshore,
  steering: false,
  rows: 4,
  perRow: 4,
  turbine: TURBINE_6MW,
};

export interface FarmTurbine {
  /** Layout position, m: east (x) and north (y). */
  eastM: number;
  northM: number;
  row: number;
  inflowMs: number;
  powerW: number;
  yawed: boolean;
  /** Wake centre deflection angle used for drawing, degrees (0 or ±20). */
  yawDeg: number;
}

export interface FarmResult {
  turbines: FarmTurbine[];
  totalW: number;
  /** η_farm = ΣP_j/(N·P(v)). */
  efficiency: number;
}

/** 4 × 4 farm: rows are columns along east (spacing s·D), turbines in a row along north (5·D). */
export function simulateFarm(p: Partial<FarmParams> = {}): FarmResult {
  const q: FarmParams = { ...FARM_DEFAULTS, ...p };
  const D = q.turbine.diameterM;
  // Unit vector of the flow (towards which the wind blows): from 270° → towards east (+x).
  const th = q.windFromDeg * DEG;
  const fx = -Math.sin(th);
  const fy = -Math.cos(th);
  const pos: { e: number; n: number; row: number }[] = [];
  for (let r = 0; r < q.rows; r++)
    for (let c = 0; c < q.perRow; c++)
      pos.push({ e: r * q.rowSpacingD * D, n: c * q.inRowSpacingD * D, row: r });
  // Downstream coordinate and cross-wind coordinate (left of the flow positive).
  const along = pos.map((s) => s.e * fx + s.n * fy);
  const cross = pos.map((s) => -s.e * fy + s.n * fx);
  const maxAlong = Math.max(...along);
  const order = pos.map((_, i) => i).sort((a, b) => along[a]! - along[b]!);
  const inflow = new Array<number>(pos.length).fill(q.vMs);
  const yawed = pos.map((_, i) => q.steering && along[i]! < maxAlong - 1e-6);
  for (const j of order) {
    let s2 = 0;
    for (const i of order) {
      const x = along[j]! - along[i]!;
      if (x <= 1e-6) continue;
      const yc = yawed[i] ? 0.25 * x * Math.tan(STEER_YAW_DEG * DEG) : 0;
      const d = wakeDeficit(x, cross[j]! - cross[i]! - yc, D, thrustCoefficient(inflow[i]!, q.turbine), q.k);
      s2 += d * d;
    }
    inflow[j] = q.vMs * (1 - Math.sqrt(s2));
  }
  const cos3 = Math.cos(STEER_YAW_DEG * DEG) ** 3;
  const turbines: FarmTurbine[] = pos.map((s, i) => ({
    eastM: s.e,
    northM: s.n,
    row: s.row,
    inflowMs: inflow[i]!,
    powerW: turbinePowerW(q.turbine, inflow[i]!) * (yawed[i] ? cos3 : 1),
    yawed: yawed[i]!,
    yawDeg: yawed[i] ? STEER_YAW_DEG : 0,
  }));
  const total = turbines.reduce((a, t) => a + t.powerW, 0);
  const single = turbinePowerW(q.turbine, q.vMs);
  return { turbines, totalW: total, efficiency: single > 0 ? total / (pos.length * single) : 0 };
}
