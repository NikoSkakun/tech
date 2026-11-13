/**
 * distribution Р1 (step 1): 10 kV topology. Source bus with feeders F1 (TP1…TP5) and F2 (TP10…TP6), 150 customers per
 * TP. Supply = BFS from the source over closed sections. Ring: NOP between TP5 and TP6 (open). Fault → the feeder's
 * head breaker trips (t = 0); «Локалізувати» opens both ends of the faulted section and recloses the head breaker
 * (t = 3 min); «Відновити» closes the NOP (t = 5 min). Radial: no TP5–TP6 section, restore unavailable («~2 h» crew).
 * Mesh: NOP closed, tie TP3–TP8, breakers with protection on every section: only the faulted section opens.
 */

export type Topology = 'radial' | 'ring' | 'mesh';
export type Stage = 'normal' | 'tripped' | 'localized' | 'restored';
export const CUSTOMERS_PER_TP = 150;
export const STAGE_TIME_MIN: Readonly<Record<Stage, number | null>> = { normal: null, tripped: 0, localized: 3, restored: 5 };

export interface Section {
  id: string;
  a: string;
  b: string;
  /** Feeder whose head breaker trips for a fault here (null for NOP / tie). */
  feeder: 'F1' | 'F2' | null;
  /** Normally-open point. */
  nop: boolean;
}

export function sections(topology: Topology): Section[] {
  const out: Section[] = [];
  const chain = (feeder: 'F1' | 'F2', tps: number[]) => {
    let prev = 'S';
    for (const t of tps) {
      const id = `${prev}-${t}`;
      out.push({ id, a: prev, b: String(t), feeder, nop: false });
      prev = String(t);
    }
  };
  chain('F1', [1, 2, 3, 4, 5]);
  chain('F2', [10, 9, 8, 7, 6]);
  if (topology !== 'radial') out.push({ id: '5-6', a: '5', b: '6', feeder: null, nop: topology === 'ring' });
  if (topology === 'mesh') out.push({ id: '3-8', a: '3', b: '8', feeder: null, nop: false });
  return out;
}

export interface TopologyState {
  topology: Topology;
  stage: Stage;
  faultSectionId: string | null;
  /** Sections currently open (switches at both ends counted together). */
  openSections: string[];
  /** Head breakers open. */
  openFeeders: ('F1' | 'F2')[];
}

export function normalState(topology: Topology): TopologyState {
  return {
    topology,
    stage: 'normal',
    faultSectionId: null,
    openSections: sections(topology).filter((s) => s.nop).map((s) => s.id),
    openFeeders: [],
  };
}

/** Energised TP numbers (BFS from the source). */
export function energisedTps(st: TopologyState): number[] {
  const live = sections(st.topology).filter(
    (s) => !st.openSections.includes(s.id) && s.id !== st.faultSectionId && !(s.a === 'S' && s.feeder && st.openFeeders.includes(s.feeder)),
  );
  const seen = new Set<string>(['S']);
  const queue = ['S'];
  while (queue.length > 0) {
    const v = queue.shift()!;
    for (const s of live) {
      const w = s.a === v ? s.b : s.b === v ? s.a : null;
      if (w !== null && !seen.has(w)) {
        seen.add(w);
        queue.push(w);
      }
    }
  }
  return [...seen].filter((x) => x !== 'S').map(Number).sort((x, y) => x - y);
}

export function customersWithoutPower(st: TopologyState): number {
  return (10 - energisedTps(st).length) * CUSTOMERS_PER_TP;
}

/** «Ножиці»: fault on a section. */
export function applyFault(st: TopologyState, sectionId: string): TopologyState {
  const sec = sections(st.topology).find((s) => s.id === sectionId);
  if (!sec) return st;
  if (st.topology === 'mesh') {
    return { ...st, stage: 'localized', faultSectionId: sectionId, openSections: [...st.openSections, sectionId] };
  }
  // the fault current flows from the feeder head: that breaker trips (a fault on the NOP section is not fed)
  const feeder = sec.feeder ?? null;
  return { ...st, stage: 'tripped', faultSectionId: sectionId, openFeeders: feeder ? [feeder] : [] };
}

export function localize(st: TopologyState): TopologyState {
  if (st.stage !== 'tripped' || st.faultSectionId === null) return st;
  return { ...st, stage: 'localized', openSections: [...st.openSections, st.faultSectionId], openFeeders: [] };
}

export function canRestore(st: TopologyState): boolean {
  return st.topology === 'ring' && st.stage === 'localized';
}

export function restore(st: TopologyState): TopologyState {
  if (!canRestore(st)) return st;
  return { ...st, stage: 'restored', openSections: st.openSections.filter((id) => id !== '5-6') };
}
