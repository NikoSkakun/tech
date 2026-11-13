/**
 * Stand 8 — oscilloscope wall: a phasor diagram whose arrows cast the three-phase traces of the scope next
 * to it, a second scope with a distorted wave and its harmonics as spectrum bars, a PWM pulse train with its
 * sine reference, and a wave travelling along a wire.
 */
import { BoxGeometry, CatmullRomCurve3, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  createPhasors,
  createPulseTrain,
  createScope,
  createSpectrumBars,
  createWaveOnCurve,
  createWire,
  harmonics,
  sine,
  spectrum,
  spwm,
  threePhase,
} from '@/fx';
import { K } from '@/style';
import type { Exhibit } from './exhibit';

export function createSignalsExhibit(_ctx: ChapterContext): Exhibit {
  const group = new Group();
  group.name = 'exhibit:signals';

  // the wall: a console slab leaning back slightly
  const wall = new Group();
  wall.position.set(0, 2.75, 0);
  wall.rotation.x = -0.12;
  group.add(wall);
  const slab = new Mesh(new BoxGeometry(10.6, 4.9, 0.3), K.toon({ color: 'bg.indigo', gradient: { bottom: 'bg.deep', top: 'bg.violet', range: [-2.4, 2.4] } }));
  slab.position.z = -0.2;
  slab.castShadow = true;
  slab.receiveShadow = true;
  wall.add(slab);

  // top row: phasors + three-phase scope sharing one phase
  const phasors = createPhasors({ size: 2.0, frequency: 0.3 });
  phasors.position.set(-3.75, 1.05, 0);
  const scope3 = createScope({ width: 5.6, height: 2.0, cycles: 2, frequency: 0.3 });
  scope3.position.set(1.45, 1.05, 0);
  ([0, 1, 2] as const).forEach((k) => scope3.setWave(k, threePhase(k), 0.9));
  wall.add(phasors, scope3);

  // bottom left: a wave with harmonics and its spectrum
  const distorted = harmonics([1, 0, 0.33, 0, 0.2, 0, 0.14]);
  const scopeH = createScope({ width: 3.0, height: 1.7, channels: ['cyan', 'steel'], cycles: 2, frequency: 0.3 });
  scopeH.position.set(-3.4, -1.25, 0);
  scopeH.setWave(0, distorted, 0.72);
  scopeH.setWave(1, sine(), 0.72);
  scopeH.setChannelIntensity(1, 0.6);
  const bars = createSpectrumBars({ count: 9, width: 2.2, height: 1.35, color: 'cyan' });
  bars.position.set(-0.45, -2.0, 0.12);
  bars.set(spectrum(distorted, 9));
  wall.add(scopeH, bars);

  // bottom right: SPWM pulses over their sine reference
  const pwmScope = createScope({ width: 4.1, height: 1.7, channels: ['steel'], cycles: 1, frequency: 0.12 });
  pwmScope.position.set(2.95, -1.25, 0);
  pwmScope.setWave(0, sine(), 0.8);
  pwmScope.setChannelIntensity(0, 0.7);
  const pwm = createPulseTrain({ wave: spwm(0.8, 15), length: 4.1 * 0.94, height: 1.7 * 0.8 * 0.92, cycles: 1, frequency: 0.12, color: 'yellow' });
  pwm.position.set(2.95, -1.25, 0.05);
  pwm.renderOrder = 5;
  wall.add(pwmScope, pwm);

  // in front of the wall: a wire carrying a travelling wave
  const path = new CatmullRomCurve3([new Vector3(-5, 0.35, 1.5), new Vector3(-1.5, 0.5, 2.0), new Vector3(2, 0.4, 1.7), new Vector3(5, 0.35, 1.4)]);
  const wire = createWire(path, { radius: 0.045, color: 'slate', power: 0.15, repeat: 0.6 });
  const wave = createWaveOnCurve(path, { amplitude: 0.28, wavelength: 1.6, speed: 1.2, color: 'yellow' });
  group.add(wire, wave);

  return {
    group,
    update() {
      // the scope's phase is the phasors' angle: the traces are literally the arrows' projections
      phasors.angle = scope3.phase + 2 * 2 * Math.PI; // right edge of the screen (2 cycles later)
      pwm.phase = pwmScope.phase;
    },
  };
}
