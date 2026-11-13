/**
 * `plant-geo-bio` M4 (biomass fuel, CHP heat schedule), M5 (biogas, flexible engine, gas holder), step 10 (WtE),
 * M6 (carbon debt, illustrative) and M6b (biogas vs gas).
 */

/* ------------------------------------------------ M4 ------------------------------------------------------ */

/** LHV_w = LHV_dry·(1 − w) − 2.443·w, MJ/kg (w as a fraction). */
export function lhvWet(moisture: number, lhvDry = 19): number {
  return lhvDry * (1 - moisture) - 2.443 * moisture;
}

/** Fuel flow for a power plant: ṁ = P_el/(η_el·LHV); daily mass and 27 t trucks. */
export function biomassLogistics(pElMw: number, etaEl: number, moisture: number, lhvDry = 19) {
  const lhv = lhvWet(moisture, lhvDry);
  const fuelMw = pElMw / etaEl;
  const kgS = fuelMw / lhv;
  const tPerDay = (kgS * 86400) / 1000;
  return { lhvMjKg: lhv, fuelMw, kgPerS: kgS, tPerDay, trucksPerDay: tPerDay / 27 };
}

/** Sankey shares (of 100): electricity only vs CHP. */
export const BIOMASS_SANKEY = {
  electricityOnly: { electricity: 28, heat: 0, losses: 72 },
  chp: { electricity: 23, heat: 62, losses: 15 },
} as const;

/** City heat demand share Q_need/Q_max = clamp((18 − T_out)/38, 0.15, 1); in CHP mode P_el follows it. */
export function heatDemandShare(tOutC: number): number {
  return Math.min(1, Math.max(0.15, (18 - tOutC) / 38));
}

/* ------------------------------------------------ M5 ------------------------------------------------------ */

export const FEEDSTOCKS = {
  cattleManure: { yieldM3PerT: 25, ch4: 0.55 },
  maizeSilage: { yieldM3PerT: 200, ch4: 0.52 },
  foodWaste: { yieldM3PerT: 120, ch4: 0.6 },
  poultryLitter: { yieldM3PerT: 80, ch4: 0.58 },
} as const;
export type Feedstock = keyof typeof FEEDSTOCKS;

/** Temperature activity 0…1: mesophilic peak 38 °C, thermophilic peak 53 °C. */
export function digesterActivity(tC: number, culture: 'meso' | 'thermo' = 'meso'): number {
  if (culture === 'thermo') return Math.exp(-(((tC - 53) / 6) ** 2));
  const f = (t: number): number =>
    0.12 * Math.exp(-(((t - 22) / 8) ** 2)) + 0.75 * Math.exp(-(((t - 38) / 6) ** 2));
  // Normalised by the exact value at 38 °C (0.75220) so that A(38) = 1 as the document states (its «/0,752» gives 1.0003).
  return f(tC) / f(38);
}

/** Retention-time yield f(HRT) = 1 − e^(−HRT/15). */
export function hrtFactor(hrtDays: number): number {
  return 1 - Math.exp(-hrtDays / 15);
}

export interface BiogasInput {
  /** t/day per feedstock. */
  feed: Partial<Record<Feedstock, number>>;
  tempC: number;
  culture?: 'meso' | 'thermo';
  hrtDays: number;
}

/** V = Σ m·Y·f(HRT)·A(T); CH₄ share by gas volume; W = V·x·9.97 kWh; P̄_el = W·0.40/24 h, heat ·0.45. */
export function biogasPlant(i: BiogasInput) {
  let vy = 0;
  let vyc = 0;
  for (const [k, m] of Object.entries(i.feed) as [Feedstock, number][]) {
    vy += m * FEEDSTOCKS[k].yieldM3PerT;
    vyc += m * FEEDSTOCKS[k].yieldM3PerT * FEEDSTOCKS[k].ch4;
  }
  const a = digesterActivity(i.tempC, i.culture);
  const v = vy * hrtFactor(i.hrtDays) * a;
  const x = vy > 0 ? vyc / vy : 0;
  const wKwh = v * x * 9.97;
  return {
    biogasM3PerDay: v,
    ch4Share: x,
    energyMwhPerDay: wKwh / 1000,
    pElAvgMw: (wKwh * 0.4) / 24 / 1000,
    heatAvgMw: (wKwh * 0.45) / 24 / 1000,
    activity: a,
    /** Biomethane (≈ 97 % CH₄) if the gas is upgraded instead, m³/day. */
    biomethaneM3PerDay: (v * x) / 0.97,
    /** Mesophilic culture above 45 °C: «культуру треба адаптувати». */
    cultureWarning: (i.culture ?? 'meso') === 'meso' && i.tempC > 45,
  };
}

