/**
 * transmission ЛЕП-5 (step 9) — scenario timeline of protection and auto-reclosing (АПВ), 330 kV.
 * t₀ = 0 fault; relay command 25 ms; arc extinguished / breaker open 70 ms; reclose at 70 ms + t_AR
 * (t_AR 0,1…3 s, default 0,8). Temporary fault: success if t_AR ≥ 0,3 s (arc channel de-ionisation), otherwise the
 * fault re-strikes and the breaker opens for good 70 ms later. Permanent fault: re-trip 70 ms after reclosing, lockout.
 * Lightning into a phase: without surge arrester ≈ 1,5 MV reaches the transformer (BIL ≈ 1,0–1,2 MV) → breakdown;
 * with arrester ≈ 750 kV (2,5–2,8 × 363·√2/√3 ≈ 296 kV).
 */

export const AR = { relayS: 0.025, openS: 0.07, deionisationS: 0.3, faultKA: 10, loadKA: 0.5 } as const;
export type FaultScenario = 'lightningShield' | 'lightningPhase' | 'temporary' | 'permanent';

export interface TimelineEvent {
  timeS: number;
  kind: 'fault' | 'relay' | 'open' | 'reclose' | 'refault' | 'lockout' | 'restored' | 'shieldWire' | 'surge' | 'breakdown';
}

export interface ArResult {
  events: TimelineEvent[];
  /** Line in service at the end. */
  inService: boolean;
  /** Transformer damaged (lightning into a phase without arrester). */
  transformerDamaged: boolean;
  /** Overvoltage reaching the transformer [kV] (lightning into a phase). */
  surgeKV: number | null;
}

export const SURGE = { withoutArresterKV: 1500, withArresterKV: 750, transformerBilKV: [1000, 1200] as const } as const;

export function runAutoReclose(scenario: FaultScenario, reclosePauseS = 0.8, arrester = true): ArResult {
  const tAr = Math.min(3, Math.max(0.1, reclosePauseS));
  if (scenario === 'lightningShield') {
    return { events: [{ timeS: 0, kind: 'shieldWire' }], inService: true, transformerDamaged: false, surgeKV: null };
  }
  if (scenario === 'lightningPhase') {
    const surge = arrester ? SURGE.withArresterKV : SURGE.withoutArresterKV;
    const damaged = surge > SURGE.transformerBilKV[0];
    const events: TimelineEvent[] = [{ timeS: 0, kind: 'surge' }];
    if (damaged) events.push({ timeS: 0, kind: 'breakdown' });
    return { events, inService: !damaged, transformerDamaged: damaged, surgeKV: surge };
  }
  const tReclose = AR.openS + tAr;
  const events: TimelineEvent[] = [
    { timeS: 0, kind: 'fault' },
    { timeS: AR.relayS, kind: 'relay' },
    { timeS: AR.openS, kind: 'open' },
    { timeS: tReclose, kind: 'reclose' },
  ];
  const success = scenario === 'temporary' && tAr >= AR.deionisationS - 1e-9;
  if (success) {
    events.push({ timeS: tReclose, kind: 'restored' });
  } else {
    events.push({ timeS: tReclose, kind: 'refault' }, { timeS: tReclose + AR.openS, kind: 'lockout' });
  }
  return { events, inService: success, transformerDamaged: false, surgeKV: null };
}

/** Ammeter reading [kA] at time t of the timeline (fault current while the fault is fed). */
export function lineCurrentKA(r: ArResult, timeS: number): number {
  let current: number = AR.loadKA;
  for (const e of r.events) {
    if (e.timeS > timeS) break;
    if (e.kind === 'fault' || e.kind === 'refault') current = AR.faultKA;
    if (e.kind === 'open' || e.kind === 'lockout') current = 0;
    if (e.kind === 'restored') current = AR.loadKA;
  }
  return current;
}
