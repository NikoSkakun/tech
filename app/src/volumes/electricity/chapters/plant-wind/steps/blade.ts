/**
 * Step 4 `blade` — «Лопать — це крило». A magnified slice of the blade in front of the turning rotor, in the
 * air that flows round it: streamlines and air parcels from a potential-flow solution (parts/flow-lines.ts),
 * the velocity triangle (wind v, headwind from rotation ω·r, apparent wind v_rel), lift ⊥ v_rel, drag ∥ v_rel
 * and the small part of the lift that actually pulls the blade round. Numbers from model M3: `airfoil(α)` and
 * `bladeSection(r/R)`. The diagram is the view along the blade, laid out like a wing (parts/airfoil.ts). Sliders: angle of attack (the flow separates and the lift collapses from ≈ 14°) and the
 * position along the blade (the triangle leans over, the setting angle follows — shown on the twist row).
 */
import { Mesh, TorusGeometry, Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { airfoil, bladeSection, liftCoefficient } from '@electricity/sim/plant-wind';
import { K } from '@/style';
import { STATUS } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { buildAirfoil } from '../parts/airfoil';
import { FLOW_SLOWDOWN } from '../parts/flow-lines';
import { buildTwistView } from '../parts/twist-view';
import { hot } from './hot';
import type { StepFactory } from './types';

const ALPHAS = Array.from({ length: 61 }, (_, i) => -5 + i * 0.5);
/** Lift slope of attached flow in the simulation (C_L per degree, linear part). */
const SLOPE = liftCoefficient(1);
/** Where the diagram hangs relative to the hero's hub: upwind of the rotor, toward the camera. */
export const BLADE_DIAGRAM = new Vector3(-40, 8, 34);

export const blade: StepFactory = ({ ctx, ui, L, hero }) => {
  const diagram = buildAirfoil();
  diagram.group.position.copy(hero.hub).add(BLADE_DIAGRAM);
  const twist = buildTwistView({ root: L.root, tip: L.tip });
  twist.group.position.set(-9.6, -12.6, -6.4);
  diagram.group.add(twist.group);
  ctx.root.add(diagram.group);
  const aDiagram = ctx.stage.actor(diagram.group, { appear: 'pop' });
  // where on the real rotor the slice comes from: a ring at radius r in the rotor plane
  const ring = new Mesh(new TorusGeometry(1, 0.012, 8, 96), K.glow({ color: 'cyan', intensity: 1.5, whiten: 0, keepHue: true }));
  ring.position.copy(hero.rotor.position);
  hero.nacelle.add(ring);
  const aRing = ctx.stage.actor(ring, { appear: 'fade' });

  const alpha = (): number => ui.value<number>('bl.alpha');
  const span = (): number => ui.value<number>('bl.span') / 100;
  const foilState = (): ReturnType<typeof airfoil> => airfoil(alpha());
  const twistDeg = (): number => bladeSection(span()).phiDeg - alpha();
  let key = '';
  const stallAt = new Vector3();
  const markerAt = new Vector3();
  ctx.qa.expose('blade', () => ({ attached: diagram.flow.attached, lift: diagram.arrows.lift.scale.y, foilAngle: diagram.foil.rotation.z }));
  return {
    id: 'blade',
    stage: { camera: 'blade', show: [aDiagram, aRing], post: { dofAperture: 1.2 }, enter: () => (key = '') },
    ui: {
      honesty: [{ kind: 'simplified', text: L.flowModel }, 'notToScale', { slowed: FLOW_SLOWDOWN }],
      hint: L.viewAlong,
      controls: [
        { type: 'slider', id: 'bl.alpha', label: L.alpha, min: -5, max: 25, step: 0.5, unit: '°', digits: 1, value: 6, marks: [{ value: 14, label: L.stallMark }] },
        { type: 'slider', id: 'bl.span', label: L.span, min: 10, max: 100, step: 1, unit: '%', value: 70 },
      ],
      board: {
        title: L.polar,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'bl.polar',
            chart: { height: 170, legend: true, x: { min: -5, max: 25, label: 'α, °' }, y: { min: -0.6, max: 1.6, label: 'C_L, C_D', ticks: [-0.5, 0, 0.5, 1, 1.5] }, series: [{ id: 'cl', label: L.liftCurve, color: 'green' }, { id: 'cd', label: L.dragCurve, color: 'red' }] },
            init: (chart) => {
              chart.setData('cl', ALPHAS, ALPHAS.map((a) => airfoil(a).cl));
              chart.setData('cd', ALPHAS, ALPHAS.map((a) => airfoil(a).cd));
            },
            update: (chart) => {
              chart.setMarker('cl', { x: alpha(), y: foilState().cl, color: 'green' });
              chart.setMarker('cd', { x: alpha(), y: foilState().cd, color: 'red', guides: false });
            },
          },
          { type: 'note', id: 'bl.stall', text: L.stall, icon: 'warning', color: STATUS.alarm, visible: () => foilState().stalled },
          {
            type: 'stats',
            id: 'bl.res',
            columns: 2,
            items: [
              { label: L.glide, digits: 0, get: () => Math.max(0, foilState().liftToDrag), color: () => (foilState().stalled ? STATUS.alarm : STATUS.ok) },
              { label: L.twist, unit: '°', digits: 1, get: twistDeg },
            ],
          },
        ],
      },
      callouts: [
        { anchor: diagram.arrows.v.tip, text: L.windV, color: 'sky', side: 'up' },
        { anchor: diagram.arrows.omega.tip, text: L.windOmega, color: 'mist', side: 'left' },
        { anchor: diagram.arrows.rel.tip, text: L.windRel, side: 'right' },
        { anchor: diagram.arrows.lift.tip, text: L.lift, color: 'green', side: 'right' },
        { anchor: diagram.arrows.drag.tip, text: L.drag, color: 'red', side: 'down' },
        { anchor: diagram.arrows.drive.tip, text: L.torque, color: 'yellow', side: 'left' },
        { anchor: diagram.plate.anchor('plane'), text: L.rotorPlane, color: 'mist', side: 'down' },
        { anchor: () => diagram.foil.localToWorld(stallAt.copy(diagram.stallPoint)), text: L.stall, color: 'red', side: 'right', visible: () => foilState().stalled },
        { anchor: () => twist.group.localToWorld(markerAt.copy(twist.marker)), text: () => `${L.twistView}: θ = ${fmtNumber(twistDeg(), { digits: 1 })}°`, color: 'cyan', side: 'up' },
      ],
      hotspots: [
        hot(diagram.section.anchor('leadingEdge'), HOTSPOTS.blade.leadingEdge),
        hot(diagram.section.anchor('conductor'), HOTSPOTS.blade.lightning),
      ],
    },
    update(dt) {
      const k = `${alpha()}|${span()}`;
      if (k !== key) {
        key = k;
        const sec = bladeSection(span());
        const f = foilState();
        // share of the attached-flow lift the model keeps: 1 on the linear part, falling through the stall
        const liftShare = alpha() > 12 ? f.cl / (SLOPE * alpha()) : 1;
        diagram.set({ alphaDeg: alpha(), phiDeg: sec.phiDeg, cl: f.cl, cd: f.cd, liftShare, axialRel: sec.axialRel, tangentialRel: sec.tangentialRel });
        twist.set(span(), alpha());
      }
      diagram.update(dt);
      ring.scale.setScalar(Math.max(0.05, span()) * hero.radius);
    },
  };
};
