/**
 * `inside`: the micro world in front of the slice. `grains` — the reader taps the lens, it lands on the paste and the
 * camera dives in; `atoms` — slider «Глибше» runs the camera's rail from the grains to one grain's edge; `give` —
 * tapped edge atoms leave two electrons and swim off as zinc ions; `take` — an electron carried to an oxide crumb is
 * taken, a lye ion swims out; `touch` — slider «Зсунути» brings zinc and oxide together: sparks across, heat.
 */
import { BoxGeometry, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { defineScene, type Shot } from '@/engine/api';
import { K } from '@/style';
import { goals, runChapter, type StepDef } from '@alkaline/shared/chapter';
import { holdFor, scrubSlider } from '@alkaline/shared/controls';
import { EDGE, SEP, oxideCrumbs } from '@alkaline/shared/micro/layout';
import { minusIons } from '@alkaline/shared/micro/particles';
import { PLANE_Z, createProbe } from '@alkaline/shared/micro/probe';
import { PAIR_AT } from '@alkaline/shared/micro/pair';
import { railShot } from '@alkaline/shared/rail';
import { scrub, glide, smooth } from '@alkaline/shared/scrub';
import { mountBattery } from '@alkaline/shared/world';
import { caption } from './content';

const done = goals('inside');

export default defineScene((ctx) => {
  const w = mountBattery(ctx);
  const { micro } = w;
  const { atoms, field } = micro;
  const shots = micro.shots() as Record<string, Shot>;
  const at = (id: string) => () => ctx.stage.current === id;
  const worldOf = (x: number, y: number, z: number) => () => micro.toWorld(new Vector3(x, y, z));
  const base = (info: { instant: boolean }) =>
    w.reset({ out: 1, spread: 0, lye: 1, cut: 0, life: 0 }, info.instant);
  const edgeMat = field.edgeGrain.material as ReturnType<typeof K.metal>;

  // ---- grains: the lens and the dive
  let lensTarget = 0;
  let dived = false;
  const lensHit = new Mesh(
    new SphereGeometry(0.3, 16, 8),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  micro.lensRing.add(lensHit);
  ctx.qa.probe('lens', micro.lensRing);
  ctx.input.register(lensHit, {
    cursor: 'pointer',
    enabled: () => at('grains')() && lensTarget === 0,
    click: () => void (lensTarget = 1),
  });
  ctx.input.register(w.slice.rings.zinc.mesh, {
    cursor: 'pointer',
    enabled: () => at('grains')() && lensTarget === 0,
    click: () => void (lensTarget = 1),
  });
  const inside = holdFor(1);
  const grains: StepDef = {
    spec: { ...w.state('slice'), params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => done.has('grains'),
      callouts: [
        {
          anchor: micro.lensRing,
          text: caption('grains', 0),
          visible: () => at('grains')() && lensTarget === 0,
        },
        {
          anchor: worldOf(-1.5, 1.2, 1.2),
          text: caption('grains', 1),
          visible: () => at('grains')() && micro.presence > 0.95,
        },
        {
          anchor: worldOf(SEP.to, -3.2, 1),
          text: caption('grains', 2),
          visible: () => at('grains')() && micro.presence > 0.95,
        },
        {
          anchor: worldOf(7.2, 2.6, 1),
          text: caption('grains', 3),
          visible: () => at('grains')() && micro.presence > 0.95,
        },
      ],
    },
    enter: (info) => {
      base(info);
      lensTarget = 0;
      dived = false;
      micro.lens = 0;
      inside.reset();
    },
    leave: () => {
      micro.lensShown = 0;
      micro.lensCall = 0;
    },
    update: (dt) => {
      micro.lensShown = 1;
      micro.lensCall = lensTarget === 0 ? 1 : 0;
      micro.lens = Math.min(1, micro.lens + (lensTarget - micro.lens > 0 ? dt / 0.9 : 0));
      if (micro.lens >= 1 && !dived) {
        dived = true;
        ctx.camera.go('grains', { duration: 3 });
      }
      if (inside.tick(dt, micro.presence > 0.95)) done.add('grains');
    },
  };

  // ---- atoms: the rail from the grains to one grain's edge
  const depth = scrub(0, 0.35);
  let told = -1;
  const deep = holdFor(1);
  const atomsStep: StepDef = {
    spec: { ...w.state('grains'), params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => done.has('atoms'),
      controls: [
        scrubSlider(depth, 'depth', caption('atoms', 0), {
          marks: [
            { value: 0, label: caption('atoms', 1) },
            { value: 1, label: caption('atoms', 2) },
          ],
        }),
      ],
      callouts: [
        {
          anchor: worldOf(EDGE.x - 0.25, EDGE.y + 0.55, EDGE.z + 0.2),
          text: caption('atoms', 3),
          visible: () => at('atoms')() && depth.shown > 0.92,
        },
      ],
    },
    enter: (info) => {
      base(info);
      depth.target = depth.shown = 0;
      told = -1;
      deep.reset();
    },
    update: (dt) => {
      glide(depth, dt);
      if (Math.abs(depth.shown - told) > 1e-4) {
        told = depth.shown;
        ctx.camera.go(railShot(shots.grains!, shots.atoms!, smooth(0, 1, depth.shown)), { instant: true });
      }
      atoms.shown = smooth(0.45, 0.85, depth.shown);
      field.far = 1 - smooth(0.4, 0.8, depth.shown);
      edgeMat.fade = 1 - smooth(0.55, 0.9, depth.shown);
      if (deep.tick(dt, depth.shown > 0.97)) done.add('atoms');
    },
  };

  // ---- give: tapped edge atoms leave
  const patch = new Mesh(
    new BoxGeometry(0.7, 3, 2.2),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  patch.position.set(EDGE.x - 0.1, EDGE.y, EDGE.z);
  field.group.add(patch);
  ctx.qa.probe('edge-atom', () =>
    micro.toWorld(atoms.atomAt(atoms.front[Math.floor(atoms.front.length / 2)] ?? 0, new Vector3())),
  );
  const local = new Vector3();
  ctx.input.register(patch, {
    cursor: 'pointer',
    enabled: () => at('give')(),
    click: (e) => {
      if (!e.point) return;
      atoms.give(atoms.nearest(micro.toLocal(e.point, local), 0.4));
    },
  });
  const firstAtom = new Vector3();
  const give: StepDef = {
    spec: { ...w.state('atoms'), params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => done.has('give'),
      callouts: [
        {
          anchor: () =>
            micro.toWorld(
              atoms.given > 0
                ? atoms.lastIon
                : atoms.atomAt(atoms.front[Math.floor(atoms.front.length / 2)] ?? 0, firstAtom),
            ),
          text: () => (atoms.given > 0 ? caption('give', 1) : caption('give', 0)),
          visible: () => at('give')(),
        },
      ],
    },
    enter: (info) => {
      base(info);
      atoms.reset();
    },
    update: () => {
      atoms.shown = 1;
      field.far = 0;
      edgeMat.fade = 0;
      if (atoms.given >= 3) done.add('give');
    },
  };

  // ---- take: an electron carried to a crumb of the oxide
  const crumbs = oxideCrumbs();
  const crumb = crumbs.reduce((a, c) =>
    Math.hypot(c.x - 6.6, c.y - 0.6) < Math.hypot(a.x - 6.6, a.y - 0.6) ? c : a,
  );
  const probe = createProbe(ctx, micro, 'electron', 'probe-electron');
  probe.home.set(5.4, 3.7, PLANE_Z);
  probe.place(probe.home);
  probe.enabled = () => at('take')() && absorb < 0;
  const freed = minusIons(field.group, 4, 0.24);
  const flashMat = K.glow({ color: 'cyan', intensity: 0, additive: true });
  const flash = new Mesh(new SphereGeometry(1, 16, 8), flashMat);
  flash.position.set(crumb.x, crumb.y, crumb.z + crumb.r * 0.6);
  field.group.add(flash);
  let absorb = -1;
  let taken = 0;
  const ionsOut: number[] = [];
  probe.onDrop = (p) => {
    if (Math.hypot(p.x - crumb.x, p.y - crumb.y) > crumb.r + 1.1) return false;
    absorb = 0;
    return true;
  };
  const take: StepDef = {
    spec: { ...w.state('sep'), params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => done.has('take'),
      callouts: [
        {
          anchor: () => micro.toWorld(probe.at),
          text: caption('take', 0),
          visible: () => at('take')() && probe.shown > 0.5 && absorb < 0,
        },
        {
          anchor: worldOf(crumb.x, crumb.y - crumb.r * 0.7, crumb.z + crumb.r),
          text: caption('take', 1),
          visible: at('take'),
        },
        {
          anchor: () =>
            micro.toWorld(new Vector3(crumb.x - 1.2 - (ionsOut[0] ?? 0) * 1.6, crumb.y + 0.4, PLANE_Z)),
          text: caption('take', 2),
          visible: () => at('take')() && ionsOut.length > 0,
        },
      ],
    },
    enter: (info) => {
      base(info);
      absorb = -1;
      taken = 0;
      ionsOut.length = 0;
      probe.place(probe.home);
    },
    leave: () => {
      probe.shown = 0;
      probe.update(0, 0);
      for (let i = 0; i < 4; i++) freed.put(i, 0, 0, 0, 0);
      freed.commit();
    },
    update: (dt, t) => {
      probe.update(dt, t);
      if (absorb < 0) probe.shown = Math.min(1, probe.shown + dt * 3);
      if (absorb >= 0) {
        absorb += dt;
        probe.at.lerp(new Vector3(crumb.x, crumb.y, crumb.z + crumb.r * 0.5), Math.min(1, dt * 6));
        if (absorb > 0.45 && probe.shown > 0) {
          probe.shown = 0;
          taken++;
          if (ionsOut.length < 4) ionsOut.push(0);
          done.add('take');
        }
        if (absorb > 1.6) {
          absorb = -1;
          probe.place(probe.home);
        }
      }
      flashMat.intensity = 1.4 * (absorb >= 0 ? 0.8 * Math.max(0, 1 - Math.abs(absorb - 0.5) / 0.35) : 0);
      flash.scale.setScalar(crumb.r * 1.1);
      for (let i = 0; i < 4; i++) {
        const age = ionsOut[i];
        if (age === undefined) freed.put(i, 0, 0, 0, 0);
        else {
          ionsOut[i] = age + dt;
          const k = Math.min(1, age / 4);
          freed.put(
            i,
            crumb.x - 0.9 - k * 1.6 - i * 0.3,
            crumb.y + 0.5 + Math.sin(age * 1.3 + i) * 0.3,
            PLANE_Z,
            Math.min(1, age * 3),
          );
        }
      }
      freed.commit();
    },
  };

  // ---- touch: zinc meets oxide, nothing between
  const near = scrub(0, 0.3);
  const touch: StepDef = {
    spec: { ...w.state('pair'), params: { closed: 0, poles: 1 } },
    ui: {
      goal: () => done.has('touch'),
      controls: [scrubSlider(near, 'near', caption('touch', 0))],
      callouts: [
        {
          anchor: () =>
            micro.toWorld(new Vector3(PAIR_AT.x + micro.pair.zinc.position.x - 0.4, PAIR_AT.y + 1.2, 1)),
          text: caption('touch', 1),
          visible: at('touch'),
        },
        {
          anchor: () =>
            micro.toWorld(new Vector3(PAIR_AT.x + micro.pair.oxide.position.x + 0.3, PAIR_AT.y + 0.9, 1)),
          text: caption('touch', 2),
          visible: at('touch'),
        },
        {
          anchor: worldOf(PAIR_AT.x + 0.3, PAIR_AT.y - 0.3, 1.4),
          text: caption('touch', 3),
          visible: () => at('touch')() && micro.pair.heat > 0.4,
        },
      ],
    },
    enter: (info) => {
      base(info);
      near.target = near.shown = 0;
    },
    update: (dt) => {
      glide(near, dt);
      micro.pair.near = near.shown;
      if (near.shown > 0.97 && micro.pair.heat > 0.6) done.add('touch');
    },
  };

  ctx.qa.expose('inside', () => ({
    step: ctx.stage.current,
    presence: micro.presence,
    lens: micro.lens,
    depth: depth.shown,
    given: atoms.given,
    taken,
    near: near.shown,
    heat: micro.pair.heat,
  }));
  return runChapter(
    ctx,
    w,
    { grains, atoms: atomsStep, give, take, touch },
    {
      enter: (id) => {
        // the edge grain is whole and the atoms hidden unless the step shows them
        if (id !== 'atoms' && id !== 'give') {
          atoms.shown = 0;
          field.far = 1;
          edgeMat.fade = 1;
        }
        if (id !== 'grains') micro.lens = 1;
      },
    },
  );
});
