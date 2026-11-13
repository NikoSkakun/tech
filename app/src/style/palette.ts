/**
 * Colour tokens — STYLE_GUIDE §2. Always use these tokens; never hard-code ad-hoc colours in chapters.
 *
 * Colours are authored as sRGB hex and converted to the linear working space by `THREE.Color`. The render
 * pipeline is built so that a fully lit `K.toon` surface (and any unlit colour ≤ 1) lands on screen as the
 * specified hex: there is no filmic tone-mapping of base colours.
 */
import { Color, type ColorRepresentation } from 'three';

export const BG = {
  void: '#070A1F',
  deep: '#0D1136',
  indigo: '#1A1657',
  violet: '#2E1F7A',
  plum: '#4A2A8F',
} as const;

export const ACCENT = {
  cyan: '#2DE2E6',
  teal: '#1CC8A5',
  green: '#7BE36B',
  lime: '#C6F24E',
  yellow: '#FFD23F',
  amber: '#FFB02E',
  orange: '#FF8A3D',
  coral: '#FF5E5B',
  red: '#F0355C',
  pink: '#FF6FB5',
  magenta: '#E34BD0',
  violet: '#8E5CF7',
  blue: '#3D7BFF',
  sky: '#6EC6FF',
} as const;

export const NEUTRAL = {
  white: '#F6F3FF',
  mist: '#C9C6EA',
  steel: '#8D8FB8',
  slate: '#4B4F7A',
  ink: '#1B1D3A',
} as const;

/** Colours fixed by external standards rather than by the palette (IEC 60446 conductor colours). */
export const STANDARD = {
  /** Line conductor L — brown. */
  wireBrown: '#B5651D',
  /** Protective earth PE — the green of green/yellow stripes (the yellow is `yellow`). */
  wireGreen: '#3FB950',
} as const;

/**
 * Plant-type colours for charts, stacked areas and map chips — STYLE_GUIDE §2.2, constant across the app.
 * Also usable as tokens: `plantType.wind`. `exchange` (import / export) is drawn `white` with a `sky` outline,
 * `shedding` (load shedding) as `red` hatching.
 */
export const PLANT_TYPE = {
  nuclear: 'violet',
  coal: 'slate',
  chp: 'steel',
  gas: 'pink',
  hydro: 'blue',
  pumpedStorage: 'sky',
  wind: 'teal',
  solar: 'amber',
  bio: 'green',
  geothermal: 'orange',
  ocean: 'cyan',
  bess: 'lime',
  hydrogen: 'mist',
  exchange: 'white',
  shedding: 'red',
} as const;

/** Status of gauges, chips and indicators — STYLE_GUIDE §2.2 (`ui.warning` = amber). Tokens: `ui.ok` … */
export const UI_STATUS = { ok: 'green', warning: 'amber', alarm: 'red', info: 'sky' } as const;

/**
 * Power-flow colours: active power `yellow` pulses (reverse flow = the same yellow with reversed chevrons),
 * reactive / charging current `sky` dashed pulses. Tokens: `flow.active`, `flow.reactive`.
 */
export const FLOW = { active: 'yellow', reactive: 'sky' } as const;

export type BgName = keyof typeof BG;
export type AccentName = keyof typeof ACCENT;
export type NeutralName = keyof typeof NEUTRAL;
export type StandardName = keyof typeof STANDARD;
export type PlantTypeName = keyof typeof PLANT_TYPE;
export type UiStatusName = keyof typeof UI_STATUS;
export type FlowName = keyof typeof FLOW;

/**
 * Any palette token: `cyan`, `cyan.light`, `cyan.dark`, `bg.indigo`, `white`, `wireBrown`, and the named groups
 * `plantType.wind`, `ui.warning`, `flow.reactive` (aliases of palette colours, STYLE_GUIDE §2.2).
 */
export type ColorToken =
  | AccentName
  | `${AccentName}.light`
  | `${AccentName}.dark`
  | NeutralName
  | `${NeutralName}.light`
  | `${NeutralName}.dark`
  | `bg.${BgName}`
  | StandardName
  | `plantType.${PlantTypeName}`
  | `ui.${UiStatusName}`
  | `flow.${FlowName}`;

/** Named token groups that alias palette colours. */
const GROUPS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  plantType: PLANT_TYPE,
  ui: UI_STATUS,
  flow: FLOW,
};

/** Anything accepted where a colour is expected: a token, a `THREE.Color`, a hex number or CSS string. */
export type ColorLike = ColorToken | Color | number | (string & Record<never, never>);

const VIOLET_HUE = 262 / 360; // hue of `violet` — cel shadows shift toward it, never toward grey/black

/** `*.light` variant: +18 % lightness, −8 % saturation (STYLE_GUIDE §2.1). */
export function lightVariant(base: Color, out = new Color()): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  return out.setHSL(hsl.h, Math.max(0, hsl.s - 0.08), Math.min(0.96, hsl.l + 0.18));
}

/** `*.dark` variant: hue shifted ~12° toward violet, −30 % lightness (STYLE_GUIDE §2.1). */
export function darkVariant(base: Color, out = new Color()): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  let d = VIOLET_HUE - hsl.h; // shortest signed hue distance to violet
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  const shift = Math.sign(d) * Math.min(Math.abs(d), 12 / 360);
  return out.setHSL((hsl.h + shift + 1) % 1, hsl.s, hsl.l * 0.7);
}

