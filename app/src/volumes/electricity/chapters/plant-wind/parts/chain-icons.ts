/**
 * Step 1 «ланцюжок перетворень»: three icons joined by yellow arrows above the hero turbine —
 * wind streaks (`mist`) → turning rotor (`steel`) → lightning / grid (`yellow`). A world surface with one
 * custom-painted node (UI_API §8, §11); icons only, so it reads at the distance of the overview shot.
 */
import type { ChapterContext } from '@/engine/api';
import { UiNode, lit, rgba, worldSurface, type Painter, type UiSurface } from '@/ui3d';

class ChainNode extends UiNode {
  /** Rotor icon angle, radians (the scene turns it with the hero rotor). */
  spin = 0;
  /** Phase of the wind streaks, 0…1. */
  drift = 0;

  constructor() {
    super({ width: 400, height: 120 });
  }

  override paint(p: Painter): void {
    const plate = { fill: rgba('bg.deep', 0.9), border: rgba('sky', 0.75), bw: 2.5, glow: 10, glowAlpha: 0.25 };
    const xs = [-140, 0, 140];
    for (const x of xs) p.circle(x, 0, 100, plate);
    // wind: three streaks sliding to the right
    [-20, 2, 24].forEach((y, i) => {
      const shift = ((this.drift + i * 0.37) % 1) * 22 - 11;
      const half = i === 1 ? 26 : 18;
      p.line(-140 - half + shift, y, -140 + half + shift, y, 7, { fill: rgba('mist'), r: 3.5 });
    });
    // rotor: three blades around a hub
    for (let k = 0; k < 3; k++) {
      const a = this.spin + (k * Math.PI * 2) / 3;
      p.line(0, 0, Math.cos(a) * 36, Math.sin(a) * 36, 9, { fill: rgba('steel.light'), r: 4.5 });
    }
    p.circle(0, 0, 18, { fill: rgba('white') });
    // grid: the energy colour, glowing
    p.icon('lightning', 140, 0, 58, lit(rgba('yellow'), 1.5));
    for (const x of [-70, 70]) p.icon('arrowRight', x, 0, 34, lit(rgba('yellow'), 1.3));
  }
}

export interface ChainIcons {
  surface: UiSurface;
  update(dt: number, rotorSpeed: number, wind: number): void;
}

/** `unit` = world metres per px-equivalent of the surface. */
export function buildChainIcons(ctx: ChapterContext, unit: number): ChainIcons {
  const surface = worldSurface(ctx, { width: 400, height: 120, unit, name: 'energy-chain' });
  const node = new ChainNode();
  surface.root.add(node);
  surface.interactive = false;
  return {
    surface,
    update(dt, rotorSpeed, wind) {
      node.spin -= rotorSpeed * dt;
      node.drift = (node.drift + dt * wind * 0.08) % 1;
      node.repaint();
    },
  };
}
