import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
// the battery's print needs the loaded fonts; only its pose matters here
vi.mock('../battery', () => ({ createBattery: () => ({ group: new Group() }) }));

import { createClearance, type Clash } from './unfold-clear';

describe('the unfolding: no wire through a part (owner 2026-11-19)', () => {
  it('at every 0.005 of unfold, forwards, no wire piece enters a solid of the stand or the housing', () => {
    const { clashes } = createClearance();
    const all: Clash[] = [];
    for (let k = 0; k <= 200; k++) all.push(...clashes(k / 200));
    if (process.env.CLEAR_PRINT)
      for (const c of all)
        console.info(`${c.u.toFixed(3)} ${c.wire} ${c.solid} ${c.depth.toFixed(3)} @${c.at.toFixed(2)}`);
    expect(all.map((c) => `${c.u.toFixed(3)} ${c.wire} ${c.solid}`)).toEqual([]);
  });
});
