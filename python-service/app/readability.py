"""
Readability scoring using the Flesch Reading Ease and Flesch-Kincaid Grade
Level formulas (Flesch, 1948; Kincaid et al., 1975) — well-established
formulas that estimate how difficult a passage is to read from just three
counts: words, sentences, and syllables.

Syllables are approximated by counting vowel groups per word (consecutive
vowels count once, with a small adjustment for a silent trailing "e"), a
standard heuristic that doesn't require a pronunciation dictionary and is
accurate enough for typical English prose.
"""

import re
from typing import TypedDict

from app.summarizer import split_sentences

_WORD_RE = re.compile(r"[a-zA-Z']+")
_VOWEL_GROUP_RE = re.compile(r"[aeiouy]+")


class ReadabilityScore(TypedDict):
    flesch_reading_ease: float
    flesch_kincaid_grade: float
    word_count: int
    sentence_count: int


def _count_syllables(word: str) -> int:
    word = word.lower()
    groups = _VOWEL_GROUP_RE.findall(word)
    count = len(groups)
    if word.endswith("e") and not word.endswith("le") and count > 1:
        count -= 1
    return max(count, 1)


def score_readability(text: str) -> ReadabilityScore:
    words = _WORD_RE.findall(text)
    sentences = split_sentences(text)
    word_count = len(words)
    sentence_count = len(sentences)

    if word_count == 0 or sentence_count == 0:
        return {
            "flesch_reading_ease": 0.0,
            "flesch_kincaid_grade": 0.0,
            "word_count": word_count,
            "sentence_count": sentence_count,
        }

    syllable_count = sum(_count_syllables(w) for w in words)
    words_per_sentence = word_count / sentence_count
    syllables_per_word = syllable_count / word_count

    reading_ease = 206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word
    grade_level = 0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59

    return {
        "flesch_reading_ease": round(reading_ease, 1),
        "flesch_kincaid_grade": round(grade_level, 1),
        "word_count": word_count,
        "sentence_count": sentence_count,
    }
