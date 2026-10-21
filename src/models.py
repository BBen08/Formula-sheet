"""
models.py - What the app knows about.

The app has three kinds of things, nested like this:

    Sheet    (one LaTeX document, e.g. "Calculus")
      Section  (a \\section or \\sect heading, e.g. "Integration techniques")
        Card     (one searchable formula or sub-heading, e.g. "Integration by parts")

Each class is a plain dataclass: just named fields, no logic.
`to_dict()` turns them into dictionaries so builder.py can save them as JSON
for the web page.
"""

from dataclasses import dataclass, field, asdict


@dataclass
class Card:
    id: str           # unique, URL-friendly name, e.g. "calculus-integration-by-parts"
    title_html: str   # title ready for the web page (may contain $math$)
    title_text: str   # plain-text title, used for searching
    body_html: str    # the formula(s) and explanations, as HTML with $math$
    body_text: str    # plain-text version of the body, used for searching
    latex: str        # the original LaTeX source of this card (for "Copy LaTeX")


@dataclass
class Section:
    id: str
    title_html: str
    title_text: str
    color: str                 # hex colour, e.g. "#1F6FB2"
    intro_html: str = ""       # optional explanation shown under the heading
    cards: list[Card] = field(default_factory=list)


@dataclass
class Sheet:
    id: str           # e.g. "calculus"
    name: str         # tab label, e.g. "Calculus"
    title: str        # document title, e.g. "Math 1 – Calculus Formula Sheet"
    source: str       # which .tex file(s) it came from
    sections: list[Section] = field(default_factory=list)

    def card_count(self) -> int:
        return sum(len(s.cards) for s in self.sections)

    def to_dict(self) -> dict:
        return asdict(self)
