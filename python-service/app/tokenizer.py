"""
Byte-pair encoding (BPE) tokenization and per-model cost estimation: the
subword algorithm behind every modern LLM's tokenizer (GPT, Claude and
others all use a BPE variant), adapted from a text-compression technique
for neural machine translation (Sennrich, Haddow & Birch, 2015). Starting
from individual characters, the single most frequent adjacent pair
anywhere in a training corpus is merged into a new symbol, over and over,
until a target vocabulary size is reached. Common words end up as a
single token; rare or made-up words fall back to smaller, still-meaningful
pieces instead of one "unknown word" marker for each.

Trained once, at import time, on a small bundled corpus: real BPE, just
learned from a few kilobytes of text rather than the hundreds of
gigabytes production tokenizers train on, so don't expect it to match
GPT's or Claude's actual token boundaries exactly. Token *counting* is a
genuinely practical everyday concern once you're calling a hosted model:
every provider bills per token, separately for input and output, which
is why "how many tokens is this" and "what would this cost" are
questions that come up constantly in applied AI engineering work.
"""

import re
from collections import Counter
from typing import Dict, List, Tuple

_WORD_RE = re.compile(r"\w+|[^\w\s]")
_END = "</w>"

# A small bundled corpus to learn merges from, reusing this app's own
# knowledge-base style AI-concept prose, so the demo's vocabulary leans
# toward the same words this tutorial actually talks about.
_TRAINING_CORPUS = """
Large language models generate text by predicting the next token given
everything written so far, one piece at a time, using a neural network
called a transformer. Retrieval-augmented generation searches a document
collection for relevant passages before the model answers a question,
grounding its response in real, retrieved text instead of memory alone.
An AI agent extends this further by calling external tools, observing
their results, and deciding what to do next in a repeating loop. The
Model Context Protocol standardizes how an AI application discovers and
calls tools exposed by any external server, so a single integration works
everywhere. Embeddings represent the meaning of text as a list of numbers,
positioned so that similar meanings end up close together in that space.
A vector database stores those embeddings and quickly finds the ones most
similar to a new query using an approximate nearest neighbor index.
Tokenization splits text into smaller pieces before any model can read it,
and the cost of calling a hosted model is billed per token, separately
for input and output, which makes counting tokens a genuinely practical
everyday concern for anyone building with these systems in production.
"""

NUM_MERGES = 300

# Published per-million-token pricing, USD, current as of July 2026: see
# platform.claude.com/docs/en/about-claude/pricing. Changes over time; this
# is illustrative, not a live-fetched price.
MODEL_PRICING = {
    "claude-haiku-4-5": {"input_per_million": 1.00, "output_per_million": 5.00},
    "claude-sonnet-5": {"input_per_million": 2.00, "output_per_million": 10.00},
    "claude-opus-4-8": {"input_per_million": 5.00, "output_per_million": 25.00},
}


def _word_to_symbols(word: str) -> List[str]:
    return list(word) + [_END]


def _get_pair_counts(vocab: Dict[Tuple[str, ...], int]) -> Counter:
    pairs: Counter = Counter()
    for symbols, freq in vocab.items():
        for i in range(len(symbols) - 1):
            pairs[(symbols[i], symbols[i + 1])] += freq
    return pairs


def _merge_vocab(pair: Tuple[str, str], vocab: Dict[Tuple[str, ...], int]) -> Dict[Tuple[str, ...], int]:
    merged = "".join(pair)
    new_vocab: Dict[Tuple[str, ...], int] = {}
    for symbols, freq in vocab.items():
        new_symbols: List[str] = []
        i = 0
        while i < len(symbols):
            if i < len(symbols) - 1 and symbols[i] == pair[0] and symbols[i + 1] == pair[1]:
                new_symbols.append(merged)
                i += 2
            else:
                new_symbols.append(symbols[i])
                i += 1
        key = tuple(new_symbols)
        new_vocab[key] = new_vocab.get(key, 0) + freq
    return new_vocab


def _train_bpe(corpus: str, num_merges: int) -> List[Tuple[str, str]]:
    words = _WORD_RE.findall(corpus.lower())
    word_freq = Counter(words)
    vocab: Dict[Tuple[str, ...], int] = {
        tuple(_word_to_symbols(word)): freq for word, freq in word_freq.items()
    }

    merges: List[Tuple[str, str]] = []
    for _ in range(num_merges):
        pairs = _get_pair_counts(vocab)
        if not pairs:
            break
        best_pair = max(pairs, key=pairs.get)
        if pairs[best_pair] < 2:
            break  # stop merging pairs that only ever occurred once, not a real pattern
        vocab = _merge_vocab(best_pair, vocab)
        merges.append(best_pair)

    return merges


_MERGES = _train_bpe(_TRAINING_CORPUS, NUM_MERGES)
_MERGE_RANK = {pair: i for i, pair in enumerate(_MERGES)}


def _apply_bpe(word: str) -> List[str]:
    symbols = _word_to_symbols(word)
    while len(symbols) > 1:
        pairs = [(symbols[i], symbols[i + 1]) for i in range(len(symbols) - 1)]
        ranked = [(_MERGE_RANK[p], p) for p in pairs if p in _MERGE_RANK]
        if not ranked:
            break
        _, best_pair = min(ranked)
        merged = "".join(best_pair)
        new_symbols: List[str] = []
        i = 0
        while i < len(symbols):
            if i < len(symbols) - 1 and symbols[i] == best_pair[0] and symbols[i + 1] == best_pair[1]:
                new_symbols.append(merged)
                i += 2
            else:
                new_symbols.append(symbols[i])
                i += 1
        symbols = new_symbols
    return [s.replace(_END, "") for s in symbols if s != _END]


def tokenize(text: str) -> List[str]:
    tokens: List[str] = []
    for word in _WORD_RE.findall(text.lower()):
        tokens.extend(_apply_bpe(word))
    return tokens


def estimate_cost(token_count: int) -> List[dict]:
    estimates = []
    for model, pricing in MODEL_PRICING.items():
        input_cost = token_count / 1_000_000 * pricing["input_per_million"]
        estimates.append(
            {
                "model": model,
                "input_cost_usd": round(input_cost, 6),
                "input_rate_per_million": pricing["input_per_million"],
                "output_rate_per_million": pricing["output_per_million"],
            }
        )
    return estimates
