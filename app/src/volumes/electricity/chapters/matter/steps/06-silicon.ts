/**
 * Step 6 `silicon` — electrons and holes. The real diamond-type lattice turns and flattens into the planar
 * scheme (10×8 atoms, two electrons per bond). Heat tears electrons out of bonds at the rate of §6 (∝ n_i(T)),
 * «Посвітити» sends photons that make a pair each, the field separates the carriers, and a hole can be dragged:
 * the cursor makes the neighbouring bond electrons jump into it one after another.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';

import { createPhotons, createVectorArrow } from '@/fx';
import { SEMANTIC } from '@/style';
import { SILICON, siliconIntrinsic } from '@electricity/sim/matter';
import { sci } from '../fmt';
import type { StepFactory } from '../chapter';
import { group } from '../chapter';
import { docLabel } from '../content';
import { DOC, L } from '../labels';
import { createDiamond } from '../parts/diamond';
import { COLS, createSiSheet, ROWS, SPACING } from '../parts/si-sheet';
import { HERO_Y } from '../world';

const ID = 'silicon';
const PHOTONS = 5;
const FLIGHT_S = 0.9;
/** Opening pairs: fixed bonds so that the first frame already shows electrons and holes. */
const START_SLOTS = [37, 88, 131, 190, 222];

