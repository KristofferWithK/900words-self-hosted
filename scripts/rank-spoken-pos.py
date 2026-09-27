#!/usr/bin/env python3
"""Rank Danish spoken words and lexical categories from aggregate POS counts.

Inputs are ``--pos-frequency-out`` files from measure-spoken-lemma-coverage.py.
The reports contain aggregate surface/lemma/UPOS counts only. Each corpus has
equal weight through arithmetic mean frequency per million running tokens.
"""

from __future__ import annotations

import argparse
import json
import statistics
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def normal(value: str) -> str:
    return unicodedata.normalize("NFC", value).lower()


def split_input(value: str) -> tuple[str, Path]:
    try:
        name, path = value.split("=", 1)
    except ValueError as error:
        raise argparse.ArgumentTypeError("use NAME=PATH") from error
    if not name:
        raise argparse.ArgumentTypeError("corpus name cannot be empty")
    return name, Path(path)


def ranking_rows(
    corpus_counts: dict[str, Counter[str]], corpus_tokens: dict[str, int], limit: int
) -> list[dict[str, object]]:
    corpus_names = list(corpus_counts)
    values = set().union(*(set(counts) for counts in corpus_counts.values()))
    rows = []
    for value in values:
        ppms = [1_000_000 * corpus_counts[name][value] / corpus_tokens[name] for name in corpus_names]
        rows.append(
            {
                "word": value,
                "meanPerMillion": round(statistics.fmean(ppms), 3),
                "medianPerMillion": round(statistics.median(ppms), 3),
                "corporaPresent": sum(corpus_counts[name][value] > 0 for name in corpus_names),
                **{f"{name}Count": corpus_counts[name][value] for name in corpus_names},
                **{f"{name}PerMillion": round(1_000_000 * corpus_counts[name][value] / corpus_tokens[name], 3) for name in corpus_names},
            }
        )
    rows.sort(key=lambda row: (-float(row["meanPerMillion"]), -int(row["corporaPresent"]), -float(row["medianPerMillion"]), str(row["word"])))
    return rows[:limit]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", action="append", type=split_input, required=True, help="NAME=aggregate-pos-json; repeat")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    if args.limit < 1:
        raise ValueError("limit must be positive")
    corpus_tokens: dict[str, int] = {}
    surfaces: dict[str, Counter[str]] = {}
    categories: dict[str, dict[str, Counter[str]]] = {"nouns": {}, "verbs": {}, "adjectives": {}}
    upos_by_category = {"nouns": "NOUN", "verbs": "VERB", "adjectives": "ADJ"}
    for name, path in args.corpus:
        if name in corpus_tokens:
            raise ValueError(f"duplicate corpus name: {name}")
        data = json.loads(path.read_text(encoding="utf-8"))
        corpus_tokens[name] = int(data["runningTokens"])
        surfaces[name] = Counter()
        for category in categories.values():
            category[name] = Counter()
        for row in data["surfaceLemmaPosCounts"]:
            surface = normal(row["surface"])
            lemma = normal(row["lemma"])
            upos = row["upos"]
            count = int(row["count"])
            surfaces[name][surface] += count
            for category, desired_upos in upos_by_category.items():
                if upos == desired_upos:
                    categories[category][name][lemma] += count

    output = {
        "method": {
            "frequency": "equal-corpus arithmetic mean frequency per million running tokens",
            "wordUnit": "surface forms for topWords; predicted Danish lemmas for lexical categories",
            "categories": "NOUN for common nouns, VERB for lexical verbs (auxiliaries excluded), ADJ for adjectives",
        },
        "corpora": [{"name": name, "runningTokens": tokens} for name, tokens in corpus_tokens.items()],
        "topWords": ranking_rows(surfaces, corpus_tokens, args.limit),
        "topNouns": ranking_rows(categories["nouns"], corpus_tokens, args.limit),
        "topVerbs": ranking_rows(categories["verbs"], corpus_tokens, args.limit),
        "topAdjectives": ranking_rows(categories["adjectives"], corpus_tokens, args.limit),
    }
    Path(args.out).write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
