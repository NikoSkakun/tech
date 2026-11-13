// Local ESLint rules for the library-of-volumes layout (ARCHITECTURE §2):
//
//   src/<platform>/**                         engine, style, text, ui3d, hud, fx, kit, audio, content
//   src/volumes/<volume>/chapters/<id>/**     a chapter
//   src/volumes/<volume>/{sim,content,…}/**   the rest of the volume
//
// `chapter-boundary` — a chapter's files may import each other freely (`steps/x.ts` → `../parts/y`), the
// platform through `@/…`, and their OWN volume's `sim/**` and `content/**` (through the volume alias
// `@<volume>/…`, `@/volumes/<volume>/…` or a relative path). Never another chapter, never another volume.
//
// `volume-boundary` — nothing inside one volume imports another volume, and platform code never names a volume
// (volumes are discovered with `import.meta.glob`).
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const VOLUMES = path.join(SRC, 'volumes');
/** What a chapter may use from its own volume. */
const SHARED_IN_VOLUME = new Set(['sim', 'content']);

function volumeIds() {
  try {
    return readdirSync(VOLUMES, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Path segments below `src/volumes/` (`[volume, area, …]`), or null for a path outside it. */
function inVolumes(target) {
  const rel = path.relative(VOLUMES, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep);
}

/** Where a source file lives: its volume and, inside `chapters/<id>/`, its chapter (null otherwise). */
function locate(file) {
  const seg = inVolumes(file);
  if (!seg || seg.length < 2) return { volume: null, chapter: null }; // platform, or a file directly in src/volumes/
  // a file directly in chapters/ belongs to no chapter
  return { volume: seg[0], chapter: seg[1] === 'chapters' && seg.length >= 4 ? seg[2] : null };
}

/** Absolute path an import specifier points to, or null for packages and platform aliases. */
function resolveSpec(spec, file, ids) {
  if (spec.startsWith('.')) return path.resolve(path.dirname(file), spec);
  if (spec === '@/volumes' || spec.startsWith('@/volumes/')) return path.join(SRC, spec.slice(2));
  const m = /^@([^/]+)(\/.*)?$/.exec(spec);
  if (m && m[1] && ids.includes(m[1])) return path.join(VOLUMES, m[1], m[2] ?? '');
  return null;
}

function visitor(check) {
  const on = (node) => {
    const source = node.source;
    if (source && source.type === 'Literal' && typeof source.value === 'string') check(source, source.value);
  };
  return { ImportDeclaration: on, ExportNamedDeclaration: on, ExportAllDeclaration: on, ImportExpression: on };
}

/** @type {import('eslint').Rule.RuleModule} */
export const chapterBoundary = {
  meta: {
    type: 'problem',
    docs: { description: 'Chapter files import only their own chapter, the platform and their own volume.' },
    schema: [],
    messages: {
      leaves:
        'Import "{{spec}}" leaves the chapter directory. Use "@/…" for the platform and "@<volume>/sim/…", "@<volume>/content/…" for the volume.',
      other: 'Import "{{spec}}" reaches into another chapter ("{{target}}"). Chapters must not import other chapters.',
      volume: 'Import "{{spec}}" reaches into another volume ("{{target}}"). A chapter uses only its own volume.',
      area: 'Import "{{spec}}": a chapter may use only "sim/**" and "content/**" of its volume, not "{{target}}".',
    },
  },
  create(context) {
    const file = path.resolve(context.filename);
    const here = locate(file);
    if (!here.chapter) return {};
    const ids = volumeIds();
    const root = path.join(VOLUMES, here.volume, 'chapters', here.chapter);
    return visitor((node, spec) => {
      const target = resolveSpec(spec, file, ids);
      if (!target) return;
      if (target === root || target.startsWith(root + path.sep)) return;
      const seg = inVolumes(target);
      if (!seg) {
        // a relative path into the platform (`../../../../kit`) or to src/volumes itself
        context.report({ node, messageId: 'leaves', data: { spec } });
      } else if (seg[0] !== here.volume) {
        context.report({ node, messageId: 'volume', data: { spec, target: seg[0] } });
      } else if (seg[1] === 'chapters') {
        context.report({ node, messageId: 'other', data: { spec, target: seg[2] ?? '' } });
      } else if (!SHARED_IN_VOLUME.has(seg[1] ?? '')) {
        context.report({ node, messageId: 'area', data: { spec, target: seg[1] ?? '' } });
      }
    });
  },
};

/** @type {import('eslint').Rule.RuleModule} */
export const volumeBoundary = {
  meta: {
    type: 'problem',
    docs: { description: 'Volumes do not import each other; platform code does not name a volume.' },
    schema: [],
    messages: {
      cross: 'Import "{{spec}}" reaches into another volume ("{{target}}"). Volumes are independent.',
      platform:
        'Import "{{spec}}": platform code must not import a volume by name — volumes are discovered with import.meta.glob.',
    },
  },
  create(context) {
    const file = path.resolve(context.filename);
    if (!file.startsWith(SRC + path.sep)) return {};
    const here = locate(file);
    const ids = volumeIds();
    return visitor((node, spec) => {
      const target = resolveSpec(spec, file, ids);
      if (!target) return;
      const seg = inVolumes(target);
      // platform, src/volumes itself (globs), or a file directly in it (library.json — the library config)
      if (!seg || seg.length < 2) return;
      const volume = seg[0];
      if (here.volume === null) {
        // files directly in src/volumes/ (library.json consumers) and main.ts are not "platform libraries"
        if (path.dirname(file) === VOLUMES || path.dirname(file) === SRC) return;
        context.report({ node, messageId: 'platform', data: { spec } });
      } else if (volume !== here.volume) {
        context.report({ node, messageId: 'cross', data: { spec, target: volume } });
      }
    });
  },
};

export default { rules: { 'chapter-boundary': chapterBoundary, 'volume-boundary': volumeBoundary } };
