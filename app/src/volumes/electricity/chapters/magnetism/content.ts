import { defineContent } from '@/content';
import raw from '@electricity/content/generated/magnetism.json';
import { OWN } from './labels-own';

/**
 * All on-screen text of the chapter: the generated runtime copy of
 * `docs/volumes/electricity/chapters/magnetism.md` (never edited or retyped here) plus the scene labels the
 * document does not carry. The HUD discovers this module by itself.
 */
/** `OWN` as flat string labels (lists become `key.0`, `key.1`, …). */
const labels: Record<string, string> = {};
for (const [key, value] of Object.entries(OWN)) {
  if (typeof value === 'string') labels[key] = value;
  else value.forEach((item, k) => (labels[`${key}.${k}`] = item));
}

export default defineContent(raw, { labels });
