/**
 * Step 1 «energy in → energy out» (the misconception frame of the script: no island glows from nothing). A stream
 * of blobs in the colour of each island's primary energy (the Sankey form colours of step 3) arcs in from beyond
 * the island and lands on its plant; what leaves is the island's own yellow line to the world ring. One flow per
 * island (one draw call each, no halo); built once at the archipelago layout (step 1 is never in the gallery pose).
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import type { ColorLike } from '@/style';
import { PLANT_IDS, type PlantId } from '../plants-data';
import type { Archipelago } from './archipelago';
import { FORM_COLOR, type Form } from './sankey';

/** Primary energy of each island (script, step 1 text 2). */
const PRIMARY: Record<PlantId, Form> = {
  coal: 'chemical', gas: 'gas', nuclear: 'nuclear', hydro: 'potential', wind: 'kinetic',
  solar: 'radiant', geoBio: 'thermal', ocean: 'potential', future: 'hydrogen',
};

export interface Inflow {
  group: Group;
  flows: Record<PlantId, Flow>;
}

export function createInflow(ctx: ChapterContext, arch: Archipelago): Inflow {
  const group = new Group();
  group.name = 'energy-inflow';
  const flows = {} as Record<PlantId, Flow>;
  for (const id of PLANT_IDS) {
    const s = arch.sats[id];
    const c = s.group.getWorldPosition(new Vector3());
    const top = arch.satTop(id, new Vector3());
    const out = new Vector3(c.x, 0, c.z).normalize();
    const path = new CatmullRomCurve3([
      c.clone().addScaledVector(out, 62).add(new Vector3(0, 48, 0)),
      c.clone().addScaledVector(out, 30).add(new Vector3(0, 26, 0)),
      top.clone().addScaledVector(out, 6).add(new Vector3(0, 4, 0)),
      top.clone().add(new Vector3(0, -1.5, 0)),
    ]);
    const color: ColorLike = FORM_COLOR[PRIMARY[id]];
    const f = createFlow(ctx, { kind: 'blob', color, paths: [{ path }], count: 20, radius: 2.1, speed: 12, spread: 1.6, halo: false });
    flows[id] = f;
    group.add(f);
  }
  return { group, flows };
}
