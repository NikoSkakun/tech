/**
 * `atom` «Модель симуляції» §4 (step `atom-builder`): Z (0…29), N (0…40), Ne (0…Z+1) → name, nuclide stability,
 * half-life, ion charge, configuration and shells. Rule order: Z = 0 → no atom; stable list; Ca-48 practically
 * stable; listed radioactive (T½); He-5 / Li-5 / Be-8 instant; else |N − N_ref(Z)| ≤ 3 (Z ≤ 4: ≤ 1,5) →
 * fast decay (fractions of a second to tens of hours), otherwise unbound (decays practically instantly).
 */
import { configurationText, elementByZ, ionConfiguration, shellCounts, type ElementInfo, type Subshell } from './elements';
import { INSTANT_DECAY, PRACTICALLY_STABLE, RADIOACTIVE, STABLE_A, UNBOUND_ANION_Z, referenceNeutronNumber, type HalfLife } from './nuclides';

export const BUILDER_RANGES = { z: { min: 0, max: 29 }, n: { min: 0, max: 40 } } as const;

export type NuclideStatus =
  | 'noAtom' // Z = 0: «лише нейтрони — це не атом»
  | 'stable'
  | 'practicallyStable' // Ca-48
  | 'radioactive' // listed, with T½
  | 'instant' // He-5, Li-5, Be-8
  | 'fastDecay' // near the stability valley, not listed
  | 'unbound'; // far from the valley

export interface BuilderInput {
  protons: number;
  neutrons: number;
  electrons: number;
}

export interface BuilderResult {
  /** Clamped inputs actually used. */
  protons: number;
  neutrons: number;
  electrons: number;
  massNumber: number;
  element: ElementInfo | null;
  status: NuclideStatus;
  halfLife: HalfLife | null;
  /** Z = 1, N = 0: bare proton / H⁺ or protium atom (stable). */
  isProtium: boolean;
  /** q = Z − Ne in units of e. */
  charge: number;
  ionKind: 'neutral' | 'cation' | 'anion';
  /** «такий аніон нестійкий: зайвий електрон одразу відлітає» (He, Be, N, Ne, Mg, Ar, Mn). */
  anionUnstable: boolean;
  /** Ion label, e.g. "Cu⁺", "Fe²⁺", "N⁻", or the symbol for a neutral atom. */
  ionLabel: string;
  configuration: Subshell[];
  configurationText: string;
  shells: number[];
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** "Cu⁺", "Fe²⁺", "N⁻". */
export function ionLabel(symbol: string, charge: number): string {
  if (charge === 0) return symbol;
  const mag = Math.abs(charge) === 1 ? '' : String(Math.abs(charge)).split('').map((c) => SUP[c]).join('');
  return `${symbol}${mag}${charge > 0 ? '⁺' : '⁻'}`;
}

export function nuclideStatus(z: number, n: number): { status: NuclideStatus; halfLife: HalfLife | null } {
  if (z <= 0) return { status: 'noAtom', halfLife: null };
  const a = z + n;
  const key = `${z}-${a}`;
  if (PRACTICALLY_STABLE.includes(key)) return { status: 'practicallyStable', halfLife: null };
  if (STABLE_A[z]?.includes(a)) return { status: 'stable', halfLife: null };
  const t = RADIOACTIVE[key];
  if (t) return { status: 'radioactive', halfLife: t };
  if (INSTANT_DECAY.includes(key)) return { status: 'instant', halfLife: null };
  const limit = z <= 4 ? 1.5 : 3;
  return { status: Math.abs(n - referenceNeutronNumber(z)) <= limit ? 'fastDecay' : 'unbound', halfLife: null };
}

export function buildAtom(input: BuilderInput): BuilderResult {
  const z = Math.round(Math.min(Math.max(input.protons, 0), BUILDER_RANGES.z.max));
  const n = Math.round(Math.min(Math.max(input.neutrons, 0), BUILDER_RANGES.n.max));
  const ne = Math.round(Math.min(Math.max(input.electrons, 0), z + 1));
  const { status, halfLife } = nuclideStatus(z, n);
  const element = z > 0 ? (elementByZ(z) ?? null) : null;
  const charge = z - ne;
  const configuration = z > 0 ? ionConfiguration(z, ne) : [];
  return {
    protons: z,
    neutrons: n,
    electrons: ne,
    massNumber: z + n,
    element,
    status,
    halfLife,
    isProtium: z === 1 && n === 0,
    charge,
    ionKind: charge === 0 ? 'neutral' : charge > 0 ? 'cation' : 'anion',
    anionUnstable: charge < 0 && UNBOUND_ANION_Z.includes(z),
    ionLabel: element ? ionLabel(element.symbol, charge) : '',
    configuration,
    configurationText: configurationText(configuration),
    shells: shellCounts(configuration),
  };
}

/** Preset buttons «Водень», «Гелій-4», «Карбон-12», «Залізо-56», «Мідь-63», «Cu⁺». */
export const BUILDER_PRESETS: Readonly<Record<'hydrogen' | 'helium4' | 'carbon12' | 'iron56' | 'copper63' | 'copperIon', BuilderInput>> = {
  hydrogen: { protons: 1, neutrons: 0, electrons: 1 },
  helium4: { protons: 2, neutrons: 2, electrons: 2 },
  carbon12: { protons: 6, neutrons: 6, electrons: 6 },
  iron56: { protons: 26, neutrons: 30, electrons: 26 },
  copper63: { protons: 29, neutrons: 34, electrons: 29 },
  copperIon: { protons: 29, neutrons: 34, electrons: 28 },
};
