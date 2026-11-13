/**
 * The chapter manifests of this volume as ONE lazy chunk (`volume-<id>`), requested when the volume is first
 * needed. Never edited: a chapter registers itself by having `chapters/<id>/index.ts`. Every volume has this
 * same file (copy it when starting a volume).
 */
export default import.meta.glob('./chapters/*/index.ts', { eager: true });
