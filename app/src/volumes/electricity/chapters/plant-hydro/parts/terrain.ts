/**
 * The valley island: a floating island whose relief is one height function — a river valley running west →
 * east between a high northern ridge (snow on the peaks) and lower southern hills, closed in the west by
 * mountains; the reservoir basin above the dam, the tailwater pool and river carved below the sea level
 * downstream (the island's sea fills them), and the land sinking under the sea in the east (the bay).
 */
import { GROUND, fbm, island, smoothstep, type Island } from '@/kit';
import { DAM, ISLAND, PSH, SWITCHYARD, TOWN, riverZ } from '../layout';

/** Outline multiplier of an ellipse (semiX, semiZ), relative to semiZ, with a soft wobble. */
function outline(theta: number): number {
  const a = ISLAND.semiX;
  const b = ISLAND.semiZ;
  const r = (a * b) / Math.hypot(b * Math.cos(theta), a * Math.sin(theta));
  return (r / b) * (1 + 0.03 * Math.sin(3 * theta + 0.4) + 0.02 * Math.sin(8 * theta + 1.3));
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Height of the relief (before the island's own gentle undulation), metres. */
export function valleyHeight(x: number, z: number): number {
  const zc = riverZ(x);
  const d = Math.abs(z - zc);
  const north = z < zc;
  const down = smoothstep(DAM.faceX, DAM.toeX, x); // 0 upstream of the dam … 1 below it
  // valley floor: reservoir bed upstream, river plain downstream
  const floor = lerp(12, 6, down);
  // half-width of the flat floor and how far the walls take to rise (steep at the dam: it must close the valley)
  const atDam = 1 - smoothstep(30, 70, Math.abs(x - 16));
  const w = lerp(lerp(50, 66, down), 60, atDam);
  const rise = lerp(70, 34, atDam);
  const ridgeN = 128 + 34 * Math.sin(x / 63 + 0.8) + 18 * Math.cos(x / 29) - 30 * smoothstep(150, 260, x);
  // the southern hills stay low upstream, so the reservoir reads from the south-east camera
  const ridgeS = lerp(62, 38, smoothstep(30, 140, x)) + 6 * Math.sin(x / 41 + 2);
  const top = north ? ridgeN : ridgeS;
  const s = smoothstep(w, w + rise, d);
  // rolling humps on the slopes and summits (no flat mesa tops)
  const humps = (fbm(x / 70, z / 70, 3, 7) - 0.5) * 34 * s;
  let y = floor + (top - floor) * Math.pow(s, 1.3) + humps;
  // western mountains close the reservoir
  // (they peak inside the island and fall toward its rim, so its western edge is not a tall cliff)
  y +=
    124 *
    Math.pow(smoothstep(-165, -238, x), 1.2) *
    (1 - 0.55 * smoothstep(-250, -300, x)) *
    (0.8 + 0.2 * Math.cos(z / 40));
  // tailwater pool below the dam (spillway basin + draft-tube outlets), narrowing into the river channel
  if (x > DAM.toeX - 8) {
    const t = smoothstep(70, 140, x);
    const cz = lerp(-6, zc, t);
    const hw = lerp(62, 16, t);
    const carve = smoothstep(hw, hw + 10, Math.abs(z - cz));
    y = lerp(-2, y, carve);
  }
  // the bay: the land sinks under the sea east of the coast
  y -= 16 / (1 + Math.exp(-(x - ISLAND.coastX) / 10));
  // near the island's rim the relief settles to a low edge: a high rim makes the floating island's side wall a
  // tall cliff, seen edge-on as dark bands in the sky
  const theta = Math.atan2(z, x);
  const rim =
    (ISLAND.semiX * ISLAND.semiZ) /
    Math.hypot(ISLAND.semiZ * Math.cos(theta), ISLAND.semiX * Math.sin(theta));
  const edge = smoothstep(0.8, 0.97, Math.hypot(x, z) / rim);
  y = lerp(y, Math.min(y, 14), edge);
  return y;
}

export function buildTerrain(): Island {
  return island({
    radius: ISLAND.semiZ,
    outline,
    seed: 21,
    relief: 1.4,
    biome: 'meadow',
    altitude: { rock: 104, snow: 146 },
    underside: 'floating',
    depth: 170,
    sea: ISLAND.seaLevel,
    waterFollowLook: true,
    detail: 1.6,
    height: valleyHeight,
    features: [
      { type: 'hill', x: PSH.bowl.x, z: PSH.bowl.z, r: 70, h: 26 },
      { type: 'pad', x: PSH.bowl.x, z: PSH.bowl.z, r: PSH.bowl.r + 10, y: PSH.bowl.y, blend: 16 },
      {
        type: 'pad',
        x: PSH.station.x,
        z: PSH.station.z,
        w: 34,
        d: 24,
        corner: 4,
        y: PSH.station.y + 1,
        blend: 8,
        color: GROUND.concrete(),
      },
      {
        type: 'pad',
        x: SWITCHYARD.x,
        z: SWITCHYARD.z,
        w: 46,
        d: 40,
        corner: 5,
        y: SWITCHYARD.y,
        blend: 12,
        color: GROUND.gravel(),
      },
      { type: 'pad', x: TOWN.x, z: TOWN.z, w: TOWN.size, d: TOWN.size * 0.8, corner: 8, y: 7, blend: 14 },
    ],
  });
}
