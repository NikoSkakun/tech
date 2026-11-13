/**
 * `atom` «Модель симуляції» §6 (step `standard-model`): numeric data of the 17 cards (PDG 2024, rounded).
 * Ukrainian names, discovery and "де трапляється" texts come from the content export (DECISIONS §43);
 * here only ids, symbols and numbers. `ordinaryMatter` marks what the «Звичайна речовина» filter highlights
 * (u, d, e⁻, γ, g — step text).
 */
export type ParticleCategory = 'quark' | 'lepton' | 'gauge' | 'scalar';
export type Interaction = 'strong' | 'electromagnetic' | 'weak' | 'gravity';

export interface ParticleCard {
  id: string;
  symbol: string;
  category: ParticleCategory;
  /** Generation 1…3 for fermions, null for bosons. */
  generation: 1 | 2 | 3 | null;
  /** Charge in e; `chargeText` keeps the fraction ("+2/3", "±1"). */
  chargeE: number;
  chargeText: string;
  spin: number;
  /** Rest mass in MeV/c² (0 for massless; neutrinos: null = "не нуль, дуже мала"). */
  massMeV: number | null;
  /** Upper limit for ν_e, eV/c² (KATRIN 2025: < 0,45). */
  massUpperLimitEv?: number;
  ordinaryMatter: boolean;
  /** Interactions the particle takes part in (gravity omitted — all have energy). */
  interactions: readonly Interaction[];
  /** Force carrier of. */
  carrierOf?: Interaction;
}

const q = (id: string, symbol: string, gen: 1 | 2 | 3, up: boolean, massMeV: number, ordinary = false): ParticleCard => ({
  id,
  symbol,
  category: 'quark',
  generation: gen,
  chargeE: up ? 2 / 3 : -1 / 3,
  chargeText: up ? '+2/3' : '−1/3',
  spin: 0.5,
  massMeV,
  ordinaryMatter: ordinary,
  interactions: ['strong', 'electromagnetic', 'weak'],
});
const lep = (id: string, symbol: string, gen: 1 | 2 | 3, charged: boolean, massMeV: number | null, ordinary = false): ParticleCard => ({
  id,
  symbol,
  category: 'lepton',
  generation: gen,
  chargeE: charged ? -1 : 0,
  chargeText: charged ? '−1' : '0',
  spin: 0.5,
  massMeV,
  ordinaryMatter: ordinary,
  interactions: charged ? ['electromagnetic', 'weak'] : ['weak'],
});

export const STANDARD_MODEL: readonly ParticleCard[] = [
  q('up', 'u', 1, true, 2.2, true),
  q('down', 'd', 1, false, 4.7, true),
  q('charm', 'c', 2, true, 1270),
  q('strange', 's', 2, false, 93),
  q('top', 't', 3, true, 172600),
  q('bottom', 'b', 3, false, 4180),
  lep('electron', 'e', 1, true, 0.511, true),
  lep('muon', 'μ', 2, true, 105.7),
  lep('tau', 'τ', 3, true, 1777),
  { ...lep('nu-e', 'ν_e', 1, false, null), massUpperLimitEv: 0.45 },
  lep('nu-mu', 'ν_μ', 2, false, null),
  lep('nu-tau', 'ν_τ', 3, false, null),
  { id: 'gluon', symbol: 'g', category: 'gauge', generation: null, chargeE: 0, chargeText: '0', spin: 1, massMeV: 0, ordinaryMatter: true, interactions: ['strong'], carrierOf: 'strong' },
  { id: 'photon', symbol: 'γ', category: 'gauge', generation: null, chargeE: 0, chargeText: '0', spin: 1, massMeV: 0, ordinaryMatter: true, interactions: [], carrierOf: 'electromagnetic' },
  { id: 'w', symbol: 'W', category: 'gauge', generation: null, chargeE: 1, chargeText: '±1', spin: 1, massMeV: 80400, ordinaryMatter: false, interactions: ['electromagnetic', 'weak'], carrierOf: 'weak' },
  { id: 'z', symbol: 'Z', category: 'gauge', generation: null, chargeE: 0, chargeText: '0', spin: 1, massMeV: 91200, ordinaryMatter: false, interactions: ['weak'], carrierOf: 'weak' },
  { id: 'higgs', symbol: 'H', category: 'scalar', generation: null, chargeE: 0, chargeText: '0', spin: 0, massMeV: 125200, ordinaryMatter: false, interactions: ['weak'] },
];

/** Mass for the card in the most readable unit: MeV/c² below 1000 MeV, GeV/c² above. */
export function cardMass(card: ParticleCard): { value: number; unit: 'eV' | 'MeV' | 'GeV' } | null {
  if (card.massMeV === null) return card.massUpperLimitEv !== undefined ? { value: card.massUpperLimitEv, unit: 'eV' } : null;
  return card.massMeV >= 1000 ? { value: card.massMeV / 1000, unit: 'GeV' } : { value: card.massMeV, unit: 'MeV' };
}

/** Particles that pulse on an interaction tab (participants). */
export function participantsOf(interaction: Interaction): ParticleCard[] {
  if (interaction === 'gravity') return [...STANDARD_MODEL];
  return STANDARD_MODEL.filter((p) => p.interactions.includes(interaction) || p.carrierOf === interaction);
}