/** Flexible engine: 2·P̄ in [6,10) and [17,23), (24 − 20)/14·P̄ otherwise (energy balanced). */
export function flexibleEngineFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  return (h >= 6 && h < 10) || (h >= 17 && h < 23) ? 2 : 4 / 14;
}

/**
 * Gas holder level over a day (flexible mode): size = 10 h of production, 40 % at 00:00; level in % at each step.
 * Control: 06:00 82.9 %, 10:00 42.9 %, 17:00 92.9 % (max), 23:00 32.9 % (min), 24:00 40 %.
 */
export function gasHolderLevel(stepH = 0.25): { hour: number; levelPct: number }[] {
  const out = [{ hour: 0, levelPct: 40 }];
  let level = 0.4 * 10; // hours of production stored
  const n = Math.round(24 / stepH);
  for (let k = 0; k < n; k++) {
    const h = k * stepH;
    level += (1 - flexibleEngineFactor(h)) * stepH;
    out.push({ hour: h + stepH, levelPct: level * 10 });
  }
  return out;
}

/* ------------------------------------------------ step 10 WtE --------------------------------------------- */

export const WASTE_FRACTIONS = {
  organic: { lhv: 4, carbon: 0.15, biogenic: true },
  paper: { lhv: 13, carbon: 0.35, biogenic: true },
  plastic: { lhv: 32, carbon: 0.7, biogenic: false },
  inert: { lhv: 0, carbon: 0, biogenic: false },
} as const;
export type WasteFraction = keyof typeof WASTE_FRACTIONS;

/** Mixture LHV, fossil CO₂ share and plant output (η_el 0.22; CHP: η_el 0.20 + heat 0.60). Shares auto-normalised. */
export function wasteToEnergy(shares: Record<WasteFraction, number>, tPerDay: number, chp = false) {
  const tot = Object.values(shares).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  let lhv = 0;
  let c = 0;
  let cFossil = 0;
  for (const [k, s] of Object.entries(shares) as [WasteFraction, number][]) {
    const f = WASTE_FRACTIONS[k];
    const x = Math.max(0, s) / tot;
    lhv += x * f.lhv;
    c += x * f.carbon;
    if (!f.biogenic) cFossil += x * f.carbon;
  }
  const pTh = (tPerDay * 1000 * lhv) / 86400;
  return {
    lhvMjKg: lhv,
    fossilCo2Share: c > 0 ? cFossil / c : 0,
    needsAuxFuel: lhv < 6,
    pThMw: pTh,
    pElMw: pTh * (chp ? 0.2 : 0.22),
    heatMw: chp ? pTh * 0.6 : 0,
  };
}

/* ------------------------------------------------ M6, M6b ------------------------------------------------- */

/** τ: residues 2 y, energy crops 5 y, whole trees from slow forests 30 y. */
export const CARBON_TAU_Y = { residues: 2, energyCrops: 5, wholeTrees: 30 } as const;

/** D(t) = e^(−t/τ); with BECCS D − 0.9. Payback t_p = τ·ln 20 (D < 0.05). */
export function carbonDebt(tYears: number, tauYears: number, beccs = false): number {
  return Math.exp(-Math.max(0, tYears) / tauYears) - (beccs ? 0.9 : 0);
}
export function carbonPaybackYears(tauYears: number): number {
  return tauYears * Math.log(20);
}

/** Biogas CO₂e per kWh_el: s·GWP(27)·0.717 kg/m³·V_CH₄·1000 + 20 g, V_CH₄ = 1/(9.97·0.40) m³. */
export function biogasCo2ePerKwh(leakShare: number): number {
  const vCh4 = 1 / (9.97 * 0.4);
  return leakShare * 27 * 0.717 * vCh4 * 1000 + 20;
}
/** IPCC AR5 medians for comparison, g CO₂e/kWh. */
export const LIFECYCLE_G_PER_KWH = { ccgt: 490, coal: 820 } as const;
