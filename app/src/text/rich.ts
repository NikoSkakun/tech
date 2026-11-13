/**
 * Rich-text mini-markup → styled runs (pure, unit-tested).
 *
 *   **term**          key term: accent colour, semi-bold
 *   _emphasis_        emphasis: italic
 *   `U = I·R`         formula: mono face, yellow
 *   x^2  10^{-19}     superscript (one character, or a braced group)
 *   U_{rms}           subscript (braced group)
 *   {cyan:електрон}   explicit palette colour (semantic colour coding inside text)
 *   \*  \_  \`  \^  \{  literal characters
 *
 * Unicode super/subscript characters (⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ ₀…₉ …) are accepted directly and rendered the same way as
 * the markup forms, so every face covers them. A space between a number and a unit ("230 V", "50 Hz",
 * "1,5 mm²") is made non-breaking automatically.
 */

export type RunColor = 'base' | 'accent' | 'formula' | (string & Record<never, never>);

export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  mono: boolean;
  /** +1 superscript, −1 subscript, 0 normal. */
  script: -1 | 0 | 1;
  color: RunColor;
}

const SUPERS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '−',
  '⁼': '=',
  '⁽': '(',
  '⁾': ')',
  ⁿ: 'n',
  ⁱ: 'i',
};
const SUBS: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '−',
  '₌': '=',
  '₍': '(',
  '₎': ')',
  ₐ: 'a',
  ₑ: 'e',
  ₒ: 'o',
  ₓ: 'x',
  ₕ: 'h',
  ₖ: 'k',
  ₗ: 'l',
  ₘ: 'm',
  ₙ: 'n',
  ₚ: 'p',
  ₛ: 's',
  ₜ: 't',
};

export const NBSP = ' ';

/**
 * A unit token after a number: SI symbols and prefixes in Latin/Greek (V, kWh, mm², Ω, °C, %, m/s, …).
 * Cyrillic words are never matched, so ordinary prose ("у 2022 році") keeps its normal spaces.
 */
const NUMBER_UNIT =
  /(\d)[ \t]+(?=(?:°[CFK]?|[%‰]|[µμ]?[A-Za-zΩ]{1,4}(?:[²³⁻¹]|\/[A-Za-zΩ²³]{1,4}|·[A-Za-zΩ]{1,3})?)(?![A-Za-z\u0400-\u04ff]))/g;

/** Replace the space between a number and its unit with a non-breaking space. */
export function bindUnits(text: string): string {
  return text.replace(NUMBER_UNIT, `$1${NBSP}`);
}

/** Character substitutions for glyphs that are not in the atlases. */
function normalizeChars(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/‑/g, '-') // non-breaking hyphen (kept unbroken by the line breaker's hyphen rule for digits)
    .replace(/℃/g, '°C')
    .replace(/Ω/g, 'Ω')
    .replace(/\t/g, '  ');
}

interface Style {
  bold: boolean;
  italic: boolean;
  mono: boolean;
  script: -1 | 0 | 1;
  color: RunColor;
}

