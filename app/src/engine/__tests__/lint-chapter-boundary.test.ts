// Lint regression: the boundary rules (eslint-rules/chapter-boundary.js). A chapter may import its own files,
// the platform (`@/…`) and its own volume's `sim/**` / `content/**`; never another chapter or another volume.
// Volumes do not import each other and platform code does not name a volume.
// The fixtures are linted as virtual files at the given paths, so nothing here lands in `pnpm lint`.
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const appDir = fileURLToPath(new URL('../../..', import.meta.url));
const eslint = new ESLint({ cwd: appDir });

async function errors(rule: string, file: string, code: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath: `${appDir}/${file}` });
  return (res?.messages ?? []).filter((m) => m.ruleId === `local/${rule}`).map((m) => m.message);
}
const boundaryErrors = (file: string, code: string): Promise<string[]> =>
  errors('chapter-boundary', file, code);

const CH = 'src/volumes/electricity/chapters/demo';

const PASS: [string, string][] = [
  [`${CH}/steps/intro.ts`, "export { a } from '../parts/a';"],
  [`${CH}/steps/deep/x.ts`, "import { a } from '../../parts/a';\nexport const b = a;"],
  [`${CH}/scene.ts`, "import { a } from './parts/a';\nexport const b = a;"],
  [`${CH}/parts/a.ts`, "export { b } from '../scene';"],
  [`${CH}/steps/intro.ts`, "export { b } from '@electricity/chapters/demo/scene';"],
  [`${CH}/steps/intro.ts`, "export const m = () => import('../parts/a');"],
  // the chapter's own volume: simulations and generated content
  [`${CH}/scene.ts`, "export { a } from '@electricity/sim/demo';"],
  [`${CH}/content.ts`, "export { default } from '@electricity/content/generated/demo.json';"],
  [`${CH}/scene.ts`, "export { a } from '@/volumes/electricity/sim/core/x';"],
  [`${CH}/index.ts`, "export { default } from '../../content/generated/demo.manifest.json';"],
  ['src/volumes/_demo/chapters/one/scene.ts', "export { a } from '@/volumes/_demo/sim/x';"],
];

const FAIL: [string, string][] = [
  [`${CH}/scene.ts`, "export { a } from '../other/scene';"],
  [`${CH}/steps/intro.ts`, "export { a } from '../../other/parts/a';"],
  [`${CH}/steps/intro.ts`, "export { a } from '../../../../../kit';"],
  [`${CH}/parts/a.ts`, "export { a } from '../parts/../../other/a';"],
  [`${CH}/steps/intro.ts`, "export { a } from '@electricity/chapters/other/scene';"],
  [`${CH}/steps/intro.ts`, "export const m = () => import('../../other/scene');"],
  // another volume, and parts of the own volume that are not for chapters
  ['src/volumes/_demo/chapters/one/scene.ts', "export { a } from '@electricity/sim/atom';"],
  ['src/volumes/_demo/chapters/one/scene.ts', "export { a } from '../../../electricity/sim/atom';"],
  [`${CH}/scene.ts`, "export { default } from '@electricity/volume';"],
  [`${CH}/scene.ts`, "export { a } from '@/volumes/_dev/chapters/_sandbox-ui/scene';"],
];

describe('lint: chapter-boundary', () => {
  it.each(PASS)('allows %s → %s', async (file, code) => {
    expect(await boundaryErrors(file, code)).toEqual([]);
  });
  it.each(FAIL)('rejects %s → %s', async (file, code) => {
    expect((await boundaryErrors(file, code)).length).toBe(1);
  });
  it('does not apply outside chapters', async () => {
    expect(await boundaryErrors('src/kit/x.ts', "export { a } from '../fx/a';")).toEqual([]);
    expect(await boundaryErrors('src/volumes/electricity/sim/a/x.ts', "export { a } from '../b/y';")).toEqual(
      [],
    );
  });
});

describe('lint: volume-boundary', () => {
  const volumeErrors = (file: string, code: string): Promise<string[]> =>
    errors('volume-boundary', file, code);
  it('keeps volumes independent', async () => {
    const sim = 'src/volumes/_demo/sim/x.ts';
    expect(await volumeErrors(sim, "export { a } from '@electricity/sim/core/y';")).toHaveLength(1);
    expect(await volumeErrors(sim, "export { a } from '../../electricity/sim/core/y';")).toHaveLength(1);
    expect(await volumeErrors(sim, "export { a } from './y';")).toEqual([]);
    expect(await volumeErrors(sim, "export { a } from '@/content';")).toEqual([]);
  });
  it('keeps the platform free of volume names', async () => {
    expect(
      await volumeErrors('src/hud/x.ts', "export { a } from '@electricity/fixtures/journey';"),
    ).toHaveLength(1);
    expect(
      await volumeErrors('src/engine/x.ts', "export { a } from '../volumes/electricity/volume';"),
    ).toHaveLength(1);
    expect(await volumeErrors('src/engine/x.ts', "export { a } from '@/hud';")).toEqual([]);
  });
});
