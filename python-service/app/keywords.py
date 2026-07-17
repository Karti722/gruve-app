"""
Keyword extraction by term frequency, ignoring a small stopword list.

This is the "term frequency" half of TF-IDF (Term Frequency - Inverse
Document Frequency), the foundational term-weighting scheme in information
retrieval (Spärck Jones, 1972): the words that occur most often in a piece
of text, once common function words are filtered out, tend to be exactly
the words a person would circle if asked to mark its most important terms.
"""

import re
from collections import Counter
from typing import List

_TOKEN_RE = re.compile(r"[a-z]+")

_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "than", "so",
    "of", "to", "in", "on", "at", "by", "for", "with", "about", "against",
    "between", "into", "through", "during", "before", "after", "above",
    "below", "from", "up", "down", "out", "off", "over", "under", "again",
    "further", "once", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did", "doing", "this",
    "that", "these", "those", "it", "its", "as", "not", "no",
    "can", "could", "will", "would", "should", "may", "might", "must",
    "i", "you", "he", "she", "we", "they", "them", "their", "his", "her",
    "our", "your", "what", "which", "who", "whom", "when", "where", "why",
    "how", "each", "other", "some", "such", "only", "own", "same", "just",
    "also", "there", "here", "more", "most", "very",
}


def extract_keywords(text: str, top_n: int = 8) -> List[str]:
    words = [w for w in _TOKEN_RE.findall(text.lower()) if w not in _STOPWORDS and len(w) > 2]
    if not words:
        return []
    counts = Counter(words)
    return [word for word, _ in counts.most_common(top_n)]
