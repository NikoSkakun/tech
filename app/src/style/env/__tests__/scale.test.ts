import { type FogExp2, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { QUALITY_PROFILES } from '@/engine/quality';
import { Environment, LOOK_SCALE } from '../environment';

describe('env.setScale unit convention', () => {
  const make = () => {
    const scene = new Scene();
    const env = new Environment(scene, { preset: 'day', accent: 'cyan' }, QUALITY_PROFILES.high);
    return { scene, env, base: env.params.fogDensity };
  };

  it('leaves fog as authored without adaptFrom', () => {
    const { scene, env, base } = make();
    env.setScale(60);
    expect((scene.fog as FogExp2).density).toBeCloseTo(base, 9);
    expect(env.lookScale).toBe(1);
  });

  it('scales fog density (÷k) and the look factor (×k) with adaptFrom', () => {
    const { scene, env, base } = make();
    env.setScale(60, { adaptFrom: LOOK_SCALE.diorama });
    const k = 60 / LOOK_SCALE.diorama;
    expect(env.lookScale).toBeCloseTo(k, 9);
    expect((scene.fog as FogExp2).density).toBeCloseTo(base / k, 9);
    env.tune({ fogDensity: 0.02 }, { duration: 0 });
    expect((scene.fog as FogExp2).density).toBeCloseTo(0.02 / k, 9);
  });
});
