/**
 * Texts of the 17 Standard Model cards (step `standard-model`), verbatim from the table in the chapter
 * document's «Модель симуляції» §6. The runtime export does not carry model-section tables (requested in
 * docs/requests/B-atom.md), so this copy lives here; numbers (charge, spin, mass) come from `@electricity/sim/atom`.
 * `mass` is given only where the document words it instead of quoting a number (neutrinos).
 */
export interface ParticleText {
  name: string;
  discovered: string;
  where: string;
  mass?: string;
}

export const SM_TEXT: Record<string, ParticleText> = {
  up: {
    name: 'u-кварк («верхній»)',
    discovered: '1968, SLAC',
    where: 'У кожному протоні й нейтроні.',
  },
  down: {
    name: 'd-кварк («нижній»)',
    discovered: '1968, SLAC',
    where: 'У кожному протоні й нейтроні.',
  },
  charm: {
    name: 'c-кварк («чарівний»)',
    discovered: '1974, SLAC і Brookhaven',
    where: 'У короткоживучих частинках на прискорювачах і в космічних променях.',
  },
  strange: {
    name: 's-кварк («дивний»)',
    discovered: '1947 — перші «дивні» частинки; кваркова природа — 1964–1968',
    where: 'У каонах і гіперонах; можливо, в надрах нейтронних зір.',
  },
  top: {
    name: 't-кварк («істинний»)',
    discovered: '1995, Fermilab',
    where: 'Найважча елементарна частинка; розпадається за ~5×10⁻²⁵ s.',
  },
  bottom: {
    name: 'b-кварк («красивий»)',
    discovered: '1977, Fermilab',
    where: 'У B-мезонах на прискорювачах.',
  },
  electron: {
    name: 'електрон',
    discovered: '1897, Дж. Дж. Томсон',
    where: 'У кожному атомі; головний носій струму.',
  },
  muon: {
    name: 'мюон',
    discovered: '1936, Андерсон і Неддермеєр',
    where: 'У космічних променях: крізь долоню щосекунди пролітає приблизно один.',
  },
  tau: {
    name: 'тау-лептон',
    discovered: '1975, SLAC (М. Перл)',
    where: 'Лише на прискорювачах; живе ~3×10⁻¹³ s.',
  },
  'nu-e': {
    name: 'електронне нейтрино',
    discovered: '1956, Коуен і Райнес',
    where: 'Народжується в Сонці, реакторах, β-розпаді.',
    mass: 'не нуль, але < 0,45 eV/c² (KATRIN, 2025)',
  },
  'nu-mu': {
    name: 'мюонне нейтрино',
    discovered: '1962, Brookhaven',
    where: 'У космічних променях і пучках прискорювачів.',
    mass: 'не нуль, дуже мала',
  },
  'nu-tau': {
    name: 'тау-нейтрино',
    discovered: '2000, Fermilab (DONUT)',
    where: 'Нейтрино в польоті перетворюються одне на одне (осциляції).',
    mass: 'не нуль, дуже мала',
  },
  gluon: {
    name: 'глюон',
    discovered: '1979, DESY',
    where: 'Усередині протонів і нейтронів; поодинці не трапляється.',
  },
  photon: {
    name: 'фотон',
    discovered: '1905 — ідея Ейнштейна; 1923 — дослід Комптона',
    where: 'Світло, радіохвилі, рентген; переносник електромагнітної взаємодії.',
  },
  w: {
    name: 'W-бозон',
    discovered: '1983, CERN',
    where: 'Переносник слабкої взаємодії: β-розпад, термоядерні реакції в Сонці.',
  },
  z: {
    name: 'Z-бозон',
    discovered: '1983, CERN',
    where: 'Переносник слабкої взаємодії без зміни заряду.',
  },
  higgs: {
    name: 'бозон Гіґґса',
    discovered: '2012, CERN (ATLAS і CMS)',
    where: 'Народжується в зіткненнях на LHC; розпадається за ~10⁻²² s.',
  },
};
