/**
 * transmission ЛЕП-3 (step 6): charging current of an AC cable vs. overhead line, 220 kV.
 *   I_C = (U/√3)·ω·C₀·l;  I_useful = √(max(0, I_rated² − I_C²));  l_crit = I_rated/((U/√3)·ω·C₀)
 * C₀ = 0,2 μF/km (cable) or 0,009 μF/km (overhead), ω = 314,16 rad/s, I_rated = 1000 A. All charging current is
 * assumed to flow from one end; with reactors at both ends the worst current halves and l_crit doubles (hint).
 */

export const CABLE = { voltageV: 220e3, omega: 314.16, ratedA: 1000, c0CableFPerKm: 0.2e-6, c0OverheadFPerKm: 0.009e-6 } as const;

export interface ChargingResult {
  chargingA: number;
  usefulA: number;
  criticalLengthKm: number;
  /** l ≥ l_crit: «Кабель „з'їдає“ сам себе». */
  exhausted: boolean;
}

/** `dc` = true: no charging current in steady state (only a short pulse at switch-on). */
export function chargingCurrent(lengthKm: number, kind: 'cable' | 'overhead', dc = false, reactorsBothEnds = false): ChargingResult {
  const c0 = kind === 'cable' ? CABLE.c0CableFPerKm : CABLE.c0OverheadFPerKm;
  const perKm = ((CABLE.voltageV / Math.sqrt(3)) * CABLE.omega * c0) / (reactorsBothEnds ? 2 : 1);
  const ic = dc ? 0 : perKm * Math.max(0, lengthKm);
  const critical = CABLE.ratedA / perKm;
  return {
    chargingA: ic,
    usefulA: Math.sqrt(Math.max(0, CABLE.ratedA ** 2 - ic ** 2)),
    criticalLengthKm: critical,
    exhausted: !dc && ic >= CABLE.ratedA,
  };
}