export const siliconStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const set = group(`set:${ID}`, 0, HERO_Y + 0.5, 0);
  lab.stand.add(set);
  const sheet = createSiSheet(ctx);
  const diamond = createDiamond();
  const arrows = new Group();
  for (const k of [-1, 1]) {
    const a = createVectorArrow({ color: SEMANTIC.fieldE });
    a.position.set(k < 0 ? -2.3 : 0.9, (ROWS / 2) * SPACING + 0.05, 0.55);
    a.set(new Vector3(), new Vector3(1.4, 0, 0));
    a.scale.setScalar(1);
    arrows.add(a);
  }
  const photons = createPhotons({ count: PHOTONS, color: 'yellow', length: 0.7, amplitude: 0.08 });
  set.add(sheet.group, diamond.group, arrows, photons);
  ctx.stage.actor(diamond.group);
  ctx.stage.actor(arrows);

  const kelvin = (): number => ui.value<number>('T6');
  const model = (): ReturnType<typeof siliconIntrinsic> => siliconIntrinsic(kelvin());
  let acc = 0;
  const flights: { slot: number; age: number; from: Vector3 }[] = [];
  const shine = (): void => {
    audio.play('whooshUp', { gain: 0.5 });
    for (let k = 0; k < PHOTONS; k++) {
      const slot = sheet.slotNear(
        new Vector3(-2.2 + 1.1 * k + ctx.random.next() * 0.4, -1.2 + ctx.random.next() * 2.4, 0),
        (s) => sheet.slots[s]!.filled,
      );
      flights.push({ slot, age: -0.18 * k, from: new Vector3(-3.6 + 0.9 * k, 3.2, 1.8) });
    }
  };
  ui.onChange('field6', (on) => {
    audio.play('toggle');
    sheet.field = on ? 1 : 0;
    if (lab.isCurrent(ID)) ctx.stage.toggle(arrows, on as boolean);
  });

  // drag a hole: the bond electron next to the cursor jumps in, the hole moves to where it was
  let dragged = -1;
  const normal = new Vector3(0, 0, 1);
  const hit = new Vector3();
  const local = new Vector3();
  const pointer = (e: { planePoint(n: Vector3, p: Vector3, out: Vector3): Vector3 | null }): boolean => {
    if (!e.planePoint(normal, set.getWorldPosition(local), hit)) return false;
    set.worldToLocal(local.copy(hit));
    return true;
  };
  ctx.input.register(sheet.holeOrbs, {
    tooltip: L.si.drag,
    cursor: 'grab',
    enabled: () => lab.isCurrent(ID),
    dragStart: (e) => {
      if (!pointer(e)) return;
      let best = -1;
      sheet.holes.forEach((s, h) => {
        if (
          best < 0 ||
          sheet.slots[s]!.pos.distanceToSquared(local) <
            sheet.slots[sheet.holes[best]!]!.pos.distanceToSquared(local)
        )
          best = h;
      });
      dragged = best;
      audio.play('click');
    },
    drag: (e) => {
      if (dragged < 0 || !pointer(e) || sheet.hops.length > 1) return;
      const at = sheet.slots[sheet.holes[dragged]!];
      if (!at) return;
      let best = -1;
      for (const n of at.near) {
        const o = sheet.slots[n]!;
        if (
          o.filled &&
          (best < 0 || o.pos.distanceToSquared(local) < sheet.slots[best]!.pos.distanceToSquared(local))
        )
          best = n;
      }
      if (
        best >= 0 &&
        sheet.slots[best]!.pos.distanceToSquared(local) < at.pos.distanceToSquared(local) - 0.02
      ) {
        sheet.hopHole(dragged, best);
        audio.play('tick', { pitch: 1.5, gain: 0.4 });
      }
    },
    dragEnd: () => (dragged = -1),
  });

  const v = new Vector3();
  const firstHole = (): Vector3 => {
    const s = sheet.holes[0];
    return set.localToWorld(
      v.copy(s !== undefined ? sheet.slots[s]!.pos : sheet.slots[START_SLOTS[0]!]!.pos),
    );
  };
  // a fixed bond (stable across runs); the live hole position is in the exposed state
  ctx.qa.probe('bond6', () => set.localToWorld(v.copy(sheet.slots[START_SLOTS[0]!]!.pos)));
  ctx.qa.probe('sheet6', sheet.group);
  ctx.qa.expose(ID, () => ({
    holes: sheet.holes.length,
    free: sheet.free.length,
    holeSlots: [...sheet.holes],
    hole: sheet.holes.length ? firstHole().toArray() : null,
    hops: sheet.hops.length,
    field: sheet.field,
    flat: diamond.flat,
    niPerCm3: model().niPerCm3,
    rhoOhmM: model().resistivityOhmM,
    pairRate: model().pairRatePerS,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.9, HERO_Y + 1.9, 11.6],
        target: [0, HERO_Y + 0.45, 0],
        fov: 32,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0, HERO_Y + 0.5, 0], radius: 3.6 },
      },
    },
    stage: {
      show: [sheet.group, diamond.group, arrows, photons],
      enter(info) {
        flights.length = 0;
        sheet.free.length = 0;
        sheet.holes.length = 0;
        sheet.hops.length = 0;
        for (const s of sheet.slots) s.filled = true;
        for (const s of START_SLOTS) sheet.generate(s, false);
        sheet.field = ui.value<boolean>('field6') ? 1 : 0;
        ctx.stage.toggle(arrows, sheet.field > 0, { instant: true });
        if (info.instant) {
          diamond.flat = 1;
          sheet.bonds = 1;
          ctx.stage.toggle(diamond.group, false, { instant: true });
          return;
        }
        // the real lattice first, then it flattens into the planar scheme
        diamond.flat = 0;
        sheet.bonds = 0;
        ctx.stage.toggle(diamond.group, true, { instant: true });
        info.scope.to(diamond, { flat: 1 }, { duration: 1.6, delay: 1.4, ease: 'power2.inOut' });
        info.scope.delay(3.0, () => ctx.stage.toggle(diamond.group, false));
        info.scope.to(sheet, { bonds: 1 }, { duration: 0.8, delay: 2.8 });
      },
    },
    ui: {
      honesty: [{ text: DOC.planar }, 'notToScale'],
      controls: [
        {
          type: 'slider',
          id: 'T6',
          label: docLabel(ID, 0),
          ...SILICON.temperatureRange,
          value: SILICON.temperatureRange.default,
          unit: 'K',
          digits: 0,
        },
        { type: 'toggle', id: 'field6', label: docLabel(ID, 2), value: false },
        {
          type: 'stats',
          id: 'out6',
          items: [
            { label: L.si.ni, get: () => `${sci(model().niPerCm3, 1)} cm⁻³` },
            { label: L.si.rho, get: () => `${sci(model().resistivityOhmM, 1)} Ω·m` },
          ],
        },
        { type: 'button', id: 'light6', label: docLabel(ID, 1), icon: 'star', primary: true, onClick: shine },
      ],
      callouts: [
        {
          anchor: firstHole,
          text: L.si.hole,
          color: 'coral',
          side: 'up',
          visible: () => sheet.holes.length > 0 && sheet.bonds > 0.9,
        },
        {
          anchor: () => set.localToWorld(v.copy(sheet.free[0]?.pos ?? sheet.slots[0]!.pos)),
          text: L.si.free,
          color: SEMANTIC.electron,
          side: 'down',
          visible: () => sheet.free.length > 0 && sheet.bonds > 0.9,
        },
        {
          anchor: () => set.localToWorld(v.copy(sheet.slots[251]!.pos)),
          text: L.si.bond,
          side: 'right',
          visible: () => sheet.bonds > 0.9,
        },
      ],
      hotspots: [
        { anchor: () => firstHole().add(new Vector3(0.35, 0.3, 0)), content: 'hole' },
        {
          anchor: () => set.localToWorld(v.set(-(COLS / 2) * SPACING, (ROWS / 2) * SPACING, 0)),
          content: '3d-lattice',
        },
      ],
    },
    update(dt, t) {
      acc += model().pairRatePerS * dt;
      if (acc >= 1 && sheet.bonds > 0.9) {
        acc -= 1;
        if (sheet.generate() >= 0) audio.play('tick', { pitch: 1.8, gain: 0.3 });
      }
      for (let k = flights.length - 1; k >= 0; k--) {
        const f = flights[k]!;
        f.age += dt;
        if (f.age >= FLIGHT_S) {
          sheet.generate(f.slot);
          audio.play('spark', { gain: 0.3, pitch: 1.6 });
          flights.splice(k, 1);
        }
      }
      for (let k = 0; k < PHOTONS; k++) {
        const f = flights[k];
        if (!f || f.age < 0) {
          photons.setPhoton(k, [0, 0, 0], [1, 0, 0], 0, 0);
          continue;
        }
        const to = sheet.slots[f.slot]!.pos;
        v.lerpVectors(f.from, to, f.age / FLIGHT_S);
        const d = to.clone().sub(f.from).normalize();
        photons.setPhoton(k, [v.x, v.y, v.z], [d.x, d.y, d.z], t * 6, 1);
      }
      photons.commit();
      sheet.update(dt, t);
      diamond.update(t);
      lab.live.crackle = 0.25;
      lab.live.crackleRate = Math.min(model().pairRatePerS / 6, 1);
    },
  };
};
