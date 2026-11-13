/**
 * grid §Б.1–Б.2 applied to the dispatcher day: load with events (cold snap ×1,03 from 17:30), PV with weather and
 * the cloud event (×0,5 13:00–14:00), wind, and nuclear / coal trips.
 */
import { gridLoadMW, pvOutputMW, PV_WEATHER, windOutputMW } from '@electricity/sim/core/S2-sim/profiles';
import { type DayEvent, type DispatcherScenario } from './fleet';

export interface Environment {
  loadMW: number;
  pvAvailableMW: number;
  windMW: number;
  nuclearTrips: number;
  coalTripDue: boolean;
}

/** Load multiplier from events active at `min` (minute of day). */
export function loadFactor(events: readonly DayEvent[], min: number): number {
  let k = 1;
  for (const e of events) if (e.kind === 'coldSnap' && min >= e.fromMin) k *= e.factor;
  return k;
}

export function pvFactor(events: readonly DayEvent[], min: number): number {
  let k = 1;
  for (const e of events) if (e.kind === 'clouds' && min >= e.fromMin && min < e.toMin) k *= e.factor;
  return k;
}

/** Environment at minute `min`; `noise` is the AR(1) forecast error ε (0 in tests). */
export function environmentAt(sc: DispatcherScenario, events: readonly DayEvent[], min: number, noise = 0): Environment {
  const h = min / 60;
  return {
    loadMW: gridLoadMW(sc.season, h) * loadFactor(events, min) * (1 + noise),
    pvAvailableMW: pvOutputMW(sc.pvInstalledMW, sc.season, h, PV_WEATHER[sc.weather] * pvFactor(events, min)),
    windMW: windOutputMW(sc.windInstalledMW, sc.wind, h),
    nuclearTrips: events.filter((e) => e.kind === 'nuclearTrip' && min >= e.atMin).length,
    coalTripDue: events.some((e) => e.kind === 'coalTrip' && e.atMin === min),
  };
}
