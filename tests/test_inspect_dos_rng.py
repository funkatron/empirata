"""Sanity tests for our unsigned DOS executable scanner; no copyrighted EXE."""
import importlib.util
import pathlib
import struct
import unittest

TOOL = pathlib.Path(__file__).resolve().parents[1] / 'tools' / 'inspect_dos_rng.py'
spec = importlib.util.spec_from_file_location('inspect_dos_rng', TOOL)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture(body=b''):
    header = bytearray(32)
    header[:2] = b'MZ'
    struct.pack_into('<H', header, 8, 2)  # 32-byte header
    struct.pack_into('<H', header, 4, 1)  # one 512-byte page
    return bytes(header) + body


class ScanTests(unittest.TestCase):
    def test_dos_time_signature(self):
        report = module.examine(fixture(bytes.fromhex('90 B4 2C CD 21 C3')))
        got = report['candidates']['DOS time service (MOV AH,2Ch; INT 21h)']
        self.assertEqual(len(got), 1)
        self.assertEqual(got[0]['file_offset_hex'], '0x000021')
        self.assertEqual(report['header_size'], 32)

    def test_no_guaranteed_signal(self):
        report = module.examine(fixture(b'hello world'))
        self.assertTrue(all(not matches for matches in report['candidates'].values()))

    def test_bad_header(self):
        with self.assertRaises(ValueError):
            module.examine(b'NOT AN EXE')


if __name__ == '__main__':
    unittest.main()
