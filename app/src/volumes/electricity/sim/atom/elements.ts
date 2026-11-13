/**
 * Element symbols / names (Z = 1…36, plus Ag and Au for the «Група 11» hint) and electron configurations
 * (`atom` §4 and step `shells`). Names follow DECISIONS §4: nomenclature name + substance in brackets.
 * Filling: Madelung order 1s 2s 2p 3s 3p 4s 3d 4p with exceptions Cr [Ar] 3d⁵ 4s¹ and Cu [Ar] 3d¹⁰ 4s¹;
 * cations lose electrons from the highest n first, then the highest l (Fe²⁺ → [Ar] 3d⁶, Cu⁺ → [Ar] 3d¹⁰).
 */

export interface ElementInfo {
  z: number;
  symbol: string;
  /** Ukrainian nomenclature name; `substance` is the simple-substance name when it differs. */
  nameUk: string;
  substanceUk?: string;
}

const RAW: [string, string, string?][] = [
  ['H', 'Гідроген', 'водень'],
  ['He', 'Гелій'],
  ['Li', 'Літій'],
  ['Be', 'Берилій'],
  ['B', 'Бор'],
  ['C', 'Карбон', 'вуглець'],
  ['N', 'Нітроген', 'азот'],
  ['O', 'Оксиген', 'кисень'],
  ['F', 'Флуор', 'фтор'],
  ['Ne', 'Неон'],
  ['Na', 'Натрій'],
  ['Mg', 'Магній'],
  ['Al', 'Алюміній'],
  ['Si', 'Силіцій', 'кремній'],
  ['P', 'Фосфор'],
  ['S', 'Сульфур', 'сірка'],
  ['Cl', 'Хлор'],
  ['Ar', 'Аргон'],
  ['K', 'Калій'],
  ['Ca', 'Кальцій'],
  ['Sc', 'Скандій'],
  ['Ti', 'Титан'],
  ['V', 'Ванадій'],
  ['Cr', 'Хром'],
  ['Mn', 'Манган', 'марганець'],
  ['Fe', 'Ферум', 'залізо'],
  ['Co', 'Кобальт'],
  ['Ni', 'Нікол', 'нікель'],
  ['Cu', 'Купрум', 'мідь'],
  ['Zn', 'Цинк'],
  ['Ga', 'Галій'],
  ['Ge', 'Германій'],
  ['As', 'Арсен', 'миш’як'],
  ['Se', 'Селен'],
  ['Br', 'Бром'],
  ['Kr', 'Криптон'],
];

export const ELEMENTS: readonly ElementInfo[] = RAW.map(([symbol, nameUk, substanceUk], i) => ({ z: i + 1, symbol, nameUk, ...(substanceUk ? { substanceUk } : {}) }));

export function elementByZ(z: number): ElementInfo | undefined {
  return ELEMENTS[z - 1];
}

/** Subshell occupation, e.g. { n: 3, l: 2, electrons: 10 } = 3d¹⁰. */
export interface Subshell {
  n: number;
  /** 0 = s, 1 = p, 2 = d, 3 = f. */
  l: number;
  electrons: number;
}

const L_LETTER = ['s', 'p', 'd', 'f'];
const capacity = (l: number): number => 2 * (2 * l + 1);
/** Madelung order up to 4p (enough for Z ≤ 36 and one extra electron). */
const MADELUNG: readonly [number, number][] = [
  [1, 0],
  [2, 0],
  [2, 1],
  [3, 0],
  [3, 1],
  [4, 0],
  [3, 2],
  [4, 1],
];

/** Neutral-atom ground configuration for Z = 0…36 (Cr and Cu exceptions). */
export function neutralConfiguration(z: number): Subshell[] {
  if (z === 24) return fill(18).concat([{ n: 3, l: 2, electrons: 5 }, { n: 4, l: 0, electrons: 1 }]);
  if (z === 29) return fill(18).concat([{ n: 3, l: 2, electrons: 10 }, { n: 4, l: 0, electrons: 1 }]);
  return fill(z);
}

function fill(electrons: number): Subshell[] {
  const out: Subshell[] = [];
  let left = electrons;
  for (const [n, l] of MADELUNG) {
    if (left <= 0) break;
    const e = Math.min(left, capacity(l));
    out.push({ n, l, electrons: e });
    left -= e;
  }
  return out;
}

const sortNl = (a: Subshell, b: Subshell): number => a.n - b.n || a.l - b.l;

/**
 * Configuration of an atom/ion with Z protons and `electrons` electrons: cations strip the highest n, then the
 * highest l; an extra electron (anion) goes to the next Madelung subshell with room.
 */
