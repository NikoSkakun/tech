import { describe, expect, it } from 'vitest';
import { FLOW, PLANT_TYPE, SEMANTIC, UI_STATUS, col, hex, type ColorToken } from '../palette';

describe('palette tokens', () => {
  it('resolves the named groups to their palette colours', () => {
    expect(hex('plantType.wind')).toBe(hex('teal'));
    expect(hex('plantType.coal')).toBe(hex('slate'));
    expect(hex('ui.warning')).toBe(hex('amber'));
    expect(hex('flow.reactive')).toBe(hex('sky'));
    expect(hex(SEMANTIC.bandGap)).toBe(hex('bg.deep'));
  });

  it('every group alias and semantic name is a valid token', () => {
    const groups = { plantType: PLANT_TYPE, ui: UI_STATUS, flow: FLOW };
    for (const [g, map] of Object.entries(groups))
      for (const [k, v] of Object.entries(map)) expect(hex(`${g}.${k}` as ColorToken)).toBe(hex(v));
    // an unknown token would fall through to THREE's CSS parser and come back black
    for (const v of Object.values(SEMANTIC)) expect(col(v).getHex()).not.toBe(0);
  });

  it('returns a fresh colour for group tokens (mutating it does not poison the cache)', () => {
    col('plantType.solar').setRGB(0, 0, 0);
    expect(hex('plantType.solar')).toBe(hex('amber'));
  });
});
