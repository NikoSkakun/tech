/**
 * The big toy multimeter of step 9: `amber` rubber bumper, LCD (overlay tag fed by the simulated meter), rotary
 * mode dial, four jacks (COM · V Ω · mA · 10 A), the mA fuse behind a little window, and two probes on cables
 * — `red` and `ink` (black). Probes are free objects in set space: the step moves them (drag / snap to a
 * terminal), the cables follow. The red lead plugs into the jack the mode needs.
 */
import { CatmullRomCurve3, Group, Mesh, TubeGeometry, Vector3, type Object3D } from 'three';
import { damp } from '@/engine/api';
import { Builder } from '@/kit';
import { K, type ColorLike } from '@/style';
import type { Text3D } from '@/text';
import type { MeterMode } from '@electricity/sim/current';
import { tag } from '../world';

export interface Probe {
  group: Group;
  /** Where the tip should be (set space); the probe eases there. */
  target: Vector3;
  held: boolean;
}

export interface Multimeter {
  /** Body on its stand (set space). */
  group: Group;
  /** Probes and cables (same space as `group`'s parent). */
  leads: Group;
  red: Probe;
  black: Probe;
  com: Object3D;
  fuse: Object3D;
  lcd: Object3D;
  mode: MeterMode;
  fuseBlown: boolean;
  /** LCD text. */
  text: string;
  update(dt: number, t: number): void;
}

const MODES: readonly MeterMode[] = ['off', 'vdc', 'vac', 'ohm', 'ma', 'a10'];
const TILT = -0.95; // the body leans back on its stand
const JACK_X = { com: -0.5, v: -0.17, ma: 0.17, a10: 0.5 } as const;

function probe(color: ColorLike): Probe {
  const b = new Builder('probe');
  b.cyl(0.018, 0.3, { seg: 8, slot: 'metal', c: 'mist' }); // tip (origin = the point that touches)
  b.cyl(0.075, 0.7, { at: [0, 0.28, 0], seg: 16, slot: 'gloss', c: color, bevel: 0.03 });
  b.cyl(0.1, 0.05, { at: [0, 0.4, 0], seg: 16, c: color });
  const g = b.build().group;
  g.rotation.set(0.25, 0, -0.2);
  return { group: g, target: new Vector3(), held: false };
}

