import { describe, expect, it } from 'vitest';
import { createDispatcher, type DayReport } from '../dispatcher';

/**
 * grid §Б.6 «a player can beat the algorithm» (hard winter day): pump the PSH and charge the BESS at night with all
 * coal units at 300 MW, import 1000 MW and 10 gas units until `pumpUntilH`, then follow the auto-dispatcher's
 * suggestions. Guards the numbers quoted in grid.md §Б.6 (probe of X1-simdocs).
 */
function playHardDay(pumpUntilH: number): DayReport {
  const d = createDispatcher({ mode: 'hard', season: 'winter' }, false);
  while (!d.state.finished) {
    const min = d.state.step * 5;
    const s = d.suggestion();
    if (min < pumpUntilH * 60) {
      const imp = [...s.importScheduleMW];
      imp[Math.floor(min / 60)] = 1000;
      d.setControls({
        ...s,
        coalRun: s.coalRun.map(() => true),
        coalSetpointMW: s.coalSetpointMW.map(() => 300),
        importScheduleMW: imp,
        gasUnits: 10,
        pshMode: 'pump',
        pshSetpointMW: 1600,
        bessSetpointMW: -500,
        hydroSetpointMW: 0,
        queues: 0,
      });
    } else d.setControls(s);
    d.stepOnce();
  }
  return d.report();
}

describe('grid §Б.6 player strategy on the hard winter day', () => {
  it('pump until 03:00 → ENS 1953 MWh, no UFLS, 2★', () => {
    const r = playHardDay(3);
    expect(Math.round(r.ensMWh)).toBe(1953);
    expect(r.uflsEvents).toBe(0);
    expect(r.blackout).toBe(false);
    expect(r.stars).toBe(2);
  });

  it('pump until 04:00 → ENS 738 MWh, no UFLS, 2★ (beats the auto-dispatcher’s ≈ 8,2k MWh)', () => {
    const r = playHardDay(4);
    expect(Math.round(r.ensMWh)).toBe(738);
    expect(r.uflsEvents).toBe(0);
    expect(r.blackout).toBe(false);
    expect(r.stars).toBe(2);
    expect(r.ensMWh).toBeLessThan(createDispatcher({ mode: 'hard' }, true).runToEnd().ensMWh);
  });

  it('pump until 05:00 → the reservoir overfills, the surplus ends in a blackout (0★)', () => {
    const r = playHardDay(5);
    expect(r.blackout).toBe(true);
    expect(r.stars).toBe(0);
  });
});
