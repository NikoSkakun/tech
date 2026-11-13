/**
 * The bench set of steps 1, 6 and 7 (opened inverter, sources, socket) as one shared object with its two stage
 * parameters: `coverOpen` (0 closed … 1 lifted) and `xray` (0 solid … 1 only the current paths). Every step
 * that shows it states both; a step drives the inverter's handles only while it is the current one.
 */
import type { Actor, Param } from '@/engine/api';
import type { Lab } from '../chapter';
import { createBenchSet, type BenchSet } from '../parts/bench-set';

export interface SharedBench extends BenchSet {
  actor: Actor;
  open: Param;
  xray: Param;
  /** Baseline look of the living inverter for the frame: wires, switch outlines, LEDs (steps then override). */
  idle(t: number, power: number): void;
  /** The two mini-scopes and their tags belong to the overview (step 1); close-ups put them away. */
  showScopes(on: boolean): void;
}

export function sharedBench(lab: Lab): SharedBench {
  return lab.share('bench', () => {
    const set = createBenchSet();
    lab.stageRoot.add(set.group);
    const { stage } = lab.ctx;
    const { inv } = set;
    const pose = { open: 0, away: 0 };
    const open = stage.param('coverOpen', 0, {
      duration: 1.8,
      ease: 'power2.inOut',
      onChange: (v) => inv.setOpen((pose.open = v), pose.away),
    });
    // close-ups (steps 6, 7) park the lifted cover far behind the bench
    const away = stage.param('coverAway', 0, {
      duration: 1.4,
      ease: 'power2.inOut',
      onChange: (v) => inv.setOpen(pose.open, (pose.away = v)),
    });
    void away;
    const xray = stage.param('xray', 0, { duration: 0.8, onChange: (v) => (inv.xray.amount = v) });
    inv.setOpen(0);
    return {
      ...set,
      actor: stage.actor(set.group),
      open,
      xray,
      showScopes(on) {
        for (const o of [set.dcScope, set.acScope, set.tags.dc, set.tags.ac]) o.visible = on;
      },
      idle(t, power) {
        // slow-motion mains: the diagonal pairs S1+S4 / S3+S2 swap every half period (0.5 Hz on screen) and
        // "chatter" inside it the way pulse-width modulation does
        const positive = Math.sin(t * Math.PI) >= 0;
        const chop = Math.sin(t * 46) > -0.35 ? 1 : 0.25;
        inv.switches.forEach((m, i) => {
          const on = positive ? i === 0 || i === 3 : i === 1 || i === 2;
          m.intensity = on ? 1.7 * chop * Math.min(1, power + 0.2) : 0.06;
        });
        inv.boost.intensity = Math.sin(t * 38) > 0.2 ? 1.5 : 0.1;
        inv.dcdc.intensity = Math.sin(t * 31) > 0 ? 1.2 : 0.1;
        for (const name of ['pvA', 'pvB', 'link', 'out'] as const) inv.wires[name].material.power = power;
        inv.wires.backup.material.power = power * 0.5;
        inv.wires.bat.material.power = power * 0.6;
        inv.shimmer.intensity = 0.45 * power;
        inv.leds.grid.intensity = 1.7;
        inv.leds.pv.intensity = 1.3 + 0.4 * Math.sin(t * 2.2);
        inv.leds.bat.intensity = 1.3 + 0.4 * Math.sin(t * 1.4 + 1);
      },
    };
  });
}
