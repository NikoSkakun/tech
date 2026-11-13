/**
 * transmission step 8 mini-game «Виведи лінію в ремонт» — switching sequence with interlocking.
 * Take out: (1) open breaker, (2) open line disconnector, (3) open bus disconnector, (4) close earthing switch.
 * Put back: (1) open earthing, (2) close bus disconnector, (3) close line disconnector, (4) close breaker.
 * Errors: operating a disconnector while the breaker is closed («роз'єднувач під навантаженням» → arc), closing the
 * breaker or a disconnector onto the earthing switch («увімкнення на заземлення» → short circuit), earthing a live
 * line. With interlocking on, a dangerous action is refused (`blocked`) instead of failing.
 */

export type Apparatus = 'breaker' | 'lineDisconnector' | 'busDisconnector' | 'earthing';

export interface SwitchgearState {
  breaker: boolean;
  lineDisconnector: boolean;
  busDisconnector: boolean;
  earthing: boolean;
}

/** Initial state: line in service. */
export const IN_SERVICE: SwitchgearState = { breaker: true, lineDisconnector: true, busDisconnector: true, earthing: false };
export const IN_REPAIR: SwitchgearState = { breaker: false, lineDisconnector: false, busDisconnector: false, earthing: true };

export type ActionOutcome = 'ok' | 'blocked' | 'arcOnDisconnector' | 'closeOntoEarth' | 'earthLiveLine';

/** Line energised from the bus: breaker and both disconnectors closed. */
const energised = (s: SwitchgearState) => s.breaker && s.lineDisconnector && s.busDisconnector;

function danger(s: SwitchgearState, a: Apparatus): ActionOutcome {
  const closing = !s[a];
  if ((a === 'lineDisconnector' || a === 'busDisconnector') && s.breaker) return 'arcOnDisconnector';
  if (closing && a !== 'earthing' && s.earthing) return 'closeOntoEarth';
  if (closing && a === 'earthing' && (s.lineDisconnector || s.breaker)) return 'earthLiveLine';
  return 'ok';
}

/** Toggle one apparatus. On a dangerous action without interlocking the protection trips and the game resets. */
export function operate(
  s: SwitchgearState,
  a: Apparatus,
  interlocking: boolean,
): { state: SwitchgearState; outcome: ActionOutcome } {
  const d = danger(s, a);
  if (d === 'ok') return { state: { ...s, [a]: !s[a] }, outcome: 'ok' };
  if (interlocking) return { state: s, outcome: 'blocked' };
  return { state: IN_SERVICE, outcome: d };
}

export function isInRepair(s: SwitchgearState): boolean {
  return !s.breaker && !s.lineDisconnector && !s.busDisconnector && s.earthing;
}

export function isInService(s: SwitchgearState): boolean {
  return energised(s) && !s.earthing;
}
