/**
 * The specimen blade section of step 4: a NACA 4418-like aerofoil (4 % camber at 40 % chord, 18 % thick —
 * typical of the thick sections of wind-turbine blades). Pure geometry, shared by the solid slice and the
 * streamlines drawn around it.
 */
export const CHORD = 11; // toy metres: the specimen is a magnified section
export const CAMBER = 0.04;
export const CAMBER_POS = 0.4;
export const THICK = 0.18;

/** Section outline in chord units: x from −0.3 (leading edge) to 0.7 (trailing edge), y toward the suction side. */
export function sectionOutline(n = 34): [number, number][] {
  const yt = (x: number): number => 5 * THICK * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const yc = (x: number): number => (x < CAMBER_POS ? (CAMBER / CAMBER_POS ** 2) * (2 * CAMBER_POS * x - x * x) : (CAMBER / (1 - CAMBER_POS) ** 2) * (1 - 2 * CAMBER_POS + 2 * CAMBER_POS * x - x * x));
  const xs = Array.from({ length: n + 1 }, (_, i) => 0.5 * (1 - Math.cos((Math.PI * i) / n)));
  const upper = xs.map((x): [number, number] => [x - 0.3, yc(x) + yt(x)]);
  const lower = xs.map((x): [number, number] => [x - 0.3, yc(x) - yt(x)]);
  return [...upper.reverse(), ...lower.slice(1, -1)];
}

