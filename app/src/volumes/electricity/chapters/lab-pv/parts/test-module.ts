/**
 * The «пробний» module of step 8: one kit ЛМ-440 (drawn ×2.4 so its attitude reads from afar — the step says
 * so) on a swivel mount: a mast with a turning head (azimuth) and a tilting cradle (tilt). A snow blanket can
 * lie on the glass and slide off. Units: house metres; the mast stands on its origin.
 */
import { BoxGeometry, Group, Mesh, type Object3D, PlaneGeometry } from 'three';
import { Builder, PV_MODULE, pvModule } from '@/kit';
import { K } from '@/style';
import { shadows } from '../world';

const SCALE = 2.4;
const MAST = 2.2;

export interface TestModule {
  group: Group;
  /** Drag / pick proxy over the glass. */
  grip: Mesh;
  /** Centre of the glass (an object: read its world position). */
  centre: Object3D;
  /** Tilt from horizontal and azimuth from south (+ west), degrees. */
  set(tiltDeg: number, azimuthDeg: number): void;
  /** `cover` 0…1 = snow thickness, `slide` 0…1 = how far it has slipped down the glass. */
  snow(cover: number, slide: number): void;
}

export function createTestModule(): TestModule {
  const group = new Group();
  group.name = 'test-module';
  const b = new Builder('swivel-mount');
  b.cyl(0.5, 0.12, { seg: 24, slot: 'metal', c: 'slate' });
  b.cyl(0.11, MAST, { seg: 16, slot: 'metal', c: 'steel', at: [0, 0.1, 0] });
  const head = b.part('head', { at: [0, MAST + 0.1, 0] });
  head.cyl(0.24, 0.22, { seg: 20, slot: 'metal', c: 'steel.light' });
  head.box(0.16, 0.5, 0.16, { r: 0.04, slot: 'metal', c: 'steel', at: [0, 0.18, 0] });
  // azimuth pointer on the head (toward where the module faces)
  head.cone(0.12, 0.42, { seg: 12, slot: 'gloss', c: 'cyan', axis: 'z', at: [0, 0.1, 0.3] });
  const mount = b.build();
  group.add(shadows(mount.group));
  const cradle = new Group();
  cradle.position.y = 0.72;
  mount.part('head').add(cradle);
  const module = pvModule({ detail: 'mid' });
  module.group.scale.setScalar(SCALE);
  module.group.position.y = 0.06;
  cradle.add(shadows(module.group));
  const grip = new Mesh(new PlaneGeometry(PV_MODULE.width * SCALE * 1.15, PV_MODULE.length * SCALE * 1.1).rotateX(-Math.PI / 2), K.flat('cyan'));
  grip.material.colorWrite = false;
  grip.material.depthWrite = false;
  grip.material.side = 2;
  grip.position.y = 0.1;
  cradle.add(grip);
  const centre = new Group();
  centre.position.y = 0.1;
  cradle.add(centre);
  const blanket = new Mesh(new BoxGeometry(PV_MODULE.width * SCALE * 0.98, 1, PV_MODULE.length * SCALE * 0.98), K.toon({ color: 'white', highlight: 0.15, rim: 0.4 }));
  blanket.visible = false;
  cradle.add(blanket);

  return {
    group,
    grip,
    centre,
    set(tiltDeg, azimuthDeg) {
      // south = +Z, west = −X: a positive (western) azimuth turns the head toward −X
      mount.part('head').rotation.y = (-azimuthDeg * Math.PI) / 180;
      cradle.rotation.x = (tiltDeg * Math.PI) / 180;
    },
    snow(cover, slide) {
      blanket.visible = cover > 0.01 && slide < 0.99;
      blanket.scale.y = 0.02 + 0.14 * cover;
      // slipping down the glass (+Z of the tilted cradle), thinning as it goes
      blanket.position.set(0, 0.12 + blanket.scale.y / 2, slide * PV_MODULE.length * SCALE * 1.05);
      blanket.scale.z = 1 - 0.5 * slide;
    },
  };
}