const cache = new Map<string, Color>();

function resolveToken(token: string): Color | null {
  const hit = cache.get(token);
  if (hit) return hit;
  let c: Color | null = null;
  const dot = token.indexOf('.');
  const group = dot > 0 ? GROUPS[token.slice(0, dot)] : undefined;
  if (group) {
    const alias = group[token.slice(dot + 1)];
    const base = alias !== undefined ? resolveToken(alias) : null;
    if (base) c = base.clone();
  } else if (token.startsWith('bg.')) {
    const hex = BG[token.slice(3) as BgName];
    if (hex) c = new Color(hex);
  } else {
    const [name, variant] = token.split('.') as [string, string | undefined];
    const hex = ACCENT[name as AccentName] ?? NEUTRAL[name as NeutralName] ?? STANDARD[name as StandardName];
    if (hex) {
      c = new Color(hex);
      if (variant === 'light') lightVariant(c, c);
      else if (variant === 'dark') darkVariant(c, c);
      else if (variant !== undefined) c = null;
    }
  }
  if (c) cache.set(token, c);
  return c;
}

/**
 * Resolve a token / colour-like value to a **new** `THREE.Color` in the linear working space
 * (safe to mutate or tween).
 */
export function col(value: ColorLike, out = new Color()): Color {
  if (typeof value === 'string') {
    const c = resolveToken(value);
    return c ? out.copy(c) : out.set(value as ColorRepresentation);
  }
  if (typeof value === 'number') return out.set(value);
  return out.copy(value);
}

/** sRGB hex string (`#rrggbb`) of a token — for the few HTML/CSS consumers (boot splash, debug overlay). */
export function hex(value: ColorLike): string {
  return `#${col(value).getHexString()}`;
}

/**
 * Semantic colour code — STYLE_GUIDE §2.2. This is the visual language of the whole course: the same
 * meaning has the same colour in every chapter. Never violate it.
 */
export const SEMANTIC = {
  electron: 'cyan',
  negative: 'cyan',
  proton: 'coral',
  positive: 'coral',
  hole: 'coral',
  neutron: 'mist',
  neutronShade: 'steel',
  quarkUp: 'amber',
  quarkDown: 'violet',
  gluon: 'lime',
  photon: 'yellow',
  fieldE: 'amber',
  fieldB: 'magenta',
  current: 'yellow',
  energyFlow: 'yellow',
  voltageLow: 'blue',
  voltageMid: 'pink',
  voltageHigh: 'coral',
  heat: 'orange',
  heatHot: 'red',
  steamHot: 'pink.light',
  cold: 'blue',
  water: 'sky',
  coolant: 'blue',
  vapour: 'mist',
  fuelSolid: 'ink',
  fuelSolidLight: 'slate',
  fuelGas: 'violet',
  phaseL1: 'yellow',
  phaseL2: 'green',
  phaseL3: 'red',
  wireL: 'wireBrown',
  wireN: 'blue',
  wirePE: 'wireGreen',
  wirePEStripe: 'yellow',
  lithiumIon: 'lime',
  danger: 'red',
  safe: 'green',
  affordance: 'cyan',
  selected: 'yellow',
  warning: 'ui.warning',
  ok: 'ui.ok',
  alarm: 'ui.alarm',
  poleN: 'coral',
  poleS: 'blue',
  dcPlus: 'coral',
  dcMinus: 'blue',
  reactive: 'flow.reactive',
  donor: 'teal',
  nRegion: 'teal',
  acceptor: 'pink',
  pRegion: 'pink',
  valenceBand: 'violet',
  conductionBand: 'sky',
  bandGap: 'bg.deep',
  nuclear: 'violet',
  radioactivity: 'violet',
  coreGlow: 'sky',
  coreGlowHot: 'white',
} as const satisfies Record<string, ColorToken>;

export type SemanticName = keyof typeof SEMANTIC;

/** Semantic colour as a new `THREE.Color`. */
export function sem(name: SemanticName, out = new Color()): Color {
  return col(SEMANTIC[name], out);
}

function ramp(stops: readonly Color[], t: number, out: Color): Color {
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  return out.copy(stops[i]!).lerp(stops[i + 1]!, x - i);
}

const VOLTAGE_STOPS = [col('blue'), col('pink'), col('coral')];
const HEAT_STOPS = [col('orange'), col('red')];
const TEMPERATURE_STOPS = [col('blue'), col('sky'), col('white'), col('orange'), col('red')];

/** Voltage / potential ramp: `blue` (low) → `pink` → `coral` (high); `t` in 0…1. */
export function voltageRamp(t: number, out = new Color()): Color {
  return ramp(VOLTAGE_STOPS, t, out);
}

/** Heat ramp: `orange` → `red`; `t` in 0…1. */
export function heatRamp(t: number, out = new Color()): Color {
  return ramp(HEAT_STOPS, t, out);
}

/** Cold → hot ramp for fluids and surfaces: `blue` → `sky` → `white` → `orange` → `red`. */
export function temperatureRamp(t: number, out = new Color()): Color {
  return ramp(TEMPERATURE_STOPS, t, out);
}
