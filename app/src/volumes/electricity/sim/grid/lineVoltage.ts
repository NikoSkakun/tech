/**
 * grid §В «Напруга лінії» (step 7): 330 kV, 200 km line, short-line drop with half of the line charging power lumped
 * at the receiving end and compensation devices at the city substation.
 *   R = 6 Ω, X = 64 Ω (200 km × 0,03 / 0,32 Ω/km); Q_C/2 = ½·U²·b·l (b = 3,5 μS/km susceptance) ≈ 38 Mvar
 *   Q_net = Q_load − Q_C/2 − Q_cap − Q_STATCOM + Q_reactor;   U_r = U_s − (R·P + X·Q_net)/U_s
 *   STATCOM (auto): Q = clamp(Q_load − Q_C/2 − Q_cap + Q_reactor + R·P/X, −200, +200) → U_r ≈ U_s
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';
import { shortLineReceivingKV } from '@electricity/sim/core/S2-sim/voltageDrop';

export const LINE_330 = {
  sendingKV: 330,
  lengthKm: 200,
  rOhmPerKm: 0.03,
  xOhmPerKm: 0.32,
  bSiemensPerKm: 3.5e-6,
  capacitorMvar: 150,
  reactorMvar: 100,
  statcomMvar: 200,
} as const;

export interface LineVoltageParams {
  /** P 0…600 MW (default 400; «Ніч» sets 100). */
  pMW: number;
  /** Q of the load 0…300 Mvar (default 150; «Ніч» sets 30). */
  qLoadMvar: number;
  capacitor: boolean;
  reactor: boolean;
  statcom: boolean;
}

export const LINE_VOLTAGE_DEFAULTS: LineVoltageParams = { pMW: 400, qLoadMvar: 150, capacitor: false, reactor: false, statcom: false };
export const NIGHT_PRESET = { pMW: 100, qLoadMvar: 30 } as const;

export type VoltageZone = 'collapse-risk' | 'low' | 'normal' | 'high' | 'trip';

export interface LineVoltageResult {
  receivingKV: number;
  receivingPu: number;
  /** Half the line charging power [Mvar]. */
  halfChargingMvar: number;
  statcomMvar: number;
  netReactiveMvar: number;
  /** < 0,90 p.u. red «загроза лавини напруги»; < 0,95 blue; 0,95…1,05 green; > 1,05 coral; > 1,10 → line trips. */
  zone: VoltageZone;
  lineTripped: boolean;
  /** Approximate active loss 3·I²·R = (P² + Q²)·R/U² [MW]. */
  lossMW: number;
}

export function halfChargingMvar(): number {
  const L = LINE_330;
  return 0.5 * L.sendingKV ** 2 * L.bSiemensPerKm * L.lengthKm;
}

export function voltageZone(pu: number): VoltageZone {
  if (pu > 1.1) return 'trip';
  if (pu > 1.05) return 'high';
  if (pu >= 0.95) return 'normal';
  if (pu >= 0.9) return 'low';
  return 'collapse-risk';
}

export function solveLineVoltage(input: Partial<LineVoltageParams> = {}): LineVoltageResult {
  const p = { ...LINE_VOLTAGE_DEFAULTS, ...input };
  const L = LINE_330;
  const R = L.rOhmPerKm * L.lengthKm;
  const X = L.xOhmPerKm * L.lengthKm;
  const P = clamp(p.pMW, 0, 600);
  const Q = clamp(p.qLoadMvar, 0, 300);
  const qc2 = halfChargingMvar();
  const qCap = p.capacitor ? L.capacitorMvar : 0;
  const qReac = p.reactor ? L.reactorMvar : 0;
  const qSt = p.statcom ? clamp(Q - qc2 - qCap + qReac + (R * P) / X, -L.statcomMvar, L.statcomMvar) : 0;
  const qNet = Q - qc2 - qCap - qSt + qReac;
  const ur = shortLineReceivingKV(L.sendingKV, R, X, P, qNet);
  const pu = ur / L.sendingKV;
  const zone = voltageZone(pu);
  return {
    receivingKV: ur,
    receivingPu: pu,
    halfChargingMvar: qc2,
    statcomMvar: qSt,
    netReactiveMvar: qNet,
    zone,
    lineTripped: zone === 'trip',
    lossMW: ((P * P + qNet * qNet) * R) / (L.sendingKV * L.sendingKV),
  };
}
