/**
 * Cell technologies of step 3 («Машина часу технологій»): which layers the cut shows and the chips' numbers —
 * typical module efficiency (2025, rounded) and cell V_oc, as given in the chapter document (step `cell`,
 * «Інтерактив»). Colours follow STYLE_GUIDE §2.2: n-regions `teal`, p-regions `pink`. Layer names are label keys.
 */
import type { ColorToken } from '@/style';
import type { L } from '../labels';

export type TechId = 'albsf' | 'perc' | 'topcon' | 'hjt' | 'bc';
export type LayerSlot = 'grid' | 'arc' | 'front' | 'base' | 'back' | 'rear';
type LabelKey = keyof typeof L;

export interface TechLayer {
  name: LabelKey;
  color: ColorToken;
}

export interface CellTech {
  id: TechId;
  /** Short name on the tab (international abbreviations the learner meets on datasheets, DECISIONS §54 b). */
  tab: string;
  /** Typical module efficiency, % (range). */
  efficiency: [number, number];
  /** Cell open-circuit voltage, V. */
  vocV: number;
  /** Layers top → bottom; a missing slot is absent in this technology. */
  layers: Partial<Record<LayerSlot, TechLayer>>;
  /** Rear metal is a full sheet (true) or fingers (false). */
  fullRear: boolean;
  /** Interdigitated p⁺ / n⁺ stripes on the back (back-contact cells). */
  stripes?: boolean;
}

const grid: TechLayer = { name: 'lyGrid', color: 'mist' };
const arc: TechLayer = { name: 'lyArc', color: 'blue' };

export const CELL_TECHS: readonly CellTech[] = [
  {
    id: 'albsf', tab: 'Al-BSF', efficiency: [17, 18], vocV: 0.64, fullRear: true,
    layers: { grid, arc, front: { name: 'lyEmitterN', color: 'teal' }, base: { name: 'lyBaseP', color: 'pink' }, back: { name: 'lyBsf', color: 'pink.dark' }, rear: { name: 'lyRearAl', color: 'steel' } },
  },
  {
    id: 'perc', tab: 'PERC', efficiency: [20, 21.5], vocV: 0.69, fullRear: true,
    layers: { grid, arc, front: { name: 'lyEmitterN', color: 'teal' }, base: { name: 'lyBaseP', color: 'pink' }, back: { name: 'lyPassRear', color: 'sky' }, rear: { name: 'lyRearAl', color: 'steel' } },
  },
  {
    id: 'topcon', tab: 'TOPCon', efficiency: [22, 23.5], vocV: 0.72, fullRear: false,
    layers: { grid, arc, front: { name: 'lyEmitterP', color: 'pink' }, base: { name: 'lyBaseN', color: 'teal' }, back: { name: 'lyTunnel', color: 'teal.dark' }, rear: { name: 'lyRearFingers', color: 'mist' } },
  },
  {
    id: 'hjt', tab: 'HJT', efficiency: [22, 23.5], vocV: 0.745, fullRear: false,
    layers: { grid, arc: { name: 'lyTco', color: 'sky' }, front: { name: 'lyAmorphP', color: 'pink.light' }, base: { name: 'lyBaseN', color: 'teal' }, back: { name: 'lyAmorphN', color: 'teal.light' }, rear: { name: 'lyRearFingers', color: 'mist' } },
  },
  {
    id: 'bc', tab: 'BC', efficiency: [23, 24.5], vocV: 0.73, fullRear: false, stripes: true,
    layers: { arc, front: { name: 'lyPassFront', color: 'sky' }, base: { name: 'lyBaseN', color: 'teal' }, back: { name: 'lyStripes', color: 'pink' }, rear: { name: 'lyRearBoth', color: 'mist' } },
  },
];

export const techById = (id: string): CellTech => CELL_TECHS.find((t) => t.id === id) ?? CELL_TECHS[1]!;
