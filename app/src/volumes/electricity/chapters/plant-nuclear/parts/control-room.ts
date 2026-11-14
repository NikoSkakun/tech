/**
 * The unit control room of step 8 (stylised): an arc of panels with blinking indicator rows, the big mimic of
 * the unit on the back wall (reactor → loop → steam generator → turbine → generator → line) whose glows follow
 * the model, a desk with the three diegetic controls — the rod-group lever, the turbine-load knob and the red
 * scram button under a hinged cover — and a «window» onto a small reactor glowing with the fission power and a
 * line whose pulses follow the generator. Metres; origin = middle of the floor in front of the desk.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { Builder, G, type KitModel } from '@/kit';
import { K } from '@/style';

export interface ControlRoom {
  group: Group;
  model: KitModel;
  lever: Group;
  knob: Group;
  button: Mesh;
  cover: Group;
  /** Invisible grab targets (≥ 44 px on screen at the shot distance). */
  hit: { lever: Mesh; knob: Mesh; button: Mesh };
  glows: { reactor: Mesh; loop: Mesh; turbine: Mesh; generator: Mesh; window: Mesh; alarm: Mesh };
  line: Wire;
  at: { lever: Vector3; knob: Vector3; button: Vector3; mimic: Vector3; window: Vector3; supervisor: Vector3 };
}

const glow = (geo: BoxGeometry | CylinderGeometry | SphereGeometry, color: 'orange' | 'sky' | 'white' | 'yellow' | 'red', at: [number, number, number]): Mesh => {
  const m = new Mesh(geo, K.glow({ color, intensity: 1.4, whiten: 0, keepHue: true }));
  m.position.set(...at);
  return m;
};

