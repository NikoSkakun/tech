/**
 * The «сходинка енергії» of step 2: valence band (`violet`) and conduction band (`sky`) with the dark gap
 * E_g between them. `show(photon, u)` plays one absorption as a pure function of the cycle phase u ∈ [0, 1):
 * the electron jumps up by the photon energy, slides down to the band edge (thermalisation — the `orange`
 * excess) and leaves a hole below; a photon below the gap only lifts it into the gap and it falls back.
 * Units: stage units, 1 eV = `EV` units.
 */
import { Group, Mesh, type Object3D } from 'three';
import { createElectron, createHalo, createHole } from '@/fx';
import { Builder } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { SI_BANDGAP_EV, type PhotonResult } from '@electricity/sim/lab-pv';

const EV = 1.25;
const W = 2.4;

export interface BandDiagram {
  group: Group;
  anchors: { gap: Object3D; conduction: Object3D; valence: Object3D };
  show(photon: PhotonResult, u: number): void;
}

export function createBandDiagram(): BandDiagram {
  const group = new Group();
  group.name = 'band-diagram';
  const gapTop = (SI_BANDGAP_EV * EV) / 2;
  const b = new Builder('bands');
  b.box(W + 0.3, 5.2, 0.12, { r: 0.08, mid: true, slot: 'gloss', c: 'bg.deep', at: [0, 0.6, -0.14] });
  const body = b.build().group;
  const band = (color: string, y: number, h: number): Mesh => {
    const mesh = new Mesh(new Builder('band').box(W, h, 0.1, { r: 0.05, mid: true }).geometry('toon'), K.glow({ color, intensity: 1.15, keepHue: true, whiten: 0, falloff: 0 }));
    mesh.position.y = y;
    return mesh;
  };
  const conduction = band(SEMANTIC.conductionBand, gapTop + 0.95, 1.9);
  const valence = band(SEMANTIC.valenceBand, -gapTop - 0.55, 1.1);
  // the excess above the band edge that turns into heat
  const excess = new Mesh(new Builder('excess').box(0.16, 1, 0.06, { r: 0, mid: true }).geometry('toon'), K.glow({ color: 'orange', intensity: 1.5, keepHue: true, whiten: 0 }));
  excess.position.z = 0.1;
  const electron = createElectron({ radius: 0.15 });
  const hole = createHole();
  hole.radius = 0.17;
  const heat = createHalo({ color: 'orange', size: 1.3, intensity: 0 });
  for (const o of [electron, hole, heat]) o.position.z = 0.16;
  const gap = new Group();
  gap.position.set(W / 2, 0, 0.1);
  group.add(body, conduction, valence, excess, electron, hole, heat, gap);

  return {
    group,
    anchors: { gap, conduction, valence },
    show(photon, u) {
      const x = -0.35;
      const y0 = -gapTop - 0.12; // top of the valence band
      const yEdge = gapTop + 0.12; // bottom of the conduction band
      const yUp = Math.min(gapTop + 1.85, y0 + photon.energyEv * EV);
      const jump = Math.min(1, u / 0.3);
      let y: number;
      if (!photon.absorbed) {
        // not enough energy: a hop into the gap and back
        y = y0 + Math.sin(Math.min(1, u / 0.5) * Math.PI) * (yUp - y0) * 0.8;
      } else if (u < 0.3) {
        y = y0 + (yUp - y0) * (1 - (1 - jump) ** 3);
      } else {
        const slide = Math.min(1, (u - 0.3) / 0.25);
        y = yUp + (yEdge - yUp) * slide;
      }
      electron.position.set(x, y, 0.16);
      const pair = photon.absorbed && u > 0.05;
      hole.visible = pair;
      hole.position.set(x, y0, 0.16);
      // thermalisation: the orange bar is the energy above the band edge, shrinking as the electron slides down
      const over = photon.absorbed ? Math.max(0, y - yEdge) : 0;
      excess.visible = over > 0.02 && u >= 0.3;
      excess.scale.y = Math.max(0.001, over);
      excess.position.set(x + 0.35, yEdge + over / 2, 0.1);
      heat.position.set(x, yEdge + over, 0.16);
      heat.intensity = photon.absorbed && u >= 0.3 && u < 0.6 ? 1.2 * Math.sin(((u - 0.3) / 0.3) * Math.PI) * Math.min(1, photon.heatEv) : 0;
    },
  };
}
