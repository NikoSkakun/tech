/** Minimal immutable complex arithmetic for AC phasors. */
export interface Complex {
  readonly re: number;
  readonly im: number;
}

export const complex = (re: number, im = 0): Complex => ({ re, im });
export const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const cScale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s });
export const cConj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);
/** Argument in radians, (−π, π]. */
export const cArg = (a: Complex): number => Math.atan2(a.im, a.re);
export function cDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
/** r·e^{jθ}. */
export const cPolar = (r: number, thetaRad: number): Complex => ({
  re: r * Math.cos(thetaRad),
  im: r * Math.sin(thetaRad),
});
