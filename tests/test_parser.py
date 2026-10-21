"""
Tests for tex_parser.py, using your real formula sheets in latex/.

If you change a .tex file a lot (rename a heading, remove a formula), a test
here can fail on purpose: update the expected names below to match.
"""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tex_parser import parse_sheet, split_by_named_formulas  # noqa: E402


def card_titles(sheet):
    return [card.title_text for section in sheet.sections for card in section.cards]


class TestNamedFormulaStyle(unittest.TestCase):
    def test_name_above_maths_starts_a_card(self):
        content = "Magnitude\n\\[A=\\sqrt{x}\\]\n\nDot Product\n\\[a\\cdot b\\]\n\\[=ab\\cos\\theta\\]"
        cards = split_by_named_formulas(content)
        self.assertEqual([t for t, _ in cards], ["Magnitude", "Dot Product"])
        self.assertIn("cos", cards[1][1])          # both lines stay in one card

    def test_maths_without_a_name_uses_section_title(self):
        cards = split_by_named_formulas("\\[M_O = Fd\\]")
        self.assertIsNone(cards[0][0])


class TestCalculusSheet(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.unknown = set()
        cls.sheet = parse_sheet("calculus", "Calculus", [ROOT / "latex/calculus/main.tex"],
                                "#000000", cls.unknown)

    def test_sections_and_colours(self):
        names = [s.title_text for s in self.sheet.sections]
        self.assertEqual(names[0], "Basics")
        self.assertIn("Complex numbers", names)
        complex_numbers = self.sheet.sections[names.index("Complex numbers")]
        self.assertEqual(complex_numbers.color, "#8E44AD")    # from \definecolor{cCplx}

    def test_every_sub_heading_is_a_card(self):
        titles = card_titles(self.sheet)
        for expected in ["Integration by parts", "Substitution", "Polar form",
                         "Implicit differentiation", "Standard Maclaurin a 0"]:
            self.assertIn(expected, titles)

    def test_explanation_only_intro_is_not_a_card(self):
        basics = self.sheet.sections[0]
        self.assertIn("expl", basics.intro_html)
        self.assertEqual(basics.cards[0].title_text, "Derivative rules")

    def test_no_unknown_commands(self):
        self.assertEqual(self.unknown, set())


class TestStaticsSheet(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.unknown = set()
        cls.sheet = parse_sheet("statics", "Statics", [ROOT / "latex/statics/main.tex"],
                                "#1F6FB2", cls.unknown)

    def test_named_formulas_are_cards(self):
        titles = card_titles(self.sheet)
        for expected in ["Dot Product", "Cross Product", "Buoyancy Archimedes",
                         "Static Coulomb friction", "Rolling resistance"]:
            self.assertIn(expected, titles)

    def test_cross_product_keeps_both_formulas(self):
        card = next(c for s in self.sheet.sections for c in s.cards if c.title_text == "Cross Product")
        self.assertEqual(card.body_html.count("\\["), 2)

    def test_table_and_list_sections_become_one_card(self):
        titles = card_titles(self.sheet)
        self.assertIn("SI-Units", titles)
        self.assertIn("FBD or Free Body Diagrams", titles)

    def test_no_unknown_commands(self):
        self.assertEqual(self.unknown, set())


if __name__ == "__main__":
    unittest.main()
