import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/phase.manifest.json';

/**
 * Chapter 6 of the volume `water`: «Чому лід тане, а вода кипить?» (docs/volumes/water/chapters/phase.md). Five
 * steps on the same sample of 252 molecules, now on two roads the reader scrubs with a slider of heat: ice at
 * −20 °C → water at +20 °C (melting, the thermometer standing at zero) and water → steam (boiling, the long shelf
 * at a hundred), then the first road walked back. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'phase',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'sky', sky: 'micro', mood: 'micro' },
  load: () => import('./scene'),
});
