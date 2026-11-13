/**
 * The gallery turntable (step 8): a low round platform with `n` pedestals on a circle of radius `r`, a rim of small
 * lights, and an invisible disc proxy to grab and spin it. `setFade(v)` fades the platform out for the true-scale row.
 */
import { CylinderGeometry, Group, type Mesh } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder } from '@/kit';
import { col } from '@/style';
import { pickBox } from '../world';

export function createTurntable(_ctx: ChapterContext, r: number, n: number): { group: Group; proxy: Mesh; top: number; setFade(v: number): void } {
  const b = new Builder('turntable');
  b.cyl(r + 1.3, 0.22, { seg: 72, slot: 'gloss', c: [col('bg.indigo'), col('slate').lerp(col('violet'), 0.3)], bevel: 0.08 });
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    b.sphere(0.05, { seg: 8, slot: 'glow', c: i % 3 ? 'violet' : 'cyan', at: [Math.sin(a) * (r + 1.2), 0.2, Math.cos(a) * (r + 1.2)] });
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.cyl(1.25, 0.18, { seg: 48, slot: 'gloss', c: [col('slate'), col('mist').lerp(col('violet'), 0.25)], at: [Math.sin(a) * r, 0.22, Math.cos(a) * r], bevel: 0.06 });
  }
  const model = b.build();
  const proxy = pickBox(2 * (r + 1.3), 0.6, 2 * (r + 1.3), 0, 0.3, 0);
  proxy.geometry.dispose();
  proxy.geometry = new CylinderGeometry(r + 1.3, r + 1.3, 0.6, 40);
  const group = new Group();
  group.add(model.group, proxy);
  return {
    group,
    proxy,
    top: 0.4,
    setFade(v) {
      for (const m of model.mats.list()) (m as unknown as { fade: number }).fade = v;
      model.group.visible = v > 0.01;
      proxy.visible = v > 0.5;
    },
  };
}
