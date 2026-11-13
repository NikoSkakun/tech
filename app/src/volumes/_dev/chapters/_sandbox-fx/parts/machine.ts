/**
 * Stand 7 — machine helpers on a toy generator: the casing opens with an animated cutaway (hatched caps),
 * the fan spins up into a blur disc, the end bell and bearing slide out as an exploded view, the terminal
 * box turns x-ray, the whole machine hums, and the start button carries the affordance outline.
 */
import { BoxGeometry, CapsuleGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, TorusGeometry, Vector2 } from 'three';
import { audio } from '@/audio';
import type { ChapterContext } from '@/engine/api';
import { createCutaway, createExplodedView, createOutline, createSpin, createVibration, createXRay, FxSet } from '@/fx';
import { K } from '@/style';
import type { Exhibit } from './exhibit';

/** Closed lathe profile of a hollow cylinder (outer wall up, inner wall down → watertight shell). */
function shell(rOuter: number, rInner: number, half: number): LatheGeometry {
  const b = 0.06; // bevel
  const pts = [
    [rInner, -half], [rOuter - b, -half], [rOuter, -half + b], [rOuter, half - b], [rOuter - b, half], [rInner, half], [rInner, -half],
  ].map(([r, y]) => new Vector2(r, y));
  return new LatheGeometry(pts, 64);
}

export function createMachineExhibit(ctx: ChapterContext): Exhibit {
  const group = new Group();
  group.name = 'exhibit:machine';
  const machine = new Group(); // machine axis = local Y of this group, laid along world X
  machine.rotation.z = -Math.PI / 2;
  machine.position.set(0, 1.9, 0);
  group.add(machine);
  const cast = <T extends Mesh>(m: T): T => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // casing + stator are cut; the rotor stays whole inside
  const casing = cast(new Mesh(shell(1.25, 1.05, 1.5), K.toon({ color: 'blue', gloss: 0.3 })));
  const stator = new Group();
  for (const y of [-0.9, -0.3, 0.3, 0.9]) {
    const ring = cast(new Mesh(new TorusGeometry(0.88, 0.17, 20, 64), K.toon({ color: 'coral' })));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    stator.add(ring);
  }
  const rotor = cast(new Mesh(new CylinderGeometry(0.55, 0.55, 2.3, 48), K.metal({ color: 'amber' })));
  const shaft = cast(new Mesh(new CylinderGeometry(0.13, 0.13, 5.2, 24), K.metal({ color: 'steel' })));
  const spinning = new Group();
  spinning.add(rotor, shaft);
  machine.add(casing, stator, spinning);
  const cut = createCutaway({ normal: [0, 0, 1], offset: 1.4, capColor: 'blue.dark', hatch: 8 });
  cut.apply(casing).apply(stator);
  ctx.onDispose(() => cut.dispose());

  // fan on the shaft end with a blur disc
  const fan = new Group();
  const bladeMaterial = K.toon({ color: 'mist' });
  for (let i = 0; i < 5; i++) {
    const blade = cast(new Mesh(new BoxGeometry(0.34, 0.05, 0.95), bladeMaterial));
    blade.position.set(Math.sin((i / 5) * Math.PI * 2) * 0.62, 0, Math.cos((i / 5) * Math.PI * 2) * 0.62);
    blade.rotation.set(0.35, (i / 5) * Math.PI * 2, 0, 'YXZ');
    fan.add(blade);
  }
  fan.add(cast(new Mesh(new CylinderGeometry(0.22, 0.22, 0.2, 24), K.metal({ color: 'steel' }))));
  fan.position.y = 2.25;
  machine.add(fan);
  const fx = new FxSet();
  const fanSpin = fx.add(createSpin(fan, { axis: 'y', radius: 1.1, innerRadius: 0.2, blades: 5, color: 'mist', fade: [bladeMaterial] }));
  const rotorSpin = fx.add(createSpin(spinning, { axis: 'y' }));

  // exploded view: end bell and bearing slide out along the axis
  const bell = cast(new Mesh(shell(1.25, 0.3, 0.1), K.toon({ color: 'blue.light', gloss: 0.3 })));
  bell.position.y = -1.62;
  const bearing = cast(new Mesh(new TorusGeometry(0.24, 0.09, 16, 32), K.metal({ color: 'steel' })));
  bearing.rotation.x = Math.PI / 2;
  bearing.position.y = -1.62;
  machine.add(bell, bearing);
  const exploded = createExplodedView([
    { object: bell, axis: [0, -1, 0], distance: 1.3 },
    { object: bearing, axis: [0, -1, 0], distance: 0.65, delay: 0.3 },
  ]);

  // terminal box (x-ray) with terminals inside, base, and a start button with the affordance outline
  const box = cast(new Mesh(new BoxGeometry(0.9, 0.55, 0.8), K.toon({ color: 'slate' })));
  box.position.set(0.3, 3.4, 0);
  for (const dx of [-0.22, 0, 0.22]) {
    const terminal = new Mesh(new CapsuleGeometry(0.06, 0.2, 6, 12), K.glow({ color: ['yellow', 'green', 'red'][Math.round(dx / 0.22) + 1]!, intensity: 1.6 }));
    terminal.position.set(0.3 + dx, 3.4, 0);
    group.add(terminal);
  }
  const xray = createXRay(box, { color: 'sky' });
  const base = cast(new Mesh(new BoxGeometry(3.4, 0.5, 2.0), K.toon({ color: 'slate' })));
  base.position.set(0, 0.25, 0);
  const button = cast(new Mesh(new CylinderGeometry(0.28, 0.32, 0.22, 32), K.toon({ color: 'green', gloss: 0.6 })));
  button.position.set(3.2, 0.11, 1.2);
  group.add(box, base, button);
  const outline = createOutline(button, { width: 4 });
  const hum = fx.add(createVibration(machine, { amplitude: 0.006, reducedMotion: ctx.reducedMotion }));
  const state = { hover: 0 };
  ctx.input.register(button, { tooltip: 'Start — пуск', hover: (over) => ctx.tweens.to(state, { hover: over ? 1 : 0 }, { duration: 0.12 }) });

  return {
    group,
    update(dt, t) {
      // one 16 s cycle: spin up → open the casing → explode the end bell → close everything again
      const c = (t % 16) / 16;
      const ramp = (a: number, b: number): number => Math.min(Math.max((c - a) / (b - a), 0), 1);
      const run = ramp(0.02, 0.3) * (1 - ramp(0.9, 1));
      fanSpin.rpm = 900 * run;
      rotorSpin.rpm = 60 * run;
      hum.amount = run;
      audio.loop('turbine').set({ gain: 0.4 * run, pitch: 0.5 + run });
      audio.loop('hum').set({ gain: 0.25 * run });
      cut.offset = 1.4 - 1.4 * (ramp(0.25, 0.45) - ramp(0.85, 0.97));
      exploded.amount = ramp(0.45, 0.6) - ramp(0.75, 0.88);
      xray.amount = ramp(0.3, 0.42) - ramp(0.8, 0.92);
      outline.amount = 0.75 + 0.25 * state.hover;
      outline.setSelected(state.hover > 0.5);
      fx.update(dt, t);
    },
  };
}
