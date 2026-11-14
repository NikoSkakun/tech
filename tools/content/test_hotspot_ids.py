#!/usr/bin/env python3
"""Unit tests of the explicit hotspot ids (`{#id}`): `python3 tools/content/test_hotspot_ids.py`."""
import os
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export_content as X  # noqa: E402
import hotspot_ids as H  # noqa: E402


def spots(*chunks):
    return X.parse_hotspots(dict(inline=None, items=list(chunks)))[0]


def step(hs, sid='s'):
    return dict(id=sid, hotspots=hs, hotspotsNote=None)


class Parse(unittest.TestCase):
    def test_bold_head(self):
        h = spots('**Кільце** {#ring}: «Залізо збирає поле.»')[0]
        self.assertEqual((h['id'], h['name'], h['note'], h['text']), ('ring', 'Кільце', None, 'Залізо збирає поле.'))

    def test_code_head_with_remark(self):
        h = spots('`Nucleus — ядро` {#nucleus} (у центрі): «Ядро.»')[0]
        self.assertEqual((h['id'], h['international'], h['note'], h['text']), ('nucleus', 'Nucleus', '(у центрі)', 'Ядро.'))

    def test_code_dash_head_without_colon(self):
        h = spots('`Rotor — ротор` {#rotor} «Крутиться.»')[0]
        self.assertEqual((h['id'], h['name'], h['text']), ('rotor', 'Rotor — ротор', 'Крутиться.'))

    def test_wrapped_head_joined(self):
        hs = spots('`Isopentane loop — контур ізопентану` {#isopentane-loop}: «Кипить.» **Гул** {#hum}: «Гуде.»')
        self.assertEqual([h['id'] for h in hs], ['isopentane-loop', 'hum'])

    def test_missing_id_is_none(self):
        self.assertIsNone(spots('**Гул**: «Гуде.»')[0]['id'])


class Check(unittest.TestCase):
    def test_ok(self):
        self.assertEqual(H.step_problems(step(spots('**A** {#a}: «x»', '**Б** {#750-kv}: «y»'))), [])

    def test_missing_duplicate_malformed(self):
        msgs = H.step_problems(step(spots('**A**: «x»', '**Б** {#b}: «y»', '**В** {#b}: «z»', '**Г** {#Bad}: «w»')))
        self.assertEqual(len(msgs), 3)
        self.assertIn('has no id', msgs[0])
        self.assertIn('used twice', msgs[1])
        self.assertIn('not a lowercase ASCII slug', msgs[2])

    def test_space_in_id_is_reported(self):
        msgs = H.step_problems(step(spots('**A** {# a}: «x»')))
        self.assertTrue(any('malformed' in m for m in msgs) and any('has no id' in m for m in msgs))

    def test_registry(self):
        data = dict(steps=[step(spots('**A** {#a}: «x»', '**B** {#Bad}: «y»'))])
        issued = H.current('c', data)
        self.assertEqual(issued, {('c', 's', 'a')})
        reg = {('c', 's', 'a'), ('c', 's', 'old'), ('other', 's', 'z')}
        gone = H.registry_problems(reg, issued, {'c'})
        self.assertEqual(len(gone), 1)
        self.assertIn('`old`', gone[0])
        self.assertEqual(H.read_registry('/nonexistent/x.tsv'), set())
        self.assertTrue(H.render_registry(reg).endswith('other\ts\tz\n'))


if __name__ == '__main__':
    unittest.main()
