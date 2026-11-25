import { describe, expect, it } from 'vitest';
import { CORE_STAGES } from '@circuit/shared/copper/layout';
import { LEG, STAND_GONE, floorAt, floorValue, legsBetween, mixAt } from '../levels';

describe('composed world: deep → what is drawn', () => {
  it('shows only the stand on the stand and only copper below «жила»', () => {
    expect(mixAt(0)).toMatchObject({ standShown: true, copperShown: false, below: false, standDive: 0 });
    expect(mixAt(2)).toMatchObject({ standShown: false, copperShown: true, below: true, copperDepth: 1 });
    expect(mixAt(3).copperDepth).toBe(2);
  });

  it('dissolves on the last stretch of the ring leg, with both worlds drawn', () => {
    const mid = mixAt(0.9);
    expect(mid.standShown && mid.copperShown).toBe(true);
    expect(mid.copperIn).toBeGreaterThan(0);
    expect(mid.copperIn).toBeLessThan(1);
    expect(mixAt(1).copperIn).toBe(1);
    expect(mixAt(0.79).copperShown).toBe(false);
  });

  it('lets the stand go once the dome has closed and before the core pushes its depth back (F-lens-wire)', () => {
    expect(STAND_GONE).toBeGreaterThan(1 + CORE_STAGES.dome[1]);
    expect(STAND_GONE).toBeLessThan(1 + CORE_STAGES.balls[0]);
    expect(mixAt(1 + CORE_STAGES.dome[1]).standShown).toBe(true);
    expect(mixAt(1 + CORE_STAGES.balls[0]).standShown).toBe(false);
  });

  it('maps deep to the volume axis floors', () => {
    expect(floorValue(0)).toBe(3);
    expect(floorValue(2)).toBe(1);
    expect(floorAt(0.4)).toBe('stand');
    expect(floorAt(1.6)).toBe('rows');
    expect(floorAt(3)).toBe('atom');
  });
});

describe('composed world: flight legs', () => {
  it('flies one leg per floor, the ring leg first', () => {
    expect(legsBetween(0, 2)).toEqual([
      { to: 1, duration: LEG.ring },
      { to: 2, duration: LEG.floor },
    ]);
    expect(legsBetween(2, 0)).toEqual([
      { to: 1, duration: LEG.floor },
      { to: 0, duration: LEG.ring },
    ]);
  });

  it('ends a leg started between stops at the next stop, shorter', () => {
    const legs = legsBetween(1.5, 2);
    expect(legs).toHaveLength(1);
    expect(legs[0]!.to).toBe(2);
    expect(legs[0]!.duration).toBeLessThan(LEG.floor);
  });

  it('does not fly when already there', () => {
    expect(legsBetween(2, 2)).toEqual([]);
  });
});
