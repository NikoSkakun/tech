import { defineContent } from '@/content';
import raw from '@electricity/content/generated/lab-battery.json';
import { L } from './labels';

/**
 * All on-screen text of the chapter: the generated runtime copy of `docs/volumes/electricity/chapters/lab-battery.md` (never
 * edited or retyped here) plus the scene labels of `labels.ts`. The HUD discovers this module by itself.
 */
export default defineContent(raw, { labels: L });
