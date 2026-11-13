# THIRD PARTY — libraries, fonts, algorithms

Policy (ARCHITECTURE §1): MIT / Apache-2.0 / BSD / OFL / CC0 only; no runtime network dependencies; everything
is bundled or served from `app/public`. Add a row here for every third-party asset or library you introduce.
Versions are pinned exactly in `app/package.json`.

## Shipped in the application

| Item | Version | Licence | Used for | Where |
|---|---|---|---|---|
| three.js | 0.187.0 | MIT | WebGL2 renderer, scene graph, math | `dependencies` (bundled, own chunk `three-*.js`) |
| three.js `FXAAShader` (examples/jsm) | 0.187.0 | MIT — FXAA by NVIDIA (T. Lottes), port by J. Flick / D. Hoskins | final anti-aliasing pass | `engine/pipeline/shaders.ts` |
| three.js `RoundedBoxGeometry` (examples/jsm) | 0.187.0 | MIT | rounded boxes in the diorama sandbox | `chapters/_sandbox-diorama` |
| Nunito ExtraBold | Google Fonts release packaged in `@expo-google-fonts/nunito` 0.4.2 | SIL OFL 1.1 — © 2014 The Nunito Project Authors | display face (SDF atlas `display.png`) | `app/public/fonts/` |
| Fira Sans Regular / Medium / SemiBold / Bold | `@expo-google-fonts/fira-sans` 0.4.1 | SIL OFL 1.1 — © 2012–2015 The Mozilla Foundation and Telefonica S.A. | body faces (`body.png`, `bodyBold.png`), fallback glyphs | `app/public/fonts/` |
| JetBrains Mono Medium | `@expo-google-fonts/jetbrains-mono` 0.4.1 | SIL OFL 1.1 — © 2020 The JetBrains Mono Project Authors | mono / formula face (`mono.png`) | `app/public/fonts/` |
| Noto Sans Math Regular | `@expo-google-fonts/noto-sans-math` 0.4.2 | SIL OFL 1.1 — © 2022 The Noto Project Authors | fallback glyphs: arrows, math operators | `app/public/fonts/` |
| Noto Sans Symbols 2 Regular | `@expo-google-fonts/noto-sans-symbols-2` 0.4.1 | SIL OFL 1.1 — © 2022 The Noto Project Authors | fallback glyphs: shapes, dingbats | `app/public/fonts/` |

The font files themselves are not shipped. `app/scripts/build-fonts.mjs` (`pnpm fonts`) rasterises the needed
glyphs into signed-distance-field atlases (`app/public/fonts/*.png` + `fonts.json`); the OFL texts are shipped
next to them in `app/public/fonts/licenses/`. The `@expo-google-fonts/*` packages (MIT packaging, OFL fonts)
are build-time dependencies only.

## Development / build / QA tooling (not shipped)

| Item | Version | Licence | Used for |
|---|---|---|---|
| Vite (+ Rolldown) | 8.3.8 | MIT | dev server, production build |
| TypeScript | 6.0.3 | Apache-2.0 | type checking (6.x because typescript-eslint 8.72 supports `< 6.1`) |
| Vitest | 5.1.0 | MIT | unit tests |
| ESLint, `@eslint/js`, typescript-eslint, eslint-config-prettier, globals | 10.14.0 / 10.0.1 / 8.72.2 / 10.1.8 / 17.14.0 | MIT | linting |
| Prettier | 3.10.1 | MIT | formatting |
| playwright-core | 1.65.0 | Apache-2.0 | QA automation (drives the system Google Chrome; no bundled browser) |
| fontkit | 3.0.0 | MIT | font parsing + kerning (shaping) in the atlas builder |
| pngjs | 7.0.0 | MIT | PNG encoding in the atlas builder |
| `@types/three`, `@types/node` | 0.187.0 / 24.9.2 | MIT | typings |

## Algorithms implemented from publications (own code, no third-party source copied)

| Algorithm | Reference | Where |
|---|---|---|
| Exact Euclidean distance transform | P. Felzenszwalb, D. Huttenlocher, "Distance Transforms of Sampled Functions", 2012 | `app/scripts/build-fonts.mjs` |
| Bloom down/up-sampling filter | J. Jimenez, "Next Generation Post Processing in Call of Duty: Advanced Warfare", SIGGRAPH 2014 | `engine/pipeline/shaders.ts` |
| Single-pass bokeh depth of field | D. Gustafsson, "Bokeh depth of field in a single pass", 2018 | `engine/pipeline/shaders.ts` |
| Ambient obscurance estimator | M. McGuire et al., "Scalable Ambient Obscurance", HPG 2012 (Alchemy AO) | `engine/pipeline/shaders.ts` |
| Interleaved gradient noise | J. Jimenez, SIGGRAPH 2014 | post shaders, K materials |
| Seeded RNG mulberry32 | T. Ettinger (public domain) | `engine/random.ts` |

Deliberately **not** used: GSAP (its licence is not MIT/Apache/BSD), the `postprocessing` package and
`troika-three-text` (replaced by the engine's own pipeline and SDF text, see `docs/ENGINE_API.md`).
