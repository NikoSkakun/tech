/**
 * Data of step 5 `chemistries`.
 *
 * - `CHEM_TABLE` is parsed from the generated content: the document's table «типові діапазони комірок, 2025»
 *   arrives as one fact string in table markup, so headers and cells shown on screen are the document's own
 *   words (nothing is retyped here). Rows are keyed by `ChemId`; `chemName` is the row's own first cell.
 * - `RADAR` are illustrative 0…1 scores on the five axes of the showcase, derived from the same table
 *   (energy = mid Wh/kg ÷ 300; life = log₁₀ of mid cycles ÷ log₁₀ 20 000; safety from the runaway-onset column;
 *   «ціна» = affordability, low price → high score; power from the panel text: LMO and LTO fast, LCO slow).
 *   The step carries the «ілюстративно» chip.
 * - `TASK_FIT` encodes the verdicts of «Вибери хімію для задачі» exactly as the document lists them
 *   (several answers can be right).
 */
import raw from '@electricity/content/generated/lab-battery.json';
import type { ChemId } from './parts';

export const CHEMS: readonly ChemId[] = ['LCO', 'NMC', 'NCA', 'LFP', 'LMO', 'LTO', 'Na-ion'];

function parseTable(): { headers: string[]; rows: Record<string, string[]>; footnote: string } {
  const text = raw.steps.find((s) => s.id === 'chemistries')!.facts.items[0]!.text;
  const cells = text.split('|').map((c) => c.trim());
  const footnote = cells[cells.length - 1]!.replace(/^\*/, '');
  // the markup is «| h1 | … | h7 | |---|…| | r1c1 | …»: collect runs of non-empty cells of the header's length
  const runs: string[][] = [];
  let run: string[] = [];
  for (const c of cells.slice(0, -1)) {
    if (c === '' || /^-+$/.test(c)) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(c);
  }
  if (run.length) runs.push(run);
  const [headers, ...body] = runs as [string[], ...string[][]];
  // Rows named by a chemistry code (LFP …) are keyed by it. The document names the newcomer in plain Ukrainian
  // («Натрій-іонні», DECISIONS §54), so the rows without a code take the chemistries without a row, in order.
  const isCode = (r: string[]): boolean => (CHEMS as readonly string[]).includes(r[0]!);
  const rows: Record<string, string[]> = {};
  for (const r of body.filter(isCode)) rows[r[0]!] = r;
  const named = body.filter((r) => !isCode(r));
  CHEMS.filter((id) => !rows[id]).forEach((id, i) => {
    if (named[i]) rows[id] = named[i];
  });
  return { headers, rows, footnote };
}

export const CHEM_TABLE = parseTable();

/** On-screen name of a chemistry: the first cell of its table row — the code, or the document's Ukrainian name. */
export const chemName = (id: ChemId): string => CHEM_TABLE.rows[id]?.[0] ?? id;

/** Axis order of the radar. */
export const RADAR_AXES = ['energy', 'power', 'life', 'safety', 'price'] as const;
export const RADAR: Record<ChemId, readonly [number, number, number, number, number]> = {
  LCO: [0.72, 0.4, 0.67, 0.35, 0.3],
  NMC: [0.8, 0.7, 0.75, 0.5, 0.55],
  NCA: [0.87, 0.7, 0.7, 0.42, 0.45],
  LFP: [0.61, 0.7, 0.87, 0.8, 0.85],
  LMO: [0.42, 0.85, 0.63, 0.72, 0.8],
  LTO: [0.27, 0.95, 0.95, 0.95, 0.25],
  'Na-ion': [0.46, 0.65, 0.88, 0.85, 0.8],
};

export type TaskId = 'phone' | 'home' | 'bus' | 'drone' | 'polar';
export type Verdict = 'good' | 'ok' | 'bad';

/** good — named by the document for the task; ok — workable second choice; everything else is bad. */
const FIT: Record<TaskId, { good: readonly ChemId[]; ok: readonly ChemId[] }> = {
  phone: { good: ['LCO', 'NMC'], ok: ['NCA'] },
  home: { good: ['LFP'], ok: ['Na-ion', 'LTO', 'NMC'] },
  bus: { good: ['LTO', 'LFP'], ok: ['NMC'] },
  drone: { good: ['NMC', 'NCA'], ok: ['LCO'] },
  polar: { good: ['Na-ion', 'LTO'], ok: [] },
};

export function taskVerdict(task: TaskId, chem: ChemId): Verdict {
  const f = FIT[task];
  return f.good.includes(chem) ? 'good' : f.ok.includes(chem) ? 'ok' : 'bad';
}
