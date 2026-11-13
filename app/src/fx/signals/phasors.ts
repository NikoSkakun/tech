/**
 * Phasor diagram — rotating arrows on a polar screen with their projection onto the vertical axis: the
 * instantaneous value u(t) = A·sin(ωt + φ) is the height of the arrow tip. Put it next to a `Scope` and set
 * `phasors.angle = scope.phase` to show that a sine wave is the shadow of a rotating vector.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { K, SEMANTIC, type ColorLike } from '@/style';
import { RibbonLines } from '../core/ribbon';
import { onTick } from '../core/tick';
import { createVectorArrow, type VectorArrow } from '../fields/arrows';
import { createScreen, type Screen } from './screen';

export interface PhasorSpec {
  color?: ColorLike;
  /** Length relative to the diagram radius, 0…1. Default 1. */
  amplitude?: number;
  /** Phase angle φ in radians (counter-clockwise from +X). Default 0. */
  phase?: number;
}

export interface PhasorsOptions {
  /** Diameter of the diagram, units. Default 2.4. */
  size?: number;
  /** Arrows. Default: three phases 120° apart in L1 / L2 / L3 colours. */
  phasors?: readonly PhasorSpec[];
  /** Rotation frequency, Hz (slowed for the eye). Default 0.5. */
  frequency?: number;
  /** Show the projection dots and guide lines on the right edge. Default true. */
  projection?: boolean;
  accent?: ColorLike;
}

interface Item {
  arrow: VectorArrow;
  dot: Mesh | null;
  guide: RibbonLines | null;
  amplitude: number;
  phase: number;
}

const _a = new Vector3();
const _b = new Vector3();

/** Phasor diagram. Create through `createPhasors()`. */
export class Phasors extends Group {
  readonly screen: Screen;
  /** Rotation frequency, Hz (tweenable). */
  frequency: number;
  /** Common rotation angle ωt, radians (integrated from `frequency`; you may also set it yourself). */
  angle = 0;
  frozen = false;
  private readonly items: Item[];
  private readonly radius: number;

  constructor(o: PhasorsOptions = {}) {
    super();
    this.name = 'phasors';
    const size = o.size ?? 2.4;
    this.radius = size * 0.5 * 0.86;
    this.frequency = o.frequency ?? 0.5;
    const projection = o.projection ?? true;
    // the plate is wider on the right to make room for the projection axis
    this.screen = createScreen({ width: size * (projection ? 1.22 : 1), height: size, accent: o.accent, kind: 'polar' });
    this.screen.position.x = projection ? size * 0.11 : 0;
    this.add(this.screen);
    const specs = o.phasors ?? [
      { color: SEMANTIC.phaseL1, phase: 0 },
      { color: SEMANTIC.phaseL2, phase: (-2 * Math.PI) / 3 },
      { color: SEMANTIC.phaseL3, phase: (-4 * Math.PI) / 3 },
    ];
    const dotGeometry = new SphereGeometry(size * 0.022, 16, 12);
    this.items = specs.map((s, i) => {
      const color = s.color ?? 'white';
      const arrow = createVectorArrow({ color, radius: size * 0.012, headLength: size * 0.085, headRadius: size * 0.034, intensity: 1.3 });
      arrow.position.z = 0.03 + i * 0.006;
      this.add(arrow);
      let dot: Mesh | null = null;
      let guide: RibbonLines | null = null;
      if (projection) {
        dot = new Mesh(dotGeometry, K.glow({ color, intensity: 1.8, falloff: 0.5 }));
        guide = new RibbonLines({ capacity: 4, color, width: size * 0.008, intensity: 0.8, dashRepeat: 9 / size, dashStrength: 1, dashSpeed: 0, base: 0, endFade: [0, 0], minPixels: 1.2 });
        guide.renderOrder = 2;
        this.add(dot, guide);
      }
      return { arrow, dot, guide, amplitude: s.amplitude ?? 1, phase: s.phase ?? 0 };
    });
    onTick(this, (_t, dt) => {
      if (!this.frozen) this.angle = (this.angle + dt * this.frequency * Math.PI * 2) % (Math.PI * 2 * 1024);
      this.redraw();
    });
  }

  /** Change phasor `i` (amplitude 0…1 of the radius, phase in radians). */
  set(i: number, amplitude: number, phase: number): void {
    const item = this.items[i];
    if (!item) return;
    item.amplitude = amplitude;
    item.phase = phase;
  }

  /** Instantaneous value of phasor `i`: A·sin(ωt + φ). */
  value(i: number): number {
    const item = this.items[i];
    return item ? item.amplitude * Math.sin(this.angle + item.phase) : 0;
  }

  private redraw(): void {
    const xAxis = this.radius * 1.3;
    for (const item of this.items) {
      const a = this.angle + item.phase;
      const r = item.amplitude * this.radius;
      const z = item.arrow.position.z;
      _a.set(0, 0, z);
      _b.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      item.arrow.set(_a, _b);
      if (item.dot && item.guide) {
        item.dot.position.set(xAxis, _b.y, z);
        item.guide.setLines([{ points: [new Vector3(_b.x, _b.y, z), new Vector3(xAxis, _b.y, z)] }]);
      }
    }
  }
}

export function createPhasors(o: PhasorsOptions = {}): Phasors {
  return new Phasors(o);
}
