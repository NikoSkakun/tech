import { describe, expect, it } from 'vitest';
import { connectBlock, newBlackStartGame, playBlock, synchroniseThermal } from '../blackStart';
import { checkSynchronisation, createSynchroscope, phaseDifferenceDeg, synchroscopePeriodS, wrapDeg } from '../synchroscope';

// grid.md §А.5, tolerance ±0,02 Hz (time ±0,3 s)
describe('grid §А.5 black start — control points', () => {
  it.each([
    [1, 100, 10, 49.8, 1.2, 0, 0],
    [1, 100, 30, 49.39, 1.2, 0, 0],
    [1, 100, 40, 49.18, 1.2, 0, 0],
    [1, 100, 60, 48.81, 1.1, 1, 5],
    [1, 100, 100, 48.17, 1.1, 5, 37],
    [2, 200, 60, 49.44, 1.9, 0, 0],
    [2, 200, 100, 49.07, 1.9, 0, 0],
  ] as const)('stage %s, P_L0 %s MW, block %s MW', (stage, load, block, nadir, tN, stages, shed) => {
    const r = connectBlock(stage, load, block, 20, false);
    expect(Math.abs(r.nadirHz - nadir)).toBeLessThan(0.02);
    expect(Math.abs(r.nadirTimeS - tN)).toBeLessThan(0.3);
    expect(r.uflsStages).toBe(stages);
    expect(r.shedMW).toBeCloseTo(shed, 6);
  });

  it('result almost independent of P_L0: 190 MW + 40 MW (unclipped) → 49,19 Hz', () => {
    expect(Math.abs(connectBlock(1, 190, 40, 20, false).nadirHz - 49.19)).toBeLessThan(0.02);
  });

  it('the game clips a block to the stage limit (190 + 40 → 10 MW)', () => {
    expect(connectBlock(1, 190, 40).blockMW).toBe(10);
  });

  it('best possible game: 40 + 40 + 20, synchronise, 100 → 300 MW in 4 connections without UFLS', () => {
    let g = newBlackStartGame();
    for (const b of [40, 40, 20]) g = playBlock(g, b);
    expect(g.loadMW).toBe(200);
    expect(g.canSynchroniseThermal).toBe(true);
    g = synchroniseThermal(g);
    g = playBlock(g, 100);
    expect(g.finished).toBe(true);
    expect(g.connections).toBe(4);
    expect(g.uflsEvents).toBe(0);
  });

  it('UFLS keeps the island but sheds load: P_L0 += ΔP − P_shed', () => {
    const g = playBlock(newBlackStartGame(), 60);
    expect(g.uflsEvents).toBe(1);
    expect(g.loadMW).toBeCloseTo(155, 6);
  });
});

describe('grid step 12 synchroscope', () => {
  it('phase wraps to (−180°, 180°] and advances 360°·Δf·t', () => {
    expect(wrapDeg(190)).toBe(-170);
    expect(wrapDeg(-180)).toBe(180);
    expect(phaseDifferenceDeg(120, -0.2, 1)).toBeCloseTo(48, 9);
    expect(synchroscopePeriodS(0.04)).toBeCloseTo(25, 9);
    expect(synchroscopePeriodS(0)).toBe(Infinity);
  });

  it('closing criteria |Δf| ≤ 0,1 Hz, |Δφ| ≤ 10°, |ΔU| ≤ 0,05 p.u.', () => {
    expect(checkSynchronisation(50.03, 1.0, 5).ok).toBe(true);
    expect(checkSynchronisation(49.8, 0.96, 120).failures).toEqual(['frequency', 'phase']);
    expect(checkSynchronisation(50.03, 0.94, 0).failures).toEqual(['voltage']);
  });

  it('stateful synchroscope: start 49,80 Hz / 0,96 p.u. / 120°, tune and close near 12 o’clock', () => {
    const s = createSynchroscope();
    expect(s.close().ok).toBe(false);
    s.set({ islandFHz: 50.04, islandUPu: 1.0 });
    // Δφ: 120° + 360·0,04·t → 180 (= −180) after 4,17 s, 0 at 16,67 s
    for (let i = 0; i < 1000; i++) s.step(1 / 60);
    expect(Math.abs(s.state.deltaPhiDeg)).toBeLessThan(10);
    expect(s.close().ok).toBe(true);
    expect(s.state.closed).toBe(true);
  });
});
