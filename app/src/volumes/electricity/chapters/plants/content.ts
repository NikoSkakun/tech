import { defineContent } from '@/content';
import raw from '@electricity/content/generated/plants.json';
import { OWN } from './labels-own';

/**
 * All on-screen text of the chapter: the generated runtime copy of
 * `docs/volumes/electricity/chapters/plants.md` (never edited or retyped here) plus the scene labels of
 * `labels-own.ts`. The HUD discovers this module by itself.
 */
export default defineContent(raw, { labels: OWN });
