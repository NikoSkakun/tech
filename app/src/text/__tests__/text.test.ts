import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { setFontData, type FontData, type FontJson } from '../fonts';
import { layoutText } from '../layout';
import { NBSP, bindUnits, parseRich, stripRich } from '../rich';

let fonts: FontData;
beforeAll(() => {
  const json = JSON.parse(
    readFileSync(new URL('../../../public/fonts/fonts.json', import.meta.url), 'utf8'),
  ) as FontJson;
  fonts = setFontData(json);
});

describe('rich-text markup', () => {
  it('parses terms, emphasis, formulas, scripts and colours', () => {
    const runs = parseRich('**AC** — _змінний_ струм, `U = I·R`, 10^{-19} C, H_{2}O, {cyan:електрон}');
    const find = (text: string) => runs.find((r) => r.text.includes(text))!;
    expect(find('AC')).toMatchObject({ bold: true, color: 'accent' });
    expect(find('змінний')).toMatchObject({ italic: true, bold: false });
    expect(find('U = I·R')).toMatchObject({ mono: true, color: 'formula' });
    expect(find('−19') ?? find('-19')).toMatchObject({ script: 1 });
    expect(runs.find((r) => r.text === '2')).toMatchObject({ script: -1 });
    expect(find('електрон')).toMatchObject({ color: 'cyan' });
    expect(stripRich('**AC** — _змінний_ струм')).toBe('AC — змінний струм');
  });

  it('treats Unicode super/subscripts like markup, and keeps snake_case and escapes literal', () => {
    const runs = parseRich('10⁻¹⁹ і CO₂');
    expect(
      runs
        .filter((r) => r.script === 1)
        .map((r) => r.text)
        .join(''),
    ).toBe('−19');
    expect(
      runs
        .filter((r) => r.script === -1)
        .map((r) => r.text)
        .join(''),
    ).toBe('2');
    expect(stripRich('lab_hybrid_home і \\*зірочки\\*')).toBe('lab_hybrid_home і *зірочки*');
    expect(parseRich('a ** b', false)).toHaveLength(1); // rich = false: plain text
  });

  it('binds numbers to their units with a no-break space (but leaves prose alone)', () => {
    expect(bindUnits('230 V і 50 Hz')).toBe(`230${NBSP}V і 50${NBSP}Hz`);
    expect(bindUnits('1,5 mm² та 16 A')).toBe(`1,5${NBSP}mm² та 16${NBSP}A`);
    expect(bindUnits('25 °C, 98 %, 10 kV, 3 m/s')).toBe(`25${NBSP}°C, 98${NBSP}%, 10${NBSP}kV, 3${NBSP}m/s`);
    expect(bindUnits('у 2022 році було 15 блоків')).toBe('у 2022 році було 15 блоків');
  });
});

