/**
 * distribution Р2 (step 2) — recloser scenario. Feeder: substation — 60 houses — recloser — 40 houses; the fault is
 * always beyond the recloser. Trip 0,05 s after the fault; reclose pauses 1, 5, 15 s; at most 3 reclosings.
 * Temporary fault («гілка») vanishes during the first pause → back in service at ≈ 1,05 s. Permanent («дерево»):
 * every reclose re-trips after 0,05 s; the 4th trip (≈ 21,2 s) locks out → 40 houses dark, 60 keep power.
 * Without recloser: the substation feeder breaker with one reclose (pause 1 s), then lockout → 100 houses dark.
 */

export const RECLOSER = { tripS: 0.05, pausesS: [1, 5, 15] as const, housesBefore: 60, housesAfter: 40 } as const;
export const SUBSTATION_PAUSES_S = [1] as const;

export interface RecloseEvent {
  timeS: number;
  kind: 'fault' | 'trip' | 'reclose' | 'lockout' | 'restored';
}

export interface RecloserResult {
  events: RecloseEvent[];
  reclosings: number;
  /** Houses without power after the sequence («довго без світла»). */
  housesDarkAtEnd: number;
  /** Houses that saw the short interruption(s). */
  housesBlinked: number;
  endTimeS: number;
}

export function runRecloser(fault: 'temporary' | 'permanent', withRecloser: boolean): RecloserResult {
  const pauses: readonly number[] = withRecloser ? RECLOSER.pausesS : SUBSTATION_PAUSES_S;
  const affected = withRecloser ? RECLOSER.housesAfter : RECLOSER.housesBefore + RECLOSER.housesAfter;
  const events: RecloseEvent[] = [{ timeS: 0, kind: 'fault' }];
  let t = RECLOSER.tripS;
  events.push({ timeS: t, kind: 'trip' });
  let n = 0;
  for (const pause of pauses) {
    t += pause;
    n++;
    events.push({ timeS: t, kind: 'reclose' });
    if (fault === 'temporary') {
      events.push({ timeS: t, kind: 'restored' });
      return { events, reclosings: n, housesDarkAtEnd: 0, housesBlinked: affected, endTimeS: t };
    }
    t += RECLOSER.tripS;
    events.push({ timeS: t, kind: 'trip' });
  }
  events.push({ timeS: t, kind: 'lockout' });
  return { events, reclosings: n, housesDarkAtEnd: affected, housesBlinked: affected, endTimeS: t };
}