export function createMultimeter(): Multimeter {
  const b = new Builder('multimeter');
  b.box(1.5, 0.9, 0.6, { at: [0, 0, -0.75], r: 0.08, c: ['ink', 'slate'] }); // stand
  b.frame({ at: [0, 0.12, 0.35], rot: [TILT, 0, 0] }, () => {
    b.box(1.7, 2.6, 0.34, { r: 0.14, slot: 'gloss', c: ['amber.dark', 'amber'] }); // bumper
    b.box(1.46, 2.36, 0.06, { at: [0, 0.12, 0.17], r: 0.08, c: 'ink' });
    b.box(1.2, 0.56, 0.03, { at: [0, 1.82, 0.2], r: 0.05, c: 'bg.deep' }); // LCD
    b.cyl(0.44, 0.05, { at: [0, 1.12, 0.2], axis: 'z', seg: 40, c: 'slate' }); // dial well
    MODES.forEach((_, k) => {
      const a = Math.PI / 2 + 1.75 - k * 0.7;
      b.box(0.05, 0.1, 0.02, {
        at: [Math.cos(a) * 0.55, 1.12 + Math.sin(a) * 0.55 - 0.05, 0.2],
        rot: [0, 0, a - Math.PI / 2],
        r: 0,
        c: k === 0 ? 'mist' : 'yellow',
      });
    });
    const knob = b.part('knob', { at: [0, 1.12, 0.25] });
    knob.cyl(0.34, 0.12, { axis: 'z', seg: 32, slot: 'gloss', c: 'slate', bevel: 0.03 });
    knob.box(0.07, 0.56, 0.06, { at: [0, -0.28, 0.12], r: 0.02, c: 'white' });
    knob.box(0.05, 0.14, 0.02, { at: [0, 0.14, 0.18], r: 0, c: 'coral' }); // pointer end
    for (const [name, x] of Object.entries(JACK_X)) {
      b.ring(0.085, 0.03, { at: [x, 0.36, 0.21], axis: 'z', seg: 20, c: name === 'com' ? 'white' : 'coral' });
      b.cyl(0.06, 0.03, { at: [x, 0.36, 0.2], axis: 'z', seg: 16, c: 'bg.deep' });
      b.anchor(`jack.${name}`, x, 0.36, 0.26);
    }
    b.box(0.3, 0.12, 0.04, { at: [0.52, 0.62, 0.2], r: 0.03, slot: 'glass' }); // fuse window
    b.anchor('fuse', 0.52, 0.68, 0.24).anchor('lcd', 0, 2.1, 0.24).anchor('com', JACK_X.com, 0.36, 0.3);
  });
  const model = b.build();
  const knob = model.part('knob');
  const lcd: Text3D = tag('', 26, 'lime', 'mono');
  model.anchor('lcd').add(lcd);
  const fuseMat = K.glow({ color: 'mist', intensity: 0.8, falloff: 0, whiten: 0 });
  const fuseWire = new Mesh(
    new TubeGeometry(new CatmullRomCurve3([new Vector3(-0.1, 0, 0), new Vector3(0.1, 0, 0)]), 2, 0.012, 6),
    fuseMat,
  );
  model.anchor('fuse').add(fuseWire);

  const leads = new Group();
  leads.name = 'meter-leads';
  const red = probe('red');
  const black = probe('ink');
  const cableMat = { red: K.toon({ color: 'red', gloss: 0.3 }), black: K.toon({ color: 'ink', rim: 1.2 }) };
  const cables = {
    red: new Mesh(new TubeGeometry(), cableMat.red),
    black: new Mesh(new TubeGeometry(), cableMat.black),
  };
  leads.add(red.group, black.group, cables.red, cables.black);
  const plug = new Vector3(JACK_X.v, 0, 0);
  const a = new Vector3();
  const tip = new Vector3();
  const key = { red: '', black: '' };
  /** Hanging cable from a jack (world of `leads`) to the top of a probe. */
  const cable = (which: 'red' | 'black', jack: Object3D, p: Probe): void => {
    leads.worldToLocal(jack.getWorldPosition(a));
    tip.set(0, 0.98, 0).applyEuler(p.group.rotation).add(p.group.position);
    const k = `${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)},${tip.x.toFixed(3)},${tip.y.toFixed(3)},${tip.z.toFixed(3)}`;
    if (k === key[which]) return;
    key[which] = k;
    const mid = a.clone().lerp(tip, 0.5);
    mid.y = Math.min(a.y, tip.y) * 0.35 + 0.08; // sag toward the table
    mid.z += 0.5;
    cables[which].geometry.dispose();
    cables[which].geometry = new TubeGeometry(
      new CatmullRomCurve3([a.clone(), mid, tip.clone()], false, 'centripetal'),
      28,
      0.03,
      8,
    );
  };
  let jackX: number = JACK_X.v;
  let text = '';
  const jackRed = model.anchor('jack.v');
  const self: Multimeter = {
    group: model.group,
    leads,
    red,
    black,
    com: model.anchor('com'),
    fuse: model.anchor('fuse'),
    lcd: model.anchor('lcd'),
    mode: 'vdc',
    fuseBlown: false,
    get text() {
      return text;
    },
    set text(v: string) {
      if (v !== text) lcd.text = text = v;
    },
    update(dt) {
      knob.rotation.z = damp(knob.rotation.z, 1.75 - MODES.indexOf(self.mode) * 0.7, 12, dt);
      // the red lead moves to the jack the mode needs: V Ω, mA or 10 A
      const want = self.mode === 'ma' ? JACK_X.ma : self.mode === 'a10' ? JACK_X.a10 : JACK_X.v;
      jackX = damp(jackX, want, 10, dt);
      jackRed.position.x = jackX;
      plug.x = jackX;
      for (const p of [red, black]) {
        const k = p.held ? 40 : 10;
        p.group.position.x = damp(p.group.position.x, p.target.x, k, dt);
        p.group.position.y = damp(p.group.position.y, p.target.y + (p.held ? 0.3 : 0), k, dt);
        p.group.position.z = damp(p.group.position.z, p.target.z, k, dt);
      }
      cable('red', jackRed, red);
      cable('black', self.com, black);
      fuseMat.intensity = self.fuseBlown ? 0.05 : 0.8;
      fuseWire.scale.x = self.fuseBlown ? 0.35 : 1;
    },
  };
  return self;
}
