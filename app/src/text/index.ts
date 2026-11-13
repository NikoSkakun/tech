/**
 * `@/text` — SDF text for the 3D scene and the HUD.
 *
 *   import { Text3D, measureText } from '@/text';
 *   const label = new Text3D('**Electron** — електрон, заряд `−e`', { size: 0.4, accent: 'cyan', billboard: true });
 */
export { Text3D, measureText, textViewport, type TextStyle } from './text3d';
export {
  layoutText,
  layoutRuns,
  type LayoutOptions,
  type LayoutResult,
  type LaidGlyph,
  type TextMetrics,
  type TextSpan,
  type TextAlign,
  type AnchorX,
  type AnchorY,
} from './layout';
export { parseRich, stripRich, bindUnits, NBSP, type Run, type RunColor } from './rich';
export {
  loadFonts,
  fontsReady,
  fontData,
  fontAtlas,
  setFontData,
  FACE_IDS,
  type FaceId,
  type FontData,
  type FontJson,
  type Face,
  type Glyph,
} from './fonts';
