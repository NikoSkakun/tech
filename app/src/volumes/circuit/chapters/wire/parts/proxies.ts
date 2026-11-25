/**
 * Invisible pick proxies for the atoms of the focal plane (`wire/atoms`). The atoms themselves are instanced
 * impostors; one registered proxy per atom gives exact hover / click per atom with a generous radius. The proxies
 * draw nothing (`material.visible = false`: no draw call) but are picked like any mesh.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { ChapterContext, InteractionHandlers } from '@/engine/api';
import type { Copper } from '@circuit/shared/copper/copper';
import { ATOM_R, PITCH } from '@circuit/shared/copper/layout';

/** Reach of a proxy: just under half the pitch, so neighbouring proxies meet and the gaps are not dead zones. */
const REACH = Math.min(1.5 * ATOM_R, PITCH * 0.49);
/** The part of the focal plane that is ever in the frame of the rows (local units, generous). */
const SPAN = { x: 12, y: 7 };

export interface AtomProxies {
  /** A site of the focal plane next to the hero (right neighbour), for scripted tests. */
  side: number;
}

export function atomProxies(
  ctx: ChapterContext,
  copper: Copper,
  on: {
    enabled: () => boolean;
    hover: (site: number) => void;
    click: (site: number) => void;
    /** Lens mode's drag (sway) and wheel (ring): the proxies cover the frame, so they pass both on. */
    space?: Pick<InteractionHandlers, 'dragStart' | 'drag' | 'dragEnd' | 'wheel'>;
  },
): AtomProxies {
  const geometry = new SphereGeometry(REACH, 12, 8);
  const material = new MeshBasicMaterial({ visible: false });
  let side = -1;
  copper.lattice.sites.forEach((s, site) => {
    if (s.plane !== 0 || Math.abs(s.p.x) > SPAN.x || Math.abs(s.p.y) > SPAN.y) return;
    if (s.j === 0 && s.i === 1) side = site;
    const proxy = new Mesh(geometry, material);
    proxy.name = `atom-proxy-${site}`;
    proxy.position.copy(s.p);
    copper.space.add(proxy);
    ctx.input.register(proxy, {
      cursor: 'pointer',
      enabled: () => on.enabled() && copper.lattice.presence(site) > 0.5,
      hover: (over) => {
        if (over) on.hover(site);
      },
      click: () => on.click(site),
      ...on.space,
    });
  });
  return { side };
}
