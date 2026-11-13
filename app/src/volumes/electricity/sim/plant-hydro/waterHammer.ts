/**
 * plant-hydro M3 (step 4) — water hammer. L = 300 m, v0 = 5 m/s, a = 1100 m/s, T_r = 2L/a = 0,545 s.
 *   T_c ≤ T_r: Δp = ρ·a·v0 (Joukowsky); else Δp ≈ ρ·a·v0·T_r/T_c = 2ρLv0/T_c (Michaud, linear closure)
 *   surge tank: Δp ×0,15 (effective length 45 of 300 m); gauge = ρ·g·H (H 80 m → 0,785 MPa) + Δp
 *   colours: > 2 MPa red, 0,5…2 amber, else green. Pulse (illustrative): rise to Δp over min(T_c, T_r), then damped
 *   oscillation with period 2·T_r and decay 2 s. Surge-tank level z(t) = 8 m·e^(−t/60)·sin(2πt/120).
 */
export const PENSTOCK = { lengthM: 300, v0: 5, waveSpeed: 1100, rho: 1000, g: 9.81, headM: 80, tankFactor: 0.15 } as const;
export const REFLECTION_S = (2 * PENSTOCK.lengthM) / PENSTOCK.waveSpeed;

export function surgePressureMPa(closureS: number, surgeTank: boolean): number {
  const p = PENSTOCK;
  const joukowsky = p.rho * p.waveSpeed * p.v0;
  const dp = closureS <= REFLECTION_S ? joukowsky : (2 * p.rho * p.lengthM * p.v0) / closureS;
  return (dp * (surgeTank ? p.tankFactor : 1)) / 1e6;
}

export function staticPressureMPa(): number {
  return (PENSTOCK.rho * PENSTOCK.g * PENSTOCK.headM) / 1e6;
}

export function surgeColour(dpMPa: number): 'red' | 'amber' | 'green' {
  return dpMPa > 2 ? 'red' : dpMPa >= 0.5 ? 'amber' : 'green';
}

/** Gauge reading [MPa] at t seconds after the closure started (illustrative pulse shape). */
export function gaugePressureMPa(closureS: number, surgeTank: boolean, tS: number): number {
  const dp = surgePressureMPa(closureS, surgeTank);
  const rise = Math.min(closureS, REFLECTION_S);
  if (tS <= 0) return staticPressureMPa();
  if (tS < rise) return staticPressureMPa() + (dp * tS) / rise;
  const tau = tS - rise;
  return staticPressureMPa() + dp * Math.exp(-tau / 2) * Math.cos((Math.PI * tau) / REFLECTION_S);
}

export function surgeTankLevelM(tS: number): number {
  return tS <= 0 ? 0 : 8 * Math.exp(-tS / 60) * Math.sin((2 * Math.PI * tS) / 120);
}
