#!/usr/bin/env python3
"""Unit tests of the simple reading level in the content pipeline: `python3 tools/content/test_simple_layer.py`."""
import os
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chapters as C  # noqa: E402
import export_content as X  # noqa: E402
import export_runtime as R  # noqa: E402
import simple_check as SC  # noqa: E402
import simple_layer as SL  # noqa: E402

STEP = '''### 1. `demo` — Демо
- **Текст панелі:**
  1. «Сторінка.»
- **Хибні уявлення:** «Міф» → пояснення. [Сцена: кулька `cyan` світиться.]
- **Просто:**
  - **Назва:** Коротко
  - **Текст:**
    - **[1]** «Перша сторінка з „цитатою“.»
    - **[2]** Друга сторінка,
      що переноситься.
  - **Слова:**
    - **хвиля** — рух, що біжить.
  - **Цікаво:**
    - Факт перший.
  - **Підказки:**
    - `bead`: «Кулька стрибає.»
  - **Хибне уявлення:** «Кульки біжать» → ні, біжить рух.
  - **Примітки:** перевірено.
- **Перехід:** далі.'''.split('\n')


class ParseSimple(unittest.TestCase):
    def test_block(self):
        x = SL.parse_simple(STEP, 0, len(STEP), 'demo')
        self.assertEqual(x['title'], 'Коротко')
        self.assertEqual(x['panel'], ['Перша сторінка з «цитатою».', 'Друга сторінка, що переноситься.'])
        self.assertEqual(x['words'], [{'word': 'хвиля', 'text': 'рух, що біжить.'}])
        self.assertEqual(x['facts'], ['Факт перший.'])
        self.assertEqual(x['hotspots'], [{'id': 'bead', 'text': 'Кулька стрибає.'}])
        self.assertEqual(x['misconception'], {'myth': 'Кульки біжать', 'correction': 'ні, біжить рух.'})
        self.assertEqual(x['notes'], 'перевірено.')

    def test_round_trip_signature(self):
        x = SL.parse_simple(STEP, 0, len(STEP), 'demo')
        self.assertEqual(X.sig(SL.doc_signature_text(STEP, 0, len(STEP))), X.sig(SL.export_signature_text(x)))

    def test_absent_and_unknown(self):
        self.assertIsNone(SL.parse_simple(STEP[:4], 0, 4, 'demo'))
        bad = STEP[:5] + ['  - **Невідоме:** щось']
        with self.assertRaises(SystemExit):
            SL.parse_simple(bad, 0, len(bad), 'demo')

    def test_runtime(self):
        r = R.runtime_simple(SL.parse_simple(STEP, 0, len(STEP), 'demo'))
        self.assertEqual(r['hotspots'], [{'id': 'bead', 'text': 'Кулька стрибає.'}])
        self.assertNotIn('notes', r)
        self.assertEqual(sorted(r), ['facts', 'hotspots', 'misconception', 'panel', 'title', 'words'])


class Scene(unittest.TestCase):
    def test_split(self):
        self.assertEqual(SL.split_scene('пояснення. [Сцена: кадр [1] показує.]'),
                         ('пояснення.', 'кадр [1] показує.', None))
        self.assertEqual(SL.split_scene('пояснення.'), ('пояснення.', None, None))
        self.assertIsNotNone(SL.split_scene('а [Сцена: б] в')[2])
        self.assertIsNotNone(SL.split_scene('а [Сцена: б')[2])

    def test_misconception_export(self):
        m = X.parse_misconceptions(dict(inline='«Міф» → пояснення. [Сцена: кулька світиться.]', items=[]))[0]
        self.assertEqual((m['myth'], m['correction'], m['scene']), ('Міф', 'пояснення.', 'кулька світиться.'))
        plain = X.parse_misconceptions(dict(inline='«Міф» → пояснення.', items=[]))[0]
        self.assertNotIn('scene', plain)


class Checks(unittest.TestCase):
    def test_sentences(self):
        self.assertEqual([n for n, _ in SC.sentences('Глянь на **кульку**. Вона стрибає — вгору і вниз!')], [3, 5])

    def test_formulas(self):
        hits = lambda t: [w for rx, w in SC.FORMULA_RES if rx.search(t)]  # noqa: E731
        self.assertEqual(hits('Струм — це рух зарядів, а не речовини.'), [])
        self.assertIn('equals sign', hits('I = q/t'))
        self.assertIn('symbol arithmetic', hits('потужність U·I'))
        self.assertIn('superscript', hits('10⁻¹⁰ метра'))
        self.assertIn('code span', hits('`λ`'))


class Fixture(unittest.TestCase):
    """The `_demo/wave` chapter carries a simple layer (the HUD fixture); `antenna` has none."""

    def test_demo(self):
        C.use_volume('_demo')
        try:
            d = X.parse_chapter('wave')
            self.assertTrue(all('simple' in s for s in d['steps']))
            self.assertEqual(len(d['simpleQuiz']), 3)
            self.assertIn('scene', d['steps'][0]['misconceptions'][0])
            a = X.parse_chapter('antenna')
            self.assertFalse(any('simple' in s for s in a['steps']) or 'simpleQuiz' in a)
            marks = []
            X.parse_quiz(C.read('wave'), SL.SIMPLE_QUIZ_SECTION, marks)
            self.assertEqual(marks, [1, 1, 1])
        finally:
            C.use_volume(C.DEFAULT_VOLUME)


if __name__ == '__main__':
    unittest.main()