describe('text layout', () => {
  it('covers the required character set in every face', () => {
    const required =
      'AaZz ҐґЄєІіЇїАаЯя αβγδεηθλμπρσφωΩΔΣΦ × · ± ≈ ≠ ≤ ≥ → ← ↔ ⇄ √ ∞ ∆ ∂ ∑ ∫ ° ‰ µ – — « » … № €';
    for (const face of Object.values(fonts.faces)) {
      for (const ch of required) {
        expect(face.glyphs.has(ch.codePointAt(0)!), `${face.id} lacks '${ch}'`).toBe(true);
      }
    }
  });

  it('measures synchronously, scales linearly with size and applies kerning', () => {
    const a = layoutText('Привіт', { size: 1, rich: false }, fonts).metrics;
    const b = layoutText('Привіт', { size: 20, rich: false }, fonts).metrics;
    expect(a.width).toBeGreaterThan(1.5);
    expect(b.width).toBeCloseTo(a.width * 20, 4);
    expect(b.height).toBeCloseTo(20 * 1.4, 6);
    const width = (t: string): number => layoutText(t, { rich: false, font: 'display' }, fonts).metrics.width;
    expect(width('AV')).toBeLessThan(width('A') + width('V') - 0.02);
  });

  it('wraps at maxWidth on spaces, never inside number+unit, and honours explicit newlines', () => {
    const text = 'Напруга в розетці становить 230 V за частоти 50 Hz у всій Європі';
    const { metrics } = layoutText(text, { size: 10, maxWidth: 130 }, fonts);
    expect(metrics.lineCount).toBeGreaterThan(2);
    for (const w of metrics.lineWidths) expect(w).toBeLessThanOrEqual(130 + 1e-6);
    // the same text with a width that would split "230 V" if the space were breakable
    for (let width = 60; width < 200; width += 7) {
      const { glyphs, metrics: m } = layoutText('aaaa 230 V', { size: 10, maxWidth: width }, fonts);
      if (m.lineCount === 2) {
        const second = glyphs.filter((g) => g.baseline < glyphs[0]!.baseline - 1);
        expect(second.length).toBe(4); // "230V" stays together on the second line
      }
    }
    expect(layoutText('раз\nдва\nтри', { rich: false }, fonts).metrics.lineCount).toBe(3);
  });

  it('aligns and anchors the block', () => {
    const left = layoutText('довгий рядок\nкороткий', { size: 10, anchorX: 'left', anchorY: 'top' }, fonts);
    const center = layoutText(
      'довгий рядок\nкороткий',
      { size: 10, anchorX: 'center', anchorY: 'middle', align: 'center' },
      fonts,
    );
    expect(left.metrics.left).toBe(0);
    expect(left.metrics.top).toBe(0);
    expect(center.metrics.left).toBeCloseTo(-center.metrics.width / 2, 6);
    expect(center.metrics.top).toBeCloseTo(center.metrics.height / 2, 6);
    const xs = (r: typeof left, line: number) =>
      r.glyphs.filter((g) => (line === 0 ? g.baseline > -12 : g.baseline < -12)).map((g) => g.x0);
    expect(Math.min(...xs(left, 1))).toBeLessThan(1); // left-aligned second line starts at the block edge
    expect(Math.min(...xs(center, 1))).toBeGreaterThan(center.metrics.left + 1); // centred line is inset
  });

  it('reports formula and term spans for panel insets; scripts are smaller and shifted', () => {
    const { metrics, glyphs } = layoutText('Закон: `U = I·R` для **провідника** x^2', { size: 10 }, fonts);
    const formula = metrics.spans.find((s) => s.kind === 'formula')!;
    const term = metrics.spans.find((s) => s.kind === 'term')!;
    expect(formula.x1 - formula.x0).toBeGreaterThan(30);
    expect(term.x0).toBeGreaterThan(formula.x1);
    const sup = glyphs.at(-1)!;
    const base = glyphs.at(-2)!;
    expect(sup.baseline).toBeGreaterThan(base.baseline);
    expect(sup.y1 - sup.y0).toBeLessThan((base.y1 - base.y0) * 1.2);
  });
});

describe('combining marks and synthesized glyphs', () => {
  it('centres a combining mark over its base and adds no advance', () => {
    const plain = layoutText('`V`', { size: 1 }, fonts);
    const marked = layoutText('`V̇`', { size: 1 }, fonts);
    expect(marked.metrics.width).toBeCloseTo(plain.metrics.width, 5);
    const [base, dot] = marked.glyphs;
    expect((dot!.x0 + dot!.x1) / 2).toBeCloseTo((base!.x0 + base!.x1) / 2, 3);
    expect(dot!.y0).toBeGreaterThan(base!.y0); // lifted above the capital, not sitting in it
  });

  it('has every glyph the chapter copy uses (ℰ, ᵢ, ₓ, ⎓, ℃)', () => {
    for (const ch of ['ℰ', 'ᵢ', 'ₓ', '⎓', '℃', 'ᴬ', '‑'])
      for (const face of Object.values(fonts.faces)) expect(face.glyphs.has(ch.codePointAt(0)!)).toBe(true);
  });
});
