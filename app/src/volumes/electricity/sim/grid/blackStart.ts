/**
 * grid §А.5 «Пуск з нуля» (step 12, mini-game part 1 «Збери острів»): the shared frequency model with a hydro island
 * (stage 1) and then hydro + one thermal unit (stage 2). Each connected load block is one frequency run; after the run
 * the operator restores 50 Hz: P_L0 += ΔP − P_shed, Δf, P_FCR, P_shed and UFLS timers reset.
 */
import {
  createFrequencyModel,
  islandScenario,
  UFLS_STAGES_UA,
  type FrequencyParams,
} from '@electricity/sim/core/S2-sim/frequency';
import { clamp } from '@electricity/sim/core/S2-sim/math';

export type BlackStartStage = 1 | 2;

export interface BlackStartStageSpec {
  syncMW: number;
  inertiaH: number;
  /** Governor droop gain [MW/Hz] (stage 1: 150 = 4 % droop of a 300 MW hydro unit). */
  gainMWPerHz: number;
  /** Governor time constant [s] (hydro 2 s, steam 4 s). */
  timeConstantS: number;
  /** Upper load limit of the stage [MW]. */
  loadLimitMW: number;
}

export const BLACK_START_STAGES: Readonly<Record<BlackStartStage, BlackStartStageSpec>> = {
  1: { syncMW: 300, inertiaH: 3, gainMWPerHz: 150, timeConstantS: 2, loadLimitMW: 200 },
  2: { syncMW: 800, inertiaH: 4, gainMWPerHz: 400, timeConstantS: 4, loadLimitMW: 300 },
};

/** Initial island load after «власні потреби ТЕС» [MW]. */
export const BLACK_START_INITIAL_LOAD_MW = 100;

/** Frequency-model parameters for a stage at island load P_L0 (§А.5). */
export function blackStartParams(stage: BlackStartStage, loadMW: number): FrequencyParams {
  const s = BLACK_START_STAGES[stage];
  // Stage 1 limit = 200 MW (reserve 300 − 100 of the hydro unit); stage 2 limit = 800 − P_L0.
  const limitMW = stage === 1 ? 200 : Math.max(0, s.syncMW - loadMW);
  const base = islandScenario({ fcr: true, afrr: false, ufls: true, lfsmO: false });
  return {
    ...base,
    loadMW,
    syncMW: s.syncMW,
    inertiaH: s.inertiaH,
    fcr: { enabled: true, gainMWPerHz: s.gainMWPerHz, limitMW, timeConstantS: s.timeConstantS },
    lfsmO: { ...base.lfsmO, enabled: false, flexMW: 0.4 * loadMW },
    ufls: { enabled: true, stages: UFLS_STAGES_UA, delayS: 0.2 },
    integrationStepS: 0.002,
  };
}

export type BlockOutcome = 'ok' | 'ufls' | 'blackout';

export interface BlockResult {
  stage: BlackStartStage;
  loadBeforeMW: number;
  /** Block actually connected after clipping to the stage limit [MW]. */
  blockMW: number;
  nadirHz: number;
  nadirTimeS: number;
  uflsStages: number;
  shedMW: number;
  outcome: BlockOutcome;
  /** Load after the operator restored 50 Hz [MW] (P_L0 + ΔP − P_shed; 100 after a blackout restart). */
  loadAfterMW: number;
}

/**
 * Simulate connecting one load block (default run 20 s; the nadir happens within ~2 s). The game clips the block so
 * that P_L0 does not exceed the stage limit; `clipToStageLimit = false` reproduces the document's remark «at
 * P_L0 = 190 MW a 40 MW block gives 49,19 Hz» (result almost independent of P_L0 because D is small).
 */
export function connectBlock(
  stage: BlackStartStage,
  loadMW: number,
  blockMW: number,
  durationS = 20,
  clipToStageLimit = true,
): BlockResult {
  const spec = BLACK_START_STAGES[stage];
  const dP = clipToStageLimit ? clamp(blockMW, 0, Math.max(0, spec.loadLimitMW - loadMW)) : Math.max(0, blockMW);
  const m = createFrequencyModel(blackStartParams(stage, loadMW));
  m.addEvent(dP);
  const h = m.params.integrationStepS;
  const n = Math.round(durationS / h);
  for (let i = 0; i < n && !m.state.blackout; i++) m.step(h);
  const s = m.state;
  const outcome: BlockOutcome = s.blackout ? 'blackout' : s.pShedMW > 0 ? 'ufls' : 'ok';
  return {
    stage,
    loadBeforeMW: loadMW,
    blockMW: dP,
    nadirHz: s.nadirHz,
    nadirTimeS: s.nadirTimeS,
    uflsStages: s.uflsStagesTripped,
    shedMW: s.pShedMW,
    outcome,
    loadAfterMW: outcome === 'blackout' ? BLACK_START_INITIAL_LOAD_MW : loadMW + dP - s.pShedMW,
  };
}

export interface BlackStartGameState {
  stage: BlackStartStage;
  loadMW: number;
  connections: number;
  uflsEvents: number;
  blackouts: number;
  /** «Синхронізувати ТЕС» is available (stage 1 at its limit). */
  canSynchroniseThermal: boolean;
  /** Stage 2 reached 300 MW. */
  finished: boolean;
  history: BlockResult[];
}

export function newBlackStartGame(): BlackStartGameState {
  return {
    stage: 1,
    loadMW: BLACK_START_INITIAL_LOAD_MW,
    connections: 0,
    uflsEvents: 0,
    blackouts: 0,
    canSynchroniseThermal: false,
    finished: false,
    history: [],
  };
}

function derive(g: BlackStartGameState): BlackStartGameState {
  const lim = BLACK_START_STAGES[g.stage].loadLimitMW;
  return {
    ...g,
    canSynchroniseThermal: g.stage === 1 && g.loadMW >= lim - 1e-9,
    finished: g.stage === 2 && g.loadMW >= lim - 1e-9,
  };
}

/** «Підключити» with the slider value (10…100 MW, step 10). A blackout restarts the game from the hydro unit. */
export function playBlock(g: BlackStartGameState, blockMW: number): BlackStartGameState {
  if (g.finished) return g;
  const r = connectBlock(g.stage, g.loadMW, blockMW);
  if (r.blockMW <= 0) return g;
  const next: BlackStartGameState =
    r.outcome === 'blackout'
      ? { ...newBlackStartGame(), connections: g.connections + 1, uflsEvents: g.uflsEvents, blackouts: g.blackouts + 1 }
      : {
          ...g,
          loadMW: r.loadAfterMW,
          connections: g.connections + 1,
          uflsEvents: g.uflsEvents + (r.outcome === 'ufls' ? 1 : 0),
        };
  next.history = [...g.history, r];
  return derive(next);
}

/** «Синхронізувати ТЕС» → stage 2 (only at the stage-1 limit). */
export function synchroniseThermal(g: BlackStartGameState): BlackStartGameState {
  if (!g.canSynchroniseThermal) return g;
  return derive({ ...g, stage: 2 });
}
