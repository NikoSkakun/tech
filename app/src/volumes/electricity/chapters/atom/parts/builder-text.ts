/**
 * Text of the element card in the atom builder: turns the sim's `BuilderResult` into the card lines
 * (status wording from the document's model §4 through `labels.ts`, numbers through the formatters).
 */
import { fmtNumber, fmtSci, plural } from '@/content';
import type { BuilderResult, HalfLife } from '@electricity/sim/atom';
import { L } from '../labels';
import type { ElementCardData } from './element-card';

const B = L.builder;

/** «12,3 р.», «1,39 млн р.», «53,2 доби», «20,4 min», «2,7×10¹⁷ р.». */
export function halfLifeText(t: HalfLife): string {
  const approx = t.approx ? '≈ ' : '';
  if (t.unit === 'y') {
    const v = t.value;
    if (v >= 1e12) return `${approx}${fmtSci(v)} ${B.years}`;
    if (v >= 1e9) return `${approx}${fmtNumber(v / 1e9)} ${B.billion} ${B.years}`;
    if (v >= 1e6) return `${approx}${fmtNumber(v / 1e6)} ${B.million} ${B.years}`;
    if (v >= 1e4) return `${approx}${fmtNumber(v / 1e3)} ${B.thousand} ${B.years}`;
    return `${approx}${fmtNumber(v)} ${B.years}`;
  }
  if (t.unit === 'd') {
    const forms = B.dayForms.split('|') as [string, string, string];
    return `${approx}${fmtNumber(t.value)} ${Number.isInteger(t.value) ? plural(t.value, forms) : forms[1]}`;
  }
  return `${approx}${fmtNumber(t.value)} ${t.unit}`;
}

/** Status line with its colour: green stable, amber radioactive, red unstable (document, step 9). */
export function statusText(r: BuilderResult): { text: string; tone: 'green' | 'amber' | 'red' | 'mist' } {
  switch (r.status) {
    case 'noAtom':
      return { text: B.noAtom, tone: 'mist' };
    case 'stable':
      return { text: r.isProtium ? `${B.stable}: ${B.protium}` : B.stable, tone: 'green' };
    case 'practicallyStable':
      return { text: B.practicallyStable, tone: 'green' };
    case 'radioactive':
      // «T½ = 12,3 р.» or, for rounded values, «T½ ≈ 5 700 р.»
      return {
        text: r.halfLife?.approx
          ? `${B.radioactive.replace('= ', '')}${halfLifeText(r.halfLife)}`
          : `${B.radioactive}${r.halfLife ? halfLifeText(r.halfLife) : ''}`,
        tone: 'amber',
      };
    case 'instant':
      return { text: B.instant, tone: 'red' };
    case 'fastDecay':
      return { text: B.fastDecay, tone: 'red' };
    default:
      return { text: B.unbound, tone: 'red' };
  }
}

export function builderCard(r: BuilderResult): ElementCardData {
  if (!r.element) return { symbol: '—', title: B.noAtom, lines: [`${B.neutrons}: ${r.neutrons}`] };
  const el = r.element;
  const status = statusText(r);
  const sign = r.charge === 0 ? '0' : `${r.charge > 0 ? '+' : '−'}${Math.abs(r.charge)} e`;
  const kind = r.ionKind === 'neutral' ? B.neutral : r.ionKind === 'cation' ? B.cation : B.anion;
  return {
    symbol: r.ionLabel,
    title: `${el.substanceUk ? `${el.nameUk} (${el.substanceUk})` : el.nameUk}-${r.massNumber}`,
    lines: [
      `Z = ${r.protons} · N = ${r.neutrons} · A = ${r.massNumber}`,
      `${B.charge}: **${sign}** — ${kind}`,
      `{${status.tone}:${status.text}}`,
      r.configurationText ? `\`${r.configurationText}\` · ${r.shells.join('–')}` : '',
      r.anionUnstable ? `{red:${B.anionUnstable}}` : '',
    ],
  };
}