export function buildControlRoom(): ControlRoom {
  const group = new Group();
  const b = new Builder('control-room');
  b.cyl(16, 0.3, { seg: 64, slot: 'matte', c: ['bg.indigo', 'slate'], at: [0, -0.3, -4] });
  // arc of panels behind the desk with rows of indicator lamps
  const arc = G.revolve([[11.6, 0], [12, 0], [12, 4.6], [11.6, 4.6]], { phiStart: Math.PI * 1.2, phiLength: Math.PI * 0.6, seg: 24 });
  b.add(arc.shell, { slot: 'matte', c: ['slate', 'steel'], at: [0, 0, 6] });
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * 1.22 + (i / 25) * Math.PI * 0.56;
    for (let r = 0; r < 3; r++) b.box(0.22, 0.14, 0.05, { slot: 'glow', c: (i + r) % 7 === 0 ? 'amber' : (i * 3 + r) % 5 === 0 ? 'sky' : 'green', at: [Math.cos(a) * 11.55, 3 + r * 0.35, 6 + Math.sin(a) * 11.55], rot: [0, -a - Math.PI / 2, 0] });
  }
  // the mimic wall: a dark board with the unit drawn in pipes (glows are separate meshes, see below)
  b.box(9, 4.2, 0.3, { r: 0.1, slot: 'matte', c: ['bg.deep', 'bg.indigo'], at: [0, 2.2, -5.8] });
  b.box(9.4, 0.25, 0.4, { slot: 'metal', c: 'slate', at: [0, 6.4, -5.8] });
  // desk with a sloped top
  b.box(5.6, 1.0, 1.6, { r: 0.1, slot: 'matte', c: ['slate', 'steel'], at: [0, 0, 0.6] });
  b.box(5.6, 0.12, 1.3, { r: 0.05, slot: 'gloss', c: 'ink', at: [0, 1.0, 0.55], rot: [-0.25, 0, 0] });
  // window frame onto the reactor and the line (right of the mimic)
  b.box(3.6, 2.8, 0.25, { r: 0.08, slot: 'metal', c: 'slate', at: [6.6, 1.6, -4.9] });
  b.box(3.2, 2.4, 0.1, { slot: 'glass', c: 'sky', at: [6.6, 1.8, -4.8] });
  // the shift supervisor's desk on the left (a second, smaller desk with two screens)
  b.box(2.2, 0.9, 1.0, { r: 0.08, slot: 'matte', c: ['slate', 'steel'], at: [-5.2, 0, -1.4] });
  for (const x of [-5.7, -4.7]) b.box(0.8, 0.5, 0.06, { r: 0.03, slot: 'glow', c: 'sky', at: [x, 1.0, -1.7] });
  const model = b.build();
  group.add(model.group);
  // lever (pivot at its base, swings about X), knob (turns about its axis), scram button + cover
  const lever = new Group();
  lever.position.set(-1.4, 1.12, 0.5);
  const stick = new Mesh(new CylinderGeometry(0.05, 0.05, 0.7, 12).translate(0, 0.35, 0), K.metal({ color: 'steel.light' }));
  const grip = new Mesh(new SphereGeometry(0.12, 16, 12), K.toon({ color: 'cyan' }));
  grip.position.y = 0.72;
  lever.add(stick, grip);
  const knob = new Group();
  knob.position.set(0, 1.14, 0.5);
  knob.add(new Mesh(new CylinderGeometry(0.22, 0.24, 0.12, 24), K.metal({ color: 'slate.light' })));
  const notch = new Mesh(new BoxGeometry(0.04, 0.05, 0.2), K.toon({ color: 'cyan' }));
  notch.position.set(0, 0.07, 0.1);
  knob.add(notch);
  const button = new Mesh(new CylinderGeometry(0.2, 0.22, 0.12, 24), K.glow({ color: 'red', intensity: 1.2, whiten: 0, keepHue: true }));
  button.position.set(1.5, 1.14, 0.5);
  const cover = new Group();
  cover.position.set(1.5, 1.14, 0.25);
  const lid = new Mesh(new BoxGeometry(0.6, 0.3, 0.6).translate(0, 0.12, 0.28), K.glass({ color: 'mist', opacity: 0.35 }));
  cover.add(lid);
  group.add(lever, knob, button, cover);
  const hitMat = K.flat('white');
  hitMat.visible = false;
  const hitAt = (r: number, at: Vector3): Mesh => {
    const m = new Mesh(new SphereGeometry(r, 10, 8), hitMat);
    m.position.copy(at);
    group.add(m);
    return m;
  };
  const glows = {
    reactor: glow(new CylinderGeometry(0.55, 0.55, 0.1, 24).rotateX(Math.PI / 2), 'orange', [-3, 4.2, -5.6]),
    loop: glow(new BoxGeometry(2.6, 0.12, 0.05), 'sky', [-1.3, 4.2, -5.6]),
    turbine: glow(new BoxGeometry(1.6, 0.8, 0.05), 'white', [1.0, 4.2, -5.6]),
    generator: glow(new CylinderGeometry(0.4, 0.4, 0.1, 20).rotateX(Math.PI / 2), 'yellow', [2.6, 4.2, -5.6]),
    window: glow(new CylinderGeometry(0.5, 0.6, 1.2, 24), 'orange', [6.0, 1.3, -5.3]),
    alarm: glow(new BoxGeometry(9, 0.2, 0.05), 'red', [0, 2.6, -5.6]),
  };
  group.add(...Object.values(glows));
  const line = createWire([new Vector3(3.0, 4.2, -5.6), new Vector3(4.4, 4.2, -5.6), new Vector3(5.2, 3.4, -5.4), new Vector3(8.2, 2.6, -5.2)], { radius: 0.05, color: 'steel', repeat: 1.2, speed: 1.5, detail: 6 });
  group.add(line);
  return {
    group,
    model,
    lever,
    knob,
    button,
    cover,
    hit: { lever: hitAt(0.35, new Vector3(-1.4, 1.6, 0.5)), knob: hitAt(0.35, new Vector3(0, 1.2, 0.5)), button: hitAt(0.35, new Vector3(1.5, 1.2, 0.5)) },
    glows,
    line,
    at: { lever: new Vector3(-1.4, 1.9, 0.5), knob: new Vector3(0, 1.3, 0.5), button: new Vector3(1.5, 1.4, 0.5), mimic: new Vector3(0, 5.2, -5.8), window: new Vector3(6.6, 3.2, -4.9), supervisor: new Vector3(-2.5, 1.35, 0.7) },
  };
}
