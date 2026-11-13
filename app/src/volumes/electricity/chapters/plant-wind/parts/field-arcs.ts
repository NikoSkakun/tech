/**
 * Step 6 «лінії поля B»: flux loops between neighbouring permanent magnets of a PMSG rotor, drawn as
 * `magenta` field ribbons (the course colour of **B**) whose chevrons run from every N pole to the S poles
 * beside it. The ribbons are parented to the rotor part, so they turn with the magnets.
 */
import { Vector3, type Object3D } from 'three';
import { RibbonLines } from '@/fx';
import { SEMANTIC } from '@/style';

export function addFieldArcs(rotor: Object3D, radius: number, z: number, poles: number): RibbonLines {
  const steps = 9;
  const lines = new RibbonLines({ capacity: poles * (steps + 1), color: SEMANTIC.fieldB, width: 0.05, intensity: 1.5, dashRepeat: 3.2, dashSpeed: 0.5, dashStrength: 0.8, base: 0.3, endFade: [0.1, 0.1] });
  const arcs = [];
  const step = (Math.PI * 2) / poles;
  for (let i = 0; i < poles; i++) {
    // pole i is N for even i (see `magnets` in nacelle-drive.ts): flux leaves N and returns into S
    const from = i % 2 === 0 ? i : i + 1;
    const to = i % 2 === 0 ? i + 1 : i;
    const points: Vector3[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const a = (from + (to - from) * t) * step;
      const r = radius + 0.16 + Math.sin(Math.PI * t) * 0.3;
      points.push(new Vector3(Math.cos(a) * r, Math.sin(a) * r, z));
    }
    arcs.push({ points });
  }
  lines.setLines(arcs);
  lines.fade = 0;
  rotor.add(lines);
  return lines;
}
