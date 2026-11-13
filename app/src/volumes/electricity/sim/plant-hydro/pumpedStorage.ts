/**
 * plant-hydro M7 (step 8) — a PSH day with one unit (illustrative station). H = 150 m, V_max = 10⁷ m³, V0 = 0,3·V_max.
 *   P_turb = 324 MW (η_t 0,90) → Q_t = P/(η_t·ρ·g·H) = 244,6 m³/s; P_pump = 421 MW (η_p 0,88) → Q_p = η_p·P/(ρ·g·H) = 251,8 m³/s
 *   each hour: pump V += Q_p·3600 (≤ V_max), W_in += 421 MWh; turbine V −= Q_t·3600 (≥ 0), W_out += 324 MWh;
 *   partial hour at a limit — proportional; profit = Σ price_h·(W_out,h − W_in,h).
 *   Stored energy W = η_t·ρ·g·H·V/3,6·10⁹ MWh (full: 3679 MWh); cycle efficiency 3679/4645 = 0,792.
 */
export const PSH = { headM: 150, volumeMaxM3: 1e7, v0Share: 0.3, turbineMW: 324, pumpMW: 421, etaT: 0.9, etaP: 0.88 } as const;
const RG = 1000 * 9.81;
export const Q_TURBINE = (PSH.turbineMW * 1e6) / (PSH.etaT * RG * PSH.headM);
export const Q_PUMP = (PSH.etaP * PSH.pumpMW * 1e6) / (RG * PSH.headM);

/** Hourly prices h0…h23 [€/MWh]. */
export const PSH_PRICES = [40, 40, 40, 40, 40, 45, 60, 120, 120, 100, 70, 40, 30, 30, 40, 60, 90, 160, 160, 150, 120, 90, 60, 45] as const;

export type PshHourMode = 'pump' | 'turbine' | 'stop';

/** «Автоплан»: pump [0, 6) and [12, 14), turbine [7, 10) and [17, 22). */
export const AUTO_PLAN: readonly PshHourMode[] = Array.from({ length: 24 }, (_, h) =>
  (h < 6 || (h >= 12 && h < 14) ? 'pump' : (h >= 7 && h < 10) || (h >= 17 && h < 22) ? 'turbine' : 'stop'),
);

export function storedEnergyMWh(volumeM3: number): number {
  return (PSH.etaT * RG * PSH.headM * volumeM3) / 3.6e9;
}

/** Full cycle: pumping the empty reservoir full and turbining it empty. */
export function fullCycle(): { pumpHours: number; turbineHours: number; energyInMWh: number; energyOutMWh: number; efficiency: number } {
  const tp = PSH.volumeMaxM3 / Q_PUMP / 3600;
  const tt = PSH.volumeMaxM3 / Q_TURBINE / 3600;
  const win = tp * PSH.pumpMW;
  const wout = tt * PSH.turbineMW;
  return { pumpHours: tp, turbineHours: tt, energyInMWh: win, energyOutMWh: wout, efficiency: wout / win };
}

export interface PshHour {
  hour: number;
  mode: PshHourMode;
  /** Fraction of the hour actually run (< 1 when the reservoir hit a limit). */
  fraction: number;
  volumeEndM3: number;
  energyInMWh: number;
  energyOutMWh: number;
  profitEur: number;
}

export interface PshDay {
  hours: PshHour[];
  energyInMWh: number;
  energyOutMWh: number;
  volumeEndM3: number;
  maxVolumeM3: number;
  revenueEur: number;
  costEur: number;
  profitEur: number;
}

export function simulatePshDay(plan: readonly PshHourMode[], v0 = PSH.v0Share * PSH.volumeMaxM3): PshDay {
  let v = v0;
  let vmax = v0;
  const hours: PshHour[] = plan.slice(0, 24).map((mode, hour) => {
    let fraction = 0;
    if (mode === 'pump') fraction = Math.min(1, (PSH.volumeMaxM3 - v) / (Q_PUMP * 3600));
    else if (mode === 'turbine') fraction = Math.min(1, v / (Q_TURBINE * 3600));
    fraction = Math.max(0, fraction);
    if (mode === 'pump') v += Q_PUMP * 3600 * fraction;
    if (mode === 'turbine') v -= Q_TURBINE * 3600 * fraction;
    vmax = Math.max(vmax, v);
    const win = mode === 'pump' ? PSH.pumpMW * fraction : 0;
    const wout = mode === 'turbine' ? PSH.turbineMW * fraction : 0;
    return { hour, mode, fraction, volumeEndM3: v, energyInMWh: win, energyOutMWh: wout, profitEur: PSH_PRICES[hour]! * (wout - win) };
  });
  const revenue = hours.reduce((s, h) => s + PSH_PRICES[h.hour]! * h.energyOutMWh, 0);
  const cost = hours.reduce((s, h) => s + PSH_PRICES[h.hour]! * h.energyInMWh, 0);
  return {
    hours,
    energyInMWh: hours.reduce((s, h) => s + h.energyInMWh, 0),
    energyOutMWh: hours.reduce((s, h) => s + h.energyOutMWh, 0),
    volumeEndM3: v,
    maxVolumeM3: vmax,
    revenueEur: revenue,
    costEur: cost,
    profitEur: revenue - cost,
  };
}
