/**
 * Step 4 `blade` — «Лопать — це крило». A magnified slice of the blade in front of the turning rotor: the
 * velocity triangle (wind v, headwind from rotation ω·r, apparent wind v_rel), lift ⊥ v_rel, drag ∥ v_rel
 * and the small part of the lift that actually pulls the blade round. Model M3: `airfoil(α)` and
 * `bladeSection(r/R)`. Sliders: angle of attack (stall from ≈ 14°) and the position along the blade.
 */
import { Mesh, TorusGeometry, Vector3 } from 'three';
import { airfoil, bladeSection } from '@electricity/sim/plant-wind';
import { K } from '@/style';
import { STATUS } from '@/ui3d';
import { hotspotNames } from '../content';
import { buildAirfoil, buildConsole, CHORD } from '../parts';
import type { StepFactory } from './types';

const ALPHAS = Array.from({ length: 61 }, (_, i) => -5 + i * 0.5);

export const blade: StepFactory = ({ ctx, ui, L, hero }) => {
  const diagram = buildAirfoil();
  diagram.group.position.copy(hero.hub).add(new Vector3(-36, 6, 30));
  ctx.root.add(diagram.group);
  const aDiagram = ctx.stage.actor(diagram.group, { appear: 'pop' });
  // where on the real rotor the slice comes from: a ring at radius r in the rotor plane
  const ring = new Mesh(new TorusGeometry(1, 0.012, 8, 96), K.glow({ color: 'cyan', intensity: 1.5, whiten: 0, keepHue: true }));
  ring.position.copy(hero.rotor.position);
  hero.nacelle.add(ring);
  const aRing = ctx.stage.actor(ring, { appear: 'fade' });

  const curves = buildConsole(ctx, {
    title: 'C_L(α), C_D(α)',
    width: 380,
    unit: 0.03,
    chart: { height: 180, legend: true, x: { min: -5, max: 25, label: 'α, °' }, y: { min: -0.6, max: 1.6, label: 'C_L, C_D' }, series: [{ id: 'cl', label: 'C_L', color: 'green' }, { id: 'cd', label: 'C_D', color: 'red' }] },
  });
  curves.chart.setData('cl', ALPHAS, ALPHAS.map((a) => airfoil(a).cl));
  curves.chart.setData('cd', ALPHAS, ALPHAS.map((a) => airfoil(a).cd));
  curves.surface.position.copy(diagram.group.position).add(new Vector3(11, -4.2, 0));
  ctx.root.add(curves.surface);
  const aCurves = ctx.stage.actor(curves.surface, { appear: 'pop' });
  const alpha = (): number => ui.value<number>('bl.alpha');
  const span = (): number => ui.value<number>('bl.span') / 100;
  const foilState = (): ReturnType<typeof airfoil> => airfoil(alpha());
  let key = '';
  const tip = new Vector3();
  const lead = new Vector3();
  const [hsLeading, hsLightning] = hotspotNames('blade');
  const far = new Vector3(0, -1e5, 0);
  return {
    id: 'blade',
    stage: { camera: 'blade', show: [aDiagram, aRing, aCurves], post: { dofAperture: 1.5 } },
    ui: {
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'slider', id: 'bl.alpha', label: L.alpha, min: -5, max: 25, step: 0.5, unit: '°', digits: 1, value: 6, marks: [{ value: 14, label: 'stall' }] },
        { type: 'slider', id: 'bl.span', label: L.span, min: 10, max: 100, step: 1, unit: '%', value: 70 },
        { type: 'readout', id: 'bl.glide', label: L.glide, digits: 0, get: () => Math.max(0, foilState().liftToDrag), color: () => (foilState().stalled ? STATUS.alarm : STATUS.ok) },
        { type: 'readout', id: 'bl.twist', label: L.twist, unit: '°', digits: 1, get: () => bladeSection(span()).phiDeg - alpha() },
      ],
      callouts: [
        { anchor: diagram.arrows.v.tip, text: L.windV, color: 'sky', side: 'up' },
        { anchor: diagram.arrows.omega.tip, text: L.windOmega, color: 'mist', side: 'left' },
        { anchor: diagram.arrows.rel.tip, text: L.windRel, side: 'right' },
        { anchor: diagram.arrows.lift.tip, text: L.lift, color: 'green', side: 'right' },
        { anchor: diagram.arrows.drag.tip, text: L.drag, color: 'red', side: 'down' },
        { anchor: diagram.arrows.drive.tip, text: L.torque, color: 'yellow', side: 'left' },
        { anchor: () => (foilState().stalled ? diagram.foil.localToWorld(tip.set(CHORD * 0.75, 3.4, 0)) : far), text: L.stall, color: 'red', side: 'up' },
      ],
      hotspots: [
        { anchor: () => diagram.foil.localToWorld(lead.set(-0.31 * CHORD, 0, 0)), title: hsLeading! },
        { anchor: hero.bladeTip, title: hsLightning! },
      ],
    },
    update() {
      curves.chart.setMarker('cl', { x: alpha(), y: foilState().cl, color: 'green' });
      curves.chart.setMarker('cd', { x: alpha(), y: foilState().cd, color: 'red', guides: false });
      curves.surface.quaternion.copy(ctx.camera.camera.quaternion);
      const k = `${alpha()}|${span()}`;
      if (k !== key) {
        key = k;
        const sec = bladeSection(span());
        const f = foilState();
        diagram.set({ alphaDeg: alpha(), phiDeg: sec.phiDeg, cl: f.cl, cd: f.cd, axialRel: sec.axialRel, tangentialRel: sec.tangentialRel });
      }
      ring.scale.setScalar(Math.max(0.05, span()) * hero.radius);
    },
  };
};
