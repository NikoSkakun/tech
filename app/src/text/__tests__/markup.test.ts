import { describe, expect, it } from 'vitest';
import { mathMarkup, richRuns } from '../markup';
import { NBSP, parseRich } from '../rich';

/** What the SDF Label did before `richRuns` existed (its private pre-pass) — the runs must not change. */
const legacyLabel = (s: string): ReturnType<typeof parseRich> =>
  parseRich(mathMarkup(s).replace(/`[^`\n]{1,28}`/g, (m) => m.replace(/ /g, ' ')), true);

const samples = [
  'FF = P_mp / (V_oc · I_sc) і **струм** I_L',
  'R ≈ 1,2 fm · A^(1/3), заряд 10^-19 C, `U = I·R`',
  '_Пояснення._ Формула `P = U · I · cos φ = 230 V · 10 A · 0,9` — довга',
  '{cyan:електрон} і 230 V, `x^2 + y_{1}`',
];

describe('richRuns — one text pipeline for the SDF Label and the DOM interface', () => {
  it('gives the runs the SDF Label laid out before (identical for both renderers)', () => {
    for (const s of samples) expect(richRuns(s)).toEqual(legacyLabel(s));
  });

  it('typesets document notation (I_sc → subscript «sc»)', () => {
    const runs = richRuns('струм I_sc');
    expect(runs.at(-1)).toMatchObject({ text: 'sc', script: -1 });
  });

  it('keeps short formulas on one line and lets long ones wrap', () => {
    const short = richRuns('`U = I·R`').find((r) => r.mono);
    expect(short?.text).toBe(`U${NBSP}=${NBSP}I·R`);
    const long = richRuns('`P = U · I · cos φ = 230 V · 10 A · 0,9`').find((r) => r.mono);
    expect(long?.text.startsWith('P = U')).toBe(true);
  });

  it('without rich markup only normalises characters', () => {
    expect(richRuns('a ** b_c', false)).toEqual(parseRich('a ** b_c', false));
  });
});