const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/** Parse markup into styled runs. With `rich = false` only character normalisation is applied. */
export function parseRich(source: string, rich = true): Run[] {
  const text = bindUnits(normalizeChars(source));
  const runs: Run[] = [];
  let buffer = '';
  const base: Style = { bold: false, italic: false, mono: false, script: 0, color: 'base' };
  let style: Style = { ...base };
  const flush = (): void => {
    if (buffer.length === 0) return;
    const last = runs[runs.length - 1];
    if (
      last &&
      last.bold === style.bold &&
      last.italic === style.italic &&
      last.mono === style.mono &&
      last.script === style.script &&
      last.color === style.color
    ) {
      last.text += buffer;
    } else {
      runs.push({ text: buffer, ...style });
    }
    buffer = '';
  };
  const emit = (chunk: string, s: Style): void => {
    flush();
    const saved = style;
    style = s;
    buffer = chunk;
    flush();
    style = saved;
  };
  /** Emit plain characters, routing Unicode super/subscripts through the script style. */
  const plain = (ch: string): void => {
    const sup = SUPERS[ch];
    const sub = SUBS[ch];
    if (sup !== undefined) emit(sup, { ...style, script: 1 });
    else if (sub !== undefined) emit(sub, { ...style, script: -1 });
    else buffer += ch;
  };
  const chars = Array.from(text);
  const n = chars.length;
  let i = 0;
  let boldOpen = false;
  let italicOpen = false;
  let colorOpen = false;
  let colorPrev: RunColor = 'base';
  const groupEnd = (from: number): number => {
    // index of the matching '}' for a '{' at `from - 1`, or −1
    for (let j = from; j < n; j++) {
      if (chars[j] === '\\') j++;
      else if (chars[j] === '}') return j;
      else if (chars[j] === '\n') return -1;
    }
    return -1;
  };
  while (i < n) {
    const ch = chars[i]!;
    if (!rich) {
      plain(ch);
      i++;
      continue;
    }
    if (ch === '\\' && i + 1 < n) {
      buffer += chars[i + 1]!;
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = chars.indexOf('`', i + 1);
      if (end > i) {
        flush();
        const saved = style;
        style = { ...style, mono: true, color: style.color === 'base' ? 'formula' : style.color };
        // inside a formula only super/subscripts are interpreted
        for (let j = i + 1; j < end; j++) {
          const c = chars[j]!;
          if ((c === '^' || c === '_') && chars[j + 1] === '{') {
            const close = groupEnd(j + 2);
            if (close > 0 && close <= end) {
              emit(chars.slice(j + 2, close).join(''), { ...style, script: c === '^' ? 1 : -1 });
              j = close;
              continue;
            }
          }
          if (c === '^' && j + 1 < end && chars[j + 1] !== ' ') {
            emit(chars[j + 1]!, { ...style, script: 1 });
            j++;
            continue;
          }
          plain(c);
        }
        flush();
        style = saved;
        i = end + 1;
        continue;
      }
    }
    if (ch === '*' && chars[i + 1] === '*') {
      flush();
      boldOpen = !boldOpen;
      style = {
        ...style,
        bold: boldOpen,
        color: boldOpen
          ? style.color === 'base'
            ? 'accent'
            : style.color
          : style.color === 'accent'
            ? 'base'
            : style.color,
      };
      i += 2;
      continue;
    }
    if (ch === '_' && chars[i + 1] === '{') {
      const close = groupEnd(i + 2);
      if (close > 0) {
        emit(chars.slice(i + 2, close).join(''), { ...style, script: -1 });
        i = close + 1;
        continue;
      }
    }
    if (ch === '_') {
      const before = chars[i - 1];
      const after = chars[i + 1];
      const opens =
        !italicOpen && !isWordChar(before) && after !== undefined && after !== ' ' && after !== '\n';
      const closes = italicOpen && !isWordChar(after) && before !== ' ';
      if (opens || closes) {
        flush();
        italicOpen = !italicOpen;
        style = { ...style, italic: italicOpen };
        i++;
        continue;
      }
    }
    if (ch === '^') {
      if (chars[i + 1] === '{') {
        const close = groupEnd(i + 2);
        if (close > 0) {
          emit(chars.slice(i + 2, close).join(''), { ...style, script: 1 });
          i = close + 1;
          continue;
        }
      } else if (i + 1 < n && chars[i + 1] !== ' ' && chars[i + 1] !== '\n') {
        emit(chars[i + 1]!, { ...style, script: 1 });
        i += 2;
        continue;
      }
    }
    if (ch === '{' && !colorOpen) {
      const m = /^\{([a-zA-Z][a-zA-Z.]*):/.exec(chars.slice(i, i + 24).join(''));
      if (m && groupEnd(i + m[0].length) > 0) {
        flush();
        colorPrev = style.color;
        style = { ...style, color: m[1]! };
        colorOpen = true;
        i += m[0].length;
        continue;
      }
    }
    if (ch === '}' && colorOpen) {
      flush();
      style = { ...style, color: colorPrev };
      colorOpen = false;
      i++;
      continue;
    }
    plain(ch);
    i++;
  }
  flush();
  return runs;
}

/** The plain text of a marked-up string (markup removed, scripts flattened) — e.g. for tooltips or search. */
export function stripRich(source: string): string {
  return parseRich(source)
    .map((r) => r.text)
    .join('');
}
