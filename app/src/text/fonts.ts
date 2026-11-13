/**
 * Font data: metrics (JSON) + SDF atlas layers (greyscale PNG → one R8 texture array).
 * Everything is self-hosted under `public/fonts/` and produced offline by `scripts/build-fonts.mjs`;
 * there is no runtime font fetching from third parties and no runtime glyph generation.
 */
import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, UnsignedByteType } from 'three';

/** Faces available to text: display (rounded bold), body, bodyBold, mono (formulas, units). */
export type FaceId = 'display' | 'body' | 'bodyBold' | 'mono';

export const FACE_IDS: readonly FaceId[] = ['display', 'body', 'bodyBold', 'mono'];

/** Raw JSON written by the atlas builder. */
export interface FontJson {
  version: number;
  /** Atlas pixels per em. */
  em: number;
  /** Total signed-distance range in atlas pixels (0…1 of the texel value). */
  range: number;
  width: number;
  height: number;
  faces: Record<
    string,
    {
      layer: number;
      file: string;
      ascender: number;
      descender: number;
      lineGap: number;
      capHeight: number;
      xHeight: number;
      /** [cp, advance] or [cp, advance, left, top, w, h (em), atlasX, atlasY, atlasW, atlasH (px)] */
      glyphs: number[][];
      /** Flat triples: cpA, cpB, kerning in 1/1000 em. */
      kerning: number[];
    }
  >;
}

export interface Glyph {
  /** Horizontal advance in em. */
  advance: number;
  /** False for whitespace (no quad). */
  visible: boolean;
  /** Quad relative to the pen position on the baseline, em (y up). */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Atlas uv rectangle. */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface Face {
  id: FaceId;
  layer: number;
  ascender: number;
  descender: number;
  lineGap: number;
  capHeight: number;
  xHeight: number;
  glyphs: Map<number, Glyph>;
  /** key = cpA * 65536 + cpB → em */
  kerning: Map<number, number>;
}

export interface FontData {
  em: number;
  range: number;
  width: number;
  height: number;
  faces: Record<FaceId, Face>;
}

export function parseFontJson(json: FontJson): FontData {
  const faces = {} as Record<FaceId, Face>;
  for (const id of FACE_IDS) {
    const f = json.faces[id];
    if (!f) throw new Error(`fonts.json: face '${id}' is missing`);
    const glyphs = new Map<number, Glyph>();
    for (const g of f.glyphs) {
      const visible = g.length > 2;
      glyphs.set(g[0]!, {
        advance: g[1]!,
        visible,
        left: visible ? g[2]! : 0,
        top: visible ? g[3]! : 0,
        width: visible ? g[4]! : 0,
        height: visible ? g[5]! : 0,
        u0: visible ? g[6]! / json.width : 0,
        v0: visible ? g[7]! / json.height : 0,
        u1: visible ? (g[6]! + g[8]!) / json.width : 0,
        v1: visible ? (g[7]! + g[9]!) / json.height : 0,
      });
    }
    const kerning = new Map<number, number>();
    for (let i = 0; i + 2 < f.kerning.length; i += 3) {
      kerning.set(f.kerning[i]! * 65536 + f.kerning[i + 1]!, f.kerning[i + 2]! / 1000);
    }
    faces[id] = {
      id,
      layer: f.layer,
      ascender: f.ascender,
      descender: f.descender,
      lineGap: f.lineGap,
      capHeight: f.capHeight,
      xHeight: f.xHeight,
      glyphs,
      kerning,
    };
  }
  return { em: json.em, range: json.range, width: json.width, height: json.height, faces };
}

let data: FontData | null = null;
let atlas: DataArrayTexture | null = null;

/** Font metrics. Throws if fonts are not loaded yet (the engine loads them before any chapter runs). */
export function fontData(): FontData {
  if (!data) throw new Error('text: fonts are not loaded yet (await loadFonts() first)');
  return data;
}

export function fontsReady(): boolean {
  return data !== null;
}

/** Atlas texture array (one layer per face). Null in non-rendering contexts (unit tests). */
export function fontAtlas(): DataArrayTexture | null {
  return atlas;
}

/** Install metrics without textures — for unit tests and tools running outside the browser. */
export function setFontData(json: FontJson): FontData {
  data = parseFontJson(json);
  return data;
}

async function loadLayer(url: string, width: number, height: number): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`text: cannot load font atlas ${url} (${response.status})`);
  const bitmap = await createImageBitmap(await response.blob(), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
  if (bitmap.width !== width || bitmap.height !== height) {
    throw new Error(`text: atlas ${url} is ${bitmap.width}×${bitmap.height}, expected ${width}×${height}`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('text: 2D canvas is unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = rgba[j]!;
  return out;
}

/**
 * Load metrics and atlases from `<base>/fonts/`. Idempotent. `onProgress` receives 0…1.
 * @param baseUrl document base (defaults to `document.baseURI`), so the app works from any sub-path.
 */
export async function loadFonts(
  onProgress?: (fraction: number) => void,
  baseUrl?: string,
): Promise<FontData> {
  if (data && atlas) return data;
  const base = new URL('fonts/', baseUrl ?? document.baseURI);
  // metrics are revalidated on every load; the atlases they point to carry a content hash in their URL
  const response = await fetch(new URL('fonts.json', base), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`text: cannot load fonts.json (${response.status})`);
  const json = (await response.json()) as FontJson;
  const parsed = parseFontJson(json);
  const layers = FACE_IDS.length;
  const pixels = new Uint8Array(json.width * json.height * layers);
  let done = 0;
  onProgress?.(0.1);
  await Promise.all(
    FACE_IDS.map(async (id) => {
      const face = json.faces[id]!;
      const layer = await loadLayer(new URL(face.file, base).href, json.width, json.height);
      pixels.set(layer, face.layer * json.width * json.height);
      onProgress?.(0.1 + (0.9 * ++done) / layers);
    }),
  );
  const texture = new DataArrayTexture(pixels, json.width, json.height, layers);
  texture.format = RedFormat;
  texture.type = UnsignedByteType;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.unpackAlignment = 1;
  texture.userData.shared = true; // engine-lifetime: chapter disposal must not free it
  texture.needsUpdate = true;
  atlas = texture;
  data = parsed;
  return parsed;
}
