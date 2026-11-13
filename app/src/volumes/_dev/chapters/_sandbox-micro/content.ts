import { defineContent } from '@/content';

/** All Ukrainian text of the micro sandbox (term rule: international term first). */
const text = {
  steps: {
    atom: {
      title: 'Атом',
      body:
        '**Atom** — атом: крихітне **nucleus** (ядро) і хмара електронів навколо. ' +
        'Розмір атома ≈ `10^{-10} m`, ядра — лише `10^{-15} m`: атом майже порожній.',
    },
    nucleus: {
      title: 'Ядро',
      body:
        'У ядрі — {coral:protons} (p⁺, заряд `+e`) і {mist:neutrons} (n⁰, без заряду). ' +
        'Їх утримує **strong force** — сильна взаємодія, у ~100 разів сильніша за електричне відштовхування.',
    },
    electron: {
      title: 'Електрон',
      body:
        '**Electron** — електрон (e⁻): заряд `−e = −1,602×10^{-19} C`, маса у ~1836 разів менша, ніж у протона. ' +
        'Саме рух електронів ми називаємо _електричним струмом_.',
    },
    excited: {
      title: 'Збуджений стан',
      body:
        'Отримавши енергію, електрон «стрибає» на вищий рівень, а повертаючись — випромінює {yellow:photon} з енергією ' +
        '`E = h·ν`. Перетягни електрон далі від ядра й відпусти.',
    },
  },
  labels: {
    nucleus: 'Nucleus — ядро',
    proton: 'Proton p⁺',
    neutron: 'Neutron n⁰',
    electron: 'Electron e⁻',
    cloud: 'Електронна хмара',
    photon: 'Photon γ',
    drag: 'Перетягни електрон',
  },
} as const;

/** Scene labels (callouts, tooltips, Text3D captions). */
export const labels = text.labels;

/** Step panels: the HUD shows them (UI_API §2) — one page per step, in the manifest's order. */
export default defineContent(
  {
    id: '_sandbox-micro',
    steps: Object.entries(text.steps).map(([id, s]) => ({ id, title: s.title, panel: [s.body] })),
  },
  { labels },
);
