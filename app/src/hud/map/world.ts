/**
 * The 3D body of the Journey Map: the glowing path with energy pulses, chapter platforms on stems rising
 * from a grid floor, emblems, satellite branches, the scale ruler, the "you are here" beacon and step beads.
 * Everything is instanced / merged: the whole map is about a dozen draw calls.
 */
import {
  CatmullRomCurve3, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, SphereGeometry,
  TorusGeometry, TubeGeometry, Vector3, type BufferGeometry, type Material, type Object3D,
} from 'three'; // prettier-ignore
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { K, col } from '@/style';
import { emblemGeometry } from './emblems';
import type { MapLayout, MapNode } from './layout';

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

interface EmblemSet {
  mesh: InstancedMesh;
  nodes: MapNode[];
}

export class MapWorld {
  readonly group = new Group();
  /** Invisible pick spheres, one per node (same order as `layout.nodes`). */
  readonly proxies: Mesh[] = [];
  /** X of the scale ruler in map units. */
  readonly rulerX: number;
  private readonly materials: (Material & { fade: number })[] = [];
  private readonly emblems: EmblemSet[] = [];
  private readonly beacon: Mesh;
  private readonly beads: InstancedMesh;
  private readonly rings: InstancedMesh;
  private here = -1;
  private selected = -1;
  private hover = -1;
  private readonly lift: Float32Array;
  private readonly custom = new Map<number, Object3D>();

  constructor(readonly layout: MapLayout) {
    const nodes = layout.nodes;
    this.lift = new Float32Array(nodes.length);
    this.rulerX = layout.spine[0]!.x - 250;
    const own = <T extends Material & { fade: number }>(m: T): T => {
      // in the transparent pass (sorted after the backdrop) but still depth-tested and depth-writing
      m.transparent = true;
      this.materials.push(m);
      return m;
    };
    const add = (mesh: Mesh | InstancedMesh, order = 0): void => {
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    };

    // main path: a tube with energy pulses travelling from the atom to the socket
    const curve = new CatmullRomCurve3(
      layout.spine.map((n) => new Vector3(n.x, n.y, n.z)),
      false,
      'catmullrom',
      0.5,
    );
    add(
      new Mesh(
        new TubeGeometry(curve, 260, 7, 10),
        own(
          K.energy({
            color: 'bg.plum',
            emissive: 'violet',
            emissiveIntensity: 0.55,
            pulseColor: 'yellow',
            repeat: 16,
            speed: 0.07,
            length: 0.5,
            intensity: 3.2,
          }),
        ),
      ),
    );

    // satellite branches and stems, merged into one glowing mesh
    const thin: BufferGeometry[] = [];
    const rod = (a: Vector3, b: Vector3, r: number): void => {
      const g = new CylinderGeometry(r, r, 1, 6, 1, true);
      const d = b.clone().sub(a);
      _q.setFromUnitVectors(UP, d.clone().normalize());
      g.applyMatrix4(_m.compose(a.clone().add(b).multiplyScalar(0.5), _q, _s.set(1, d.length(), 1)));
      thin.push(g);
    };
    for (const n of nodes) {
      const at = new Vector3(n.x, n.y, n.z);
      if (n.parent >= 0) {
        const p = nodes[n.parent]!;
        rod(new Vector3(p.x, p.y, p.z), at, 1.6);
      } else rod(new Vector3(n.x, layout.ground, n.z), at, 1.1);
    }
    // axis ruler: a spine with a tick per axis step (electricity: every decade, long ticks every 4)
    const top = layout.height(layout.axis.max);
    const bottom = layout.height(layout.axis.min);
    const rz = layout.spine[0]!.z;
    rod(new Vector3(this.rulerX, bottom, rz), new Vector3(this.rulerX, top, rz), 1.6);
    for (const tick of layout.ticks) {
      const y = layout.height(tick.value);
      rod(new Vector3(this.rulerX, y, rz), new Vector3(this.rulerX + (tick.major ? 26 : 12), y, rz), 1.1);
    }
    add(
      new Mesh(mergeGeometries(thin, false)!, own(K.glow({ color: 'violet', intensity: 0.95, falloff: 0 }))),
    );
    for (const g of thin) g.dispose();

    // platforms (chapter accent) with a bright rim
    const disc = new InstancedMesh(
      new CylinderGeometry(1, 0.84, 0.34, 44),
      own(K.toon({ color: 'white', gloss: 0.35 })),
      nodes.length,
    );
    this.rings = new InstancedMesh(
      new TorusGeometry(1.03, 0.05, 8, 56),
      own(K.glow({ color: 'white', intensity: 1.5, falloff: 0 })),
      nodes.length,
    );
    nodes.forEach((n, i) => {
      disc.setMatrixAt(i, _m.compose(_p.set(n.x, n.y, n.z), _q.identity(), _s.setScalar(n.radius)));
      disc.setColorAt(i, _c.copy(col(n.chapter.accent)).multiplyScalar(0.72).lerp(col('bg.indigo'), 0.25));
      this.rings.setColorAt(i, col(n.chapter.accent));
    });
    add(disc);
    add(this.rings);

    // emblems: one instanced mesh per chapter group
    const groups = new Map<string, MapNode[]>();
    for (const n of nodes) groups.set(n.chapter.group, [...(groups.get(n.chapter.group) ?? []), n]);
    for (const [group, list] of groups) {
      const mesh = new InstancedMesh(
        emblemGeometry(layout.emblemOf(group)),
        own(K.toon({ color: 'white', vertexColors: true, gloss: 0.45 })),
        list.length,
      );
      this.emblems.push({ mesh, nodes: list });
      add(mesh);
    }

    // "you are here" beacon and the beads of the selected chapter's steps
    this.beacon = new Mesh(
      new TorusGeometry(1, 0.07, 10, 64),
      own(K.glow({ color: 'yellow', intensity: 2.4, falloff: 0 })),
    );
    this.beacon.rotation.x = Math.PI / 2;
    this.beacon.visible = false;
    add(this.beacon, 1);
    this.beads = new InstancedMesh(
      new SphereGeometry(1, 14, 10),
      own(K.glow({ color: 'white', intensity: 1.6 })),
      24,
    );
    this.beads.count = 0;
    add(this.beads, 1);

    const pick = new SphereGeometry(1, 10, 8);
    const hidden = K.flat('white');
    hidden.visible = false;
    for (const n of nodes) {
      const proxy = new Mesh(pick, hidden);
      proxy.position.set(n.x, n.y + n.radius * 0.5, n.z);
      proxy.scale.setScalar(n.radius * 1.35);
      proxy.userData.node = n.index;
      this.proxies.push(proxy);
      this.group.add(proxy);
    }
    this.update(0, 0);
  }

