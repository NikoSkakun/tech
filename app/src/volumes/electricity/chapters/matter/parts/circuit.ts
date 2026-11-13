/**
 * External circuit of step 8 on the podium: an adjustable source (its «+» terminal faces the p side, so U_s > 0
 * is forward bias), a 220 Ω resistor with colour bands (red-red-brown), an ammeter and an indicator lamp, joined
 * by one wire loop whose `yellow` pulses carry the current (brightness ∝ |I|, direction = conventional current).
 */
import { Group, Mesh, Vector3 } from 'three';
import { createHalo, createWire } from '@/fx';
import { Builder, G } from '@/kit';
import { K, SEMANTIC } from '@/style';

export interface Circuit {
  group: Group;
  /** Lamp brightness 0…1 (I / 25 mA). */
  lamp: number;
  /** Ammeter needle 0…1. */
  meter: number;
  /** Signed current share for the wire pulses (+ = forward). */
  current: number;
  source: Vector3;
  resistor: Vector3;
  lampAt: Vector3;
  ammeter: Vector3;
  update(dt: number): void;
}

/** `pX`, `nX`: x of the p / n contacts; `y`: their height. */
export function createCircuit(pX: number, nX: number, y: number): Circuit {
  const group = new Group();
  const b = new Builder('circuit');
  // source: dark box, «+» cap (coral) toward the p side, «−» cap (blue)
  b.box(1.0, 0.5, 0.6, { r: 0.08, c: ['bg.deep', 'slate'], at: [-1.5, 0.05, 1.5] });
  b.cyl(0.14, 0.12, { seg: 24, slot: 'gloss', c: SEMANTIC.dcPlus, axis: 'x', at: [-2.12, 0.3, 1.5] });
  b.cyl(0.14, 0.12, { seg: 24, slot: 'gloss', c: SEMANTIC.dcMinus, axis: 'x', at: [-1.0, 0.3, 1.5] });
  b.box(0.5, 0.18, 0.02, { r: 0.02, slot: 'glow', c: 'teal.dark', at: [-1.5, 0.22, 1.81] });
  // resistor: body with four bands (red, red, brown, gold → 22·10 Ω = 220 Ω)
  b.cyl(0.13, 0.9, { seg: 32, c: 'amber.light', axis: 'x', at: [-0.35, 0.3, 1.85] });
  for (const [x, c] of [
    [-0.18, 'red'],
    [-0.04, 'red'],
    [0.1, 'wireBrown'],
    [0.38, 'amber'],
  ] as const)
    b.cyl(0.137, 0.06, { seg: 32, c, axis: 'x', at: [x, 0.3, 1.85] });
  // ammeter: a small dial box
  b.box(0.62, 0.5, 0.36, { r: 0.07, c: ['bg.deep', 'slate'], at: [1.7, 0.05, 1.55] });
  b.cyl(0.2, 0.03, { seg: 32, c: 'white', axis: 'z', at: [1.7, 0.32, 1.73] });
  // lamp: socket + glass bulb
  b.cyl(0.18, 0.3, { seg: 32, slot: 'metal', c: 'steel', at: [2.75, 0.05, 0.9] });
  b.sphere(0.32, { slot: 'glass', at: [2.75, 0.62, 0.9] });
  group.add(b.build().group);
  const needle = new Mesh(G.box(0.02, 0.17, 0.01), K.toon({ color: 'red' }));
  needle.geometry.translate(0, 0.08, 0);
  needle.position.set(1.7, 0.25, 1.76);
  const filamentMat = K.glow({ color: 'yellow', intensity: 0.2, keepHue: false });
  const filament = new Mesh(G.sphere(0.09, 16), filamentMat);
  filament.position.set(2.75, 0.6, 0.9);
  const halo = createHalo({ color: 'yellow', size: 1.6, intensity: 0 });
  halo.position.copy(filament.position);
  const pts = G.roundPath(
    [
      new Vector3(pX, y, 0),
      new Vector3(pX, 0.3, 0),
      new Vector3(pX, 0.3, 1.5),
      new Vector3(-1.5, 0.3, 1.5),
      new Vector3(-1.0, 0.3, 1.5),
      new Vector3(-0.8, 0.3, 1.85),
      new Vector3(1.4, 0.3, 1.85),
      new Vector3(1.7, 0.3, 1.55),
      new Vector3(2.4, 0.3, 1.2),
      new Vector3(2.75, 0.3, 0.9),
      new Vector3(nX, 0.3, 0),
      new Vector3(nX, y, 0),
    ],
    0.18,
  );
  const wire = createWire(pts, { radius: 0.035, color: 'ink', repeat: 2.2, speed: 0 });
  group.add(needle, filament, halo, wire);
  let shown = 0;
  const c: Circuit = {
    group,
    lamp: 0,
    meter: 0,
    current: 0,
    source: new Vector3(-1.5, 0.75, 1.5),
    resistor: new Vector3(-0.3, 0.55, 1.85),
    lampAt: new Vector3(2.75, 1.0, 0.9),
    ammeter: new Vector3(1.7, 0.6, 1.6),
    update(dt) {
      shown += (c.lamp - shown) * Math.min(dt * 8, 1);
      filamentMat.intensity = 0.2 + 2.6 * shown;
      halo.intensity = 1.6 * shown;
      needle.rotation.z = Math.PI / 3 - ((2 * Math.PI) / 3) * Math.min(c.meter, 1);
      // conventional current runs from the source «+» into p: against the path order
      wire.material.power = Math.min(Math.abs(c.current), 1);
      wire.material.speed = -Math.sign(c.current) * 1.6;
    },
  };
  return c;
}
