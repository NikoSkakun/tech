/**
 * Kit parade (development chapter): themed islands assembled from `@/kit`, plus a studio turntable that can
 * show any catalogue model — `window.__kit.show(id)` is what the QA thumbnail script drives.
 */
import { Box3, Group, Vector3, type Mesh } from 'three';
import { defineScene } from '@/engine/api';
import type { EnvPresetName } from '@/style';
import { Builder, type KitModel } from '@/kit';
import { CATALOG } from './parts/catalog';
import { buildGrid } from './parts/island-grid';
import { buildIndustry } from './parts/island-industry';
import { buildMachines } from './parts/island-machines';
import { buildRenewables } from './parts/island-renewables';
import { buildTown } from './parts/island-town';
import type { Parade } from './parts/parade';

interface KitDebug {
  /** Catalogue ids, optionally of one set. */
  ids(set?: string): string[];
  show(
    id: string,
    o?: { night?: number; az?: number; el?: number; zoom?: number; env?: EnvPresetName },
  ): { id: string; triangles: number; drawCalls: number; size: number[] };
}

declare global {
  interface Window {
    __kit?: KitDebug;
  }
}

const STUDIO_RADIUS = 8;

function disposeTree(group: Group): void {
  group.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
  });
}

export default defineScene(async (ctx) => {
  const { root, stage, camera } = ctx;

  /* ------------------------------------------------------------------------------ studio turntable */
  const studio = new Group();
  studio.name = 'studio';
  root.add(studio);
  const pb = new Builder('plinth');
  pb.cyl(1, 0.05, { c: ['violet.light', 'mist'], seg: 72, bevel: 0.012, at: [0, -0.05, 0], slot: 'matte' });
  pb.cyl(1.05, 0.06, { c: ['bg.plum', 'violet.dark'], seg: 72, bevel: 0.015, at: [0, -0.11, 0], slot: 'matte' });
  const plinth = pb.build().group;
  studio.add(plinth);

  let current: KitModel | null = null;
  const size = new Vector3();
  const centre = new Vector3();
  const show: KitDebug['show'] = (id, o = {}) => {
    const entry = CATALOG.find((e) => e.id === id);
    if (!entry) throw new Error(`unknown catalogue id "${id}"`);
    if (current) {
      studio.remove(current.group);
      disposeTree(current.group);
    }
    current = entry.make(ctx);
    current.night = o.night ?? 0;
    studio.scale.setScalar(1);
    studio.add(current.group);
    studio.updateMatrixWorld(true);
    const box = new Box3().setFromObject(current.group);
    box.getSize(size);
    box.getCenter(centre);
    plinth.visible = !entry.bare;
    plinth.scale.setScalar(Math.max(size.x, size.z) * 0.72 + Math.hypot(size.x, size.y, size.z) * 0.06);
    // Kit models are authored in metres; the engine's fog / DOF / AO defaults assume a subject of ~10 units,
    // so the studio (like every diorama chapter) scales its world group instead of retuning the environment.
    const r = STUDIO_RADIUS;
    const focus = entry.view?.focus;
    if (focus) current.anchorWorld(focus.anchor, centre);
    const k = r / (focus ? focus.radius : 0.5 * Math.hypot(size.x, size.y, size.z));
    studio.scale.setScalar(k);
    centre.multiplyScalar(k);
    ctx.env.setShadow({ extent: r * 1.25, center: [centre.x, centre.y, centre.z], softness: 3 });
    ctx.env.set(o.env ?? 'day', { duration: 0 });
    const az = (((o.az ?? entry.view?.az ?? 35) * Math.PI) / 180) as number;
    const el = ((o.el ?? entry.view?.el ?? 22) * Math.PI) / 180;
    const dist = (r / Math.sin((15 * Math.PI) / 180)) * (1.02 / (o.zoom ?? entry.view?.zoom ?? 1.3));
    camera.go(
      {
        position: [
          centre.x + Math.sin(az) * Math.cos(el) * dist,
          centre.y + Math.sin(el) * dist,
          centre.z + Math.cos(az) * Math.cos(el) * dist,
        ],
        target: [centre.x, centre.y, centre.z],
        fov: 30,
        frameAspect: 1.3,
        drift: 0,
        orbit: { azimuth: 3.2, polar: 0.7, zoom: [0.25, 2.5] },
      },
      { duration: 0 },
    );
    return { id, triangles: current.triangles, drawCalls: current.drawCalls, size: size.toArray() };
  };
  window.__kit = { ids: (set) => CATALOG.filter((e) => !set || e.set === set).map((e) => e.id), show };
  ctx.onDispose(() => delete window.__kit);

  /* --------------------------------------------------------------------------------- parade islands */
  const islands: Record<string, Parade> = {};
  const builders = { town: buildTown, industry: buildIndustry, grid: buildGrid, renewables: buildRenewables, machines: buildMachines };
  let done = 0;
  for (const [name, build] of Object.entries(builders)) {
    const parade = build(ctx);
    islands[name] = parade;
    root.add(parade.group);
    ctx.progress(++done / 5);
    await ctx.breathe();
  }
  const actors = Object.fromEntries(Object.entries(islands).map(([name, p]) => [name, stage.actor(p.group)]));
  const aStudio = stage.actor(studio);
  stage.param('night', 0, {
    duration: 1.6,
    onChange: (v) => {
      for (const p of Object.values(islands)) p.night = v;
    },
  });

  ctx.env.setScale(STUDIO_RADIUS + 2);
  ctx.env.setShadow({ extent: 14, center: [0, 0, 0], softness: 3 });
  ctx.post.base({ aoRadius: 0.45, dofAperture: 0.5, tiltAmount: 0.22 });
  const orbit = { azimuth: 3.2, polar: 0.5, zoom: [0.35, 1.6] as [number, number] };
  camera.shots({
    wide: { position: [11, 7.5, 25], target: [0, -0.6, 0], fov: 30, orbit },
    industry: { position: [-14, 8, 27], target: [0, 1.6, 0], fov: 30, orbit },
    grid: { position: [-16, 8, 21], target: [0, 0, 0], fov: 30, orbit },
    renewables: { position: [11, 7.5, 28], target: [0, 1.8, 0], fov: 30, orbit },
    machines: { position: [7, 5.6, 14.5], target: [0, 0.5, 0.6], fov: 30, orbit },
    dusk: { position: [15, 4.5, 17], target: [3.5, 0.3, 2], fov: 30, orbit },
    night: { position: [17, 6, 19], target: [1, 0, 1], fov: 30, orbit },
    studio: { position: [12, 8, 26], target: [0, 0, 0], fov: 30 },
  });
  const studioPost = { dofAperture: 0.2, tiltAmount: 0.04, aoRadius: 0.4 };
  stage.define({
    town: { show: [actors.town!], camera: 'wide' },
    industry: { show: [actors.industry!], camera: 'industry' },
    grid: { show: [actors.grid!], camera: 'grid' },
    renewables: { show: [actors.renewables!], camera: 'renewables' },
    machines: { show: [actors.machines!], camera: 'machines', post: { tiltAmount: 0.1 } },
    dusk: { show: [actors.town!], camera: 'dusk', env: 'dusk', params: { night: 1 }, post: { bloomIntensity: 1.1 } },
    night: { show: [actors.grid!], camera: 'night', env: 'night', params: { night: 1 }, post: { bloomIntensity: 1.15 } },
    studio: { show: [aStudio], camera: 'studio', post: studioPost },
  });

  return {
    enterStep(stepId) {
      if (stepId === 'studio') {
        if (!current) show(CATALOG[0]!.id);
        return;
      }
      // the studio refits the shadow frustum to each model; the islands share one setup
      ctx.env.setShadow({ extent: 14, center: [0, 0, 0], softness: 3 });
    },
    update(dt, t) {
      current?.update(dt, t);
      for (const p of Object.values(islands)) if (p.group.visible) p.update(dt, t);
    },
  };
});
