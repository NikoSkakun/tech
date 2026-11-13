/**
 * Camera shots of the chapter are declared by what must be in the picture: `frame(center, width, height)` is
 * the box of the scene (world units) that the shot shows. The box becomes the shot's safe frame — the camera
 * director fits exactly this box into the area the HUD leaves free (step panel on the right, the board on the
 * left), at any window size — and its `fit` bounds for the mobile reframing (DECISIONS §57 d).
 *
 * So a step with a board gets a narrow free area: give it a box that hugs its subject (the subject's on-screen
 * size is `free width ÷ box width`), and let wide sets be seen a little from the side.
 */
import type { Shot } from '@/engine/api';

type V3 = readonly [number, number, number];

export interface FrameOptions {
  /** Direction the camera looks from, rad: 0 = straight from the front (+Z), positive = from the right. */
  azimuth?: number;
  /** Camera height angle above the horizon, rad. Default 0.2. */
  elevation?: number;
  /** Vertical field of view of the box, degrees. Default 28 (the chapter's long lens). */
  fov?: number;
  /** Orbit limits for the user. Default ±0.8 / ±0.3. */
  orbit?: Shot['orbit'];
  /** Depth-of-field focus when it is not the centre of the box. */
  focus?: Shot['focus'];
}

/** A shot showing the `width` × `height` box around `center` (world units; the box faces the camera). */
export function frame(center: V3, width: number, height: number, o: FrameOptions = {}): Shot {
  const fov = o.fov ?? 28;
  const azimuth = o.azimuth ?? 0.15;
  const elevation = o.elevation ?? 0.2;
  // distance at which the box height fills the vertical field of view
  const d = height / (2 * Math.tan((fov * Math.PI) / 360));
  return {
    position: [
      center[0] + d * Math.cos(elevation) * Math.sin(azimuth),
      center[1] + d * Math.sin(elevation),
      center[2] + d * Math.cos(elevation) * Math.cos(azimuth),
    ],
    target: center,
    fov,
    frameAspect: width / height,
    orbit: o.orbit ?? { azimuth: 0.8, polar: 0.3 },
    fit: { center, radius: Math.hypot(width, height) / 2 },
    ...(o.focus === undefined ? {} : { focus: o.focus }),
  };
}
