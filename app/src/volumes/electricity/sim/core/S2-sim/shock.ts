/**
 * Effects of AC current through the body — schematic approximation of IEC 60479-1 (home.md §В; not for engineering).
 *  AC-1: I ≤ 0,5 mA; AC-2: I ≤ I_b(t); AC-3: I_b(t) < I ≤ I_c1(t); AC-4: I > I_c1(t)
 *  I_b(t) = max(5 mA; 200 mA·(t/0,01 s)^(−0,565)) for t ≥ 0,01 s (200 mA below), exponent ln(200/10)/ln(2/0,01)
 *  I_c1(t): log-log interpolation through (0,01 s; 500 mA) (0,1; 400) (0,5; 100) (1; 50) (3; 40), then 40 mA.
 */

export type ShockZone = 'AC-1' | 'AC-2' | 'AC-3' | 'AC-4';

export const IB_EXPONENT = Math.log(200 / 10) / Math.log(2 / 0.01);
const C1_T = [0.01, 0.1, 0.5, 1, 3];
const C1_I = [0.5, 0.4, 0.1, 0.05, 0.04];

/** Curve b [A]. */
export function curveIbA(timeS: number): number {
  if (timeS < 0.01) return 0.2;
  return Math.max(0.005, 0.2 * (timeS / 0.01) ** -IB_EXPONENT);
}

/** Curve c1 [A] (log-log interpolation; held constant outside the points). */
export function curveIc1A(timeS: number): number {
  if (timeS <= C1_T[0]!) return C1_I[0]!;
  if (timeS >= C1_T[C1_T.length - 1]!) return C1_I[C1_I.length - 1]!;
  let i = 0;
  while (timeS > C1_T[i + 1]!) i++;
  const f = Math.log(timeS / C1_T[i]!) / Math.log(C1_T[i + 1]! / C1_T[i]!);
  return Math.exp(Math.log(C1_I[i]!) + f * Math.log(C1_I[i + 1]! / C1_I[i]!));
}

export function shockZone(currentA: number, timeS: number): ShockZone {
  if (currentA <= 0.0005) return 'AC-1';
  if (currentA <= curveIbA(timeS)) return 'AC-2';
  if (currentA <= curveIc1A(timeS)) return 'AC-3';
  return 'AC-4';
}

/** Time [s] at which a constant current crosses curve c1 into AC-4 (0 if already, Infinity if never). */
export function timeToFibrillationZoneS(currentA: number): number {
  if (currentA > C1_I[0]!) return 0;
  if (currentA <= C1_I[C1_I.length - 1]!) return Infinity;
  for (let i = 0; i < C1_T.length - 1; i++) {
    const a = C1_I[i]!;
    const b = C1_I[i + 1]!;
    if (currentA <= a && currentA > b) {
      const f = Math.log(currentA / a) / Math.log(b / a);
      return C1_T[i]! * (C1_T[i + 1]! / C1_T[i]!) ** f;
    }
  }
  return Infinity;
}

/** «Не може відпустити» (let-go threshold) at 10 mA. */
export const LET_GO_A = 0.01;