  /**
   * Replace a node's generic emblem with the chapter's own model (`emblem.ts`, unit-sphere convention of
   * docs/UI_API.md §9). The map owns the object from now on: it bobs with the others and is disposed with the map.
   */
  setEmblem(index: number, object: Object3D): void {
    object.traverse((o) => {
      const m = (o as Mesh).material as (Material & { fade?: number }) | Material[] | undefined;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        mat.transparent = true; // same pass as the rest of the map
        if (typeof (mat as { fade?: number }).fade === 'number')
          this.materials.push(mat as Material & { fade: number });
      }
    });
    this.custom.set(index, object);
    this.group.add(object);
  }

  /** 0…1 dithered dissolve of the whole map (open / close). */
  set fade(v: number) {
    for (const m of this.materials) m.fade = v;
    this.group.visible = v > 0.002;
  }

  /** Node the user currently is at (beacon), the selected node (beads) and the hovered node (lift). */
  mark(here: number, selected: number, hover: number): void {
    this.here = here;
    this.selected = selected;
    this.hover = hover;
  }

  /** Show one bead per step around the selected node; `visited[i]` colours it. */
  setBeads(node: MapNode | null, visited: readonly boolean[], accent: Color): void {
    const count = node ? Math.min(visited.length, 24) : 0;
    this.beads.count = count;
    if (!node) return;
    const r = node.radius * 1.5;
    for (let i = 0; i < count; i++) {
      // an arc over the far side of the platform, first step on the left
      const a = Math.PI * (1.12 - (1.24 * (i + 0.5)) / count);
      this.beads.setMatrixAt(
        i,
        _m.compose(
          _p.set(node.x + Math.cos(a) * r, node.y + 4, node.z - Math.sin(a) * r * 0.9 + 6),
          _q.identity(),
          _s.setScalar(visited[i] ? 5.2 : 3.6),
        ),
      );
      this.beads.setColorAt(i, visited[i] ? accent : _c.set(0.35, 0.36, 0.6));
    }
    this.beads.instanceMatrix.needsUpdate = true;
    if (this.beads.instanceColor) this.beads.instanceColor.needsUpdate = true;
  }

  /** Per-frame life: emblems bob and turn, hovered / selected nodes rise, the beacon pulses. */
  update(t: number, dt: number): void {
    const nodes = this.layout.nodes;
    const k = 1 - Math.exp(-10 * dt);
    for (let i = 0; i < nodes.length; i++) {
      const target = i === this.selected ? 1 : i === this.hover ? 0.6 : 0;
      this.lift[i] = this.lift[i]! + (target - this.lift[i]!) * (dt > 0 ? k : 1);
    }
    for (const set of this.emblems) {
      set.nodes.forEach((n, j) => {
        const up = this.lift[n.index]!;
        const size = n.radius * (0.78 + 0.16 * up);
        _q.setFromAxisAngle(UP, Math.sin(t * 0.5 + n.index * 1.7) * 0.35 + up * Math.sin(t * 1.4) * 0.25);
        _p.set(n.x, n.y + n.radius * 0.95 + Math.sin(t * 1.3 + n.index) * 2.2 + up * 9, n.z);
        const own = this.custom.get(n.index);
        if (own) {
          own.position.copy(_p);
          own.quaternion.copy(_q);
          own.scale.setScalar(size);
        }
        // a chapter-provided emblem replaces the generic instance (collapsed to nothing)
        set.mesh.setMatrixAt(j, _m.compose(_p, _q, _s.setScalar(own ? 0 : size)));
      });
      set.mesh.instanceMatrix.needsUpdate = true;
    }
    nodes.forEach((n, i) => {
      const up = this.lift[i]!;
      this.rings.setMatrixAt(
        i,
        _m.compose(
          _p.set(n.x, n.y + n.radius * 0.17, n.z),
          _q.setFromAxisAngle(_s.set(1, 0, 0), Math.PI / 2),
          _s.setScalar(n.radius * (1 + 0.1 * up)),
        ),
      );
    });
    this.rings.instanceMatrix.needsUpdate = true;
    const h = nodes[this.here];
    this.beacon.visible = h !== undefined;
    if (h) {
      const pulse = 1.3 + 0.12 * Math.sin(t * 3.2);
      this.beacon.position.set(h.x, h.y + h.radius * 0.2, h.z);
      this.beacon.scale.setScalar(h.radius * pulse);
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.group.removeFromParent();
  }
}
