/**
 * The specimen blade section of step 4: a NACA 4418-like aerofoil (4 % camber at 40 % chord, 18 % thick —
 * typical of the thick sections of wind-turbine blades). Pure geometry, shared by the solid slice, the
 * potential-flow solution drawn around it and the miniature sections of the twist view.
 * Section frame, in chord lengths: x from −0.3 (leading edge) to 0.7 (trailing edge) — the origin is the pitch
 * axis at 30 % chord —, y toward the suction side.
 */
export const CHORD = 11; // toy metres: the specimen is a magnified section
export const CAMBER = 0.04;
export const CAMBER_POS = 0.4;
export const THICK = 0.18;
/** Chord fraction of the pitch axis (origin of the section frame). */
export const PITCH_AXIS = 0.3;

/** Upper and lower surface at chord fraction `x` (0 leading edge … 1 trailing edge), in the section frame. */
export function sectionAt(x: number): { x: number; upper: number; lower: number } {
  const t = 5 * THICK * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const c =
    x < CAMBER_POS
      ? (CAMBER / CAMBER_POS ** 2) * (2 * CAMBER_POS * x - x * x)
      : (CAMBER / (1 - CAMBER_POS) ** 2) * (1 - 2 * CAMBER_POS + 2 * CAMBER_POS * x - x * x);
  return { x: x - PITCH_AXIS, upper: c + t, lower: c - t };
}

/** Closed outline, counter-clockwise from the trailing edge (over the suction side to the nose and back). */
export function sectionOutline(n = 34): [number, number][] {
  const xs = Array.from({ length: n + 1 }, (_, i) => 0.5 * (1 - Math.cos((Math.PI * i) / n)));
  const upper = xs.map((x): [number, number] => [sectionAt(x).x, sectionAt(x).upper]);
  const lower = xs.map((x): [number, number] => [sectionAt(x).x, sectionAt(x).lower]);
  return [...upper.reverse(), ...lower.slice(1, -1)];
}

/**
 * Outline for the panel method: panels crowd at the nose only, and the knife-thin last 2 % of the trailing
 * edge are cut off square (panels lying back to back there make the equations ill-conditioned). The closing
 * panel (lower → upper corner) is the blunt base; the Kutta condition is applied to its two neighbours.
 */
export function flowOutline(n = 26, cut = 0.98): [number, number][] {
  const xs = Array.from({ length: n + 1 }, (_, i) => cut * (1 - Math.cos((Math.PI * i) / (2 * n))));
  const upper = xs.map((x): [number, number] => [sectionAt(x).x, sectionAt(x).upper]);
  const lower = xs.map((x): [number, number] => [sectionAt(x).x, sectionAt(x).lower]);
  return [...upper.reverse(), ...lower.slice(1)];
}