export function ionConfiguration(z: number, electrons: number): Subshell[] {
  const shells = neutralConfiguration(z).map((s) => ({ ...s }));
  let diff = electrons - z;
  while (diff < 0) {
    const victim = shells.filter((s) => s.electrons > 0).sort((a, b) => b.n - a.n || b.l - a.l)[0];
    if (!victim) break;
    victim.electrons -= 1;
    diff += 1;
  }
  while (diff > 0) {
    let placed = false;
    for (const [n, l] of MADELUNG) {
      const s = shells.find((x) => x.n === n && x.l === l);
      if (!s) {
        shells.push({ n, l, electrons: 1 });
        placed = true;
        break;
      }
      if (s.electrons < capacity(l)) {
        s.electrons += 1;
        placed = true;
        break;
      }
    }
    if (!placed) break;
    diff -= 1;
  }
  return shells.filter((s) => s.electrons > 0).sort(sortNl);
}

const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const sup = (k: number): string => String(k).split('').map((c) => SUP[Number(c)]).join('');
const NOBLE: readonly [string, number][] = [
  ['Kr', 36],
  ['Ar', 18],
  ['Ne', 10],
  ['He', 2],
];

export function subshellLabel(s: Subshell): string {
  return `${s.n}${L_LETTER[s.l]}${sup(s.electrons)}`;
}

/**
 * Noble-gas core notation, e.g. "[Ar] 3d¹⁰ 4s¹". The core is the largest noble-gas configuration that is fully
 * contained and leaves at least one electron outside it (Ne=18 → "[Ne] 3s² 3p⁶"); no core below 3 electrons.
 */
export function configurationText(shells: readonly Subshell[]): string {
  const total = shells.reduce((s, x) => s + x.electrons, 0);
  for (const [sym, count] of NOBLE) {
    if (count >= total) continue;
    const core = neutralConfiguration(count);
    const contains = core.every((c) => shells.some((s) => s.n === c.n && s.l === c.l && s.electrons === c.electrons));
    if (!contains) continue;
    const rest = shells.filter((s) => !core.some((c) => c.n === s.n && c.l === s.l)).sort(sortNl);
    return [`[${sym}]`, ...rest.map(subshellLabel)].join(' ');
  }
  return [...shells].sort(sortNl).map(subshellLabel).join(' ');
}

/** Electrons per shell K, L, M, N… («2–8–18–1»). */
export function shellCounts(shells: readonly Subshell[]): number[] {
  const out: number[] = [];
  for (const s of shells) {
    while (out.length < s.n) out.push(0);
    out[s.n - 1] += s.electrons;
  }
  return out;
}

export interface ValenceInfo {
  /** s/p elements: outer-shell s + p electrons (group rule); d elements (Z 21…30): outer s electrons. */
  count: number;
  kind: 'group' | 'outerS';
}

/** Valence electrons as shown in step `shells` for neutral atoms Z = 1…36. */
export function valenceElectrons(z: number): ValenceInfo {
  const shells = neutralConfiguration(z);
  const nMax = Math.max(...shells.map((s) => s.n));
  const outer = shells.filter((s) => s.n === nMax);
  if (z >= 21 && z <= 30) return { count: outer.filter((s) => s.l === 0).reduce((a, s) => a + s.electrons, 0), kind: 'outerS' };
  return { count: outer.reduce((a, s) => a + s.electrons, 0), kind: 'group' };
}

/** «Група 11» hint atoms (Ag, Au are outside 1…36 and given as fixed data). */
export const GROUP_11: readonly { z: number; symbol: string; nameUk: string; substanceUk: string; configuration: string; shells: readonly number[] }[] = [
  { z: 29, symbol: 'Cu', nameUk: 'Купрум', substanceUk: 'мідь', configuration: '[Ar] 3d¹⁰ 4s¹', shells: [2, 8, 18, 1] },
  { z: 47, symbol: 'Ag', nameUk: 'Аргентум', substanceUk: 'срібло', configuration: '[Kr] 4d¹⁰ 5s¹', shells: [2, 8, 18, 18, 1] },
  { z: 79, symbol: 'Au', nameUk: 'Аурум', substanceUk: 'золото', configuration: '[Xe] 4f¹⁴ 5d¹⁰ 6s¹', shells: [2, 8, 18, 32, 18, 1] },
];

/** Filling order for the «Показати порядок заповнення» ladder: subshell index per electron (Cu: 29 steps). */
export function fillingSequence(z: number): Subshell[] {
  const seq: Subshell[] = [];
  const order = neutralConfiguration(z);
  // Electrons drop in Madelung order; for Cr/Cu the final state already contains the 4s → 3d exception.
  for (const [n, l] of MADELUNG) {
    const s = order.find((x) => x.n === n && x.l === l);
    if (!s) continue;
    for (let k = 1; k <= s.electrons; k++) seq.push({ n, l, electrons: k });
  }
  return seq;
}
