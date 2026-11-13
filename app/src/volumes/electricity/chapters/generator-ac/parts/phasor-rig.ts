/**
 * The three-phase holographic rig (steps 4 and 6…): a phasor dial with three arrows at 120° (phase colours) and
 * dashed guides to the newest points of three traces on the scope strip; optional "sum" plate where the arrows
 * are drawn tail to head (closed triangle = zero sum, the `blue` gap arrow = what the neutral carries); optional
 * p(t) strip under the scope. Layout (rig-local, y = 0 = centre line): [sum][dial][scope]. Values are −1…1 of
 * the scope half-scale; dial arrows have length `amp·R` and angle `wt − k·120°`.
 */
import { type Group, Vector3 } from 'three';
import { createVectorArrow, type VectorArrow } from '@/fx';
import { SEMANTIC } from '@/style';
import { PHASE, group, tag } from '../world';
import { createDial, createGuide, createHoloScope, dialRadius, type HoloScope } from './holo-scope';

export interface PhasorRig {
  group: Group;
  scope: HoloScope;
  power: HoloScope | null;
  sumPlate: Group | null;
  /** Arrows on the dial, one per phase. */
  arrows: VectorArrow[];
  /** Neutral (sum) arrow on the sum plate. */
  gap: VectorArrow | null;
  /**
   * Draw the dial, guides, sum triangle and the newest points: `wt` = ωt (rad), `amps[k]` = amplitude of phase k
   * (0…1 of the scope half-scale), `shown[k]` false hides that phase.
   */
  setPhasors(wt: number, amps: readonly number[], shown?: readonly boolean[]): void;
  /** World point of the sum plate's centre and of the dial (anchors). */
  sumCentre(out: Vector3): Vector3;
  dialCentre(out: Vector3): Vector3;
}

export const RIG = { dialSize: 2.5, scopeW: 5.0, scopeH: 2.5, sumSize: 1.9, gap: 0.12 } as const;

export function createPhasorRig(o: { sum?: boolean; power?: boolean } = {}): PhasorRig {
  const g = group('phasor-rig');
  const { dialSize, scopeW, scopeH, sumSize, gap } = RIG;
  const dialX = 0;
  const scopeX = dialSize / 2 + gap + scopeW / 2;
  const sumX = -dialSize / 2 - gap - sumSize / 2;
  const dial = createDial(dialSize);
  dial.position.x = dialX;
  const scope = createHoloScope({ width: scopeW, height: scopeH, channels: [...PHASE] });
  scope.group.position.x = scopeX;
  g.add(dial, scope.group);
  const R = dialRadius(scopeH);
  const arrows = PHASE.map((c) => {
    const a = createVectorArrow({ color: c, radius: 0.035, headLength: 0.2, headRadius: 0.09, intensity: 1.5 });
    g.add(a);
    return a;
  });
  const guides = PHASE.map((c) => {
    const l = createGuide(c, 0.022);
    g.add(l);
    return l;
  });
  let power: HoloScope | null = null;
  if (o.power) {
    power = createHoloScope({ width: scopeW, height: 1.25, channels: ['yellow', 'white'], samples: 160 });
    power.group.position.set(scopeX, -scopeH / 2 - 0.85, 0);
    const pt = tag('p(t)', 18, 'yellow', 'mono');
    pt.position.set(-scopeW / 2 + 0.45, 0.32, 0.06);
    power.group.add(pt);
    g.add(power.group);
  }
  let sumPlate: Group | null = null;
  let gapArrow: VectorArrow | null = null;
  const sumArrows: VectorArrow[] = [];
  if (o.sum) {
    sumPlate = createDial(sumSize);
    sumPlate.position.x = sumX;
    g.add(sumPlate);
    for (const c of PHASE) {
      const a = createVectorArrow({ color: c, radius: 0.03, headLength: 0.16, headRadius: 0.07, intensity: 1.5 });
      a.position.z = 0.06;
      sumPlate.add(a);
      sumArrows.push(a);
    }
    gapArrow = createVectorArrow({ color: SEMANTIC.dcMinus, radius: 0.04, headLength: 0.18, headRadius: 0.08, intensity: 1.7 });
    sumPlate.add(gapArrow);
    const st = tag('Σ', 22, 'mist');
    st.position.set(-sumSize / 2 + 0.25, sumSize / 2 - 0.25, 0.08);
    sumPlate.add(st);
  }
  const o3 = new Vector3();
  const tip = new Vector3();
  const curve = new Vector3();
  const v = new Vector3();
  const points = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  return {
    group: g,
    scope,
    power,
    sumPlate,
    arrows,
    gap: gapArrow,
    setPhasors(wt, amps, shown = [true, true, true]) {
      for (let k = 0; k < 3; k++) {
        const ang = wt - (k * 2 * Math.PI) / 3;
        const r = (amps[k] ?? 0) * R;
        const on = shown[k] !== false;
        o3.set(dialX, 0, 0.05 + k * 0.01);
        tip.set(dialX + Math.cos(ang) * r, Math.sin(ang) * r, o3.z);
        arrows[k]!.set(o3, v.copy(tip).sub(o3));
        arrows[k]!.visible = on && r > 1e-3;
        scope.leftPoint(Math.sin(ang) * (amps[k] ?? 0), curve).add(scope.group.position);
        guides[k]!.visible = on && r > 1e-3;
        guides[k]!.setLines([{ points: [tip.clone(), curve.clone()] }]);
      }
      if (!sumPlate || !gapArrow) return;
      // tail to head: 0 → v1 → v1+v2 → v1+v2+v3; centred on the triangle's centroid
      const L = sumSize * 0.5;
      points[0]!.set(0, 0, 0);
      for (let k = 0; k < 3; k++) {
        const ang = wt - (k * 2 * Math.PI) / 3;
        const r = shown[k] === false ? 0 : (amps[k] ?? 0) * L;
        points[k + 1]!.copy(points[k]!).add(v.set(Math.cos(ang) * r, Math.sin(ang) * r, 0));
      }
      const c = v.set(0, 0, 0).add(points[0]!).add(points[1]!).add(points[2]!).divideScalar(3);
      const centre = c.clone();
      for (let k = 0; k < 3; k++) {
        sumArrows[k]!.set(points[k]!.clone().sub(centre).setZ(0.06), points[k + 1]!.clone().sub(points[k]!));
        sumArrows[k]!.visible = points[k + 1]!.distanceTo(points[k]!) > 1e-3;
      }
      gapArrow.set(points[0]!.clone().sub(centre).setZ(0.09), points[3]!.clone().sub(points[0]!));
      gapArrow.visible = points[3]!.distanceTo(points[0]!) > 0.02;
    },
    sumCentre: (out) => (sumPlate ? sumPlate.getWorldPosition(out) : out.set(0, 0, 0)),
    dialCentre: (out) => dial.getWorldPosition(out),
  };
}
