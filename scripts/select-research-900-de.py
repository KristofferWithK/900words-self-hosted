#!/usr/bin/env python3
"""Rank German lemmas across corpora and select the top-900 research inventory.

The German counterpart of ``scripts/select-marketing-900.py``, with one
structural difference forced by the language rather than chosen.  The Danish
run had 1,158 candidate forms already in hand - 900 card headwords, 252 support
forms and six approved additions - and used the ranking only to *prune* them to
900.  German has no course and therefore no candidate list, so every lemma
observed in the corpora competes and the top 900 are kept.  The ranking rule
itself is unchanged: equal-corpus arithmetic mean frequency per million running
tokens, so a larger corpus cannot dominate a smaller one, with the same
deterministic tie-breaks (more corpora present, then higher median, then
alphabetical).

Coverage is then computed **per corpus, separately**.  A running token counts as
covered when its exact NFC-lowercased surface form is in the inventory, or when
its Stanza-predicted lemma is.  The corpora are never pooled into one
denominator and the result is reported as a range plus an equal-corpus mean.

Inputs are the aggregate-only ``--frequency-out`` or ``--pos-frequency-out``
reports from ``scripts/measure-spoken-coverage-de.py``.  No transcript text is
read or written.

Refuses to run on a single corpus.  A top-900 list ranked on one corpus and then
measured against that same corpus is circular: on the Cologne Kiezdeutsch sample
alone it returns about 91%, which is a property of taking the 900 commonest
lemmas of a 33,000-token text, not a coverage finding.

Usage:
    python scripts/select-research-900-de.py \
        --corpus kiezdeutsch=<temp>/kiezdeutsch.pos-counts.de.json \
        --corpus emiliaYodas=<temp>/emilia-de.pos-counts.de.json \
        --out docs/80-percent-research/data/spoken-coverage-selection.de.json \
        --ranking-out docs/80-percent-research/data/spoken-coverage-word-ranking.de.csv \
        --inventory-out docs/80-percent-research/data/spoken-coverage-research-900.de.json
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import unicodedata
from collections import Counter
from pathlib import Path


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


def rows_of(data: dict) -> list[dict]:
    if "surfaceLemmaPosCounts" in data:
        return data["surfaceLemmaPosCounts"]
    return data["surfaceLemmaCounts"]


def ranking_rows(counts: dict[str, Counter[str]], tokens: dict[str, int]) -> list[dict[str, object]]:
    names = list(counts)
    values = sorted(set().union(*(set(counter) for counter in counts.values())))
    rows = []
    for value in values:
        ppms = [1_000_000 * counts[name][value] / tokens[name] for name in names]
        rows.append(
            {
                "form": value,
                "mean_per_million": round(statistics.fmean(ppms), 6),
                "median_per_million": round(statistics.median(ppms), 6),
                "corpora_present": sum(counts[name][value] > 0 for name in names),
                **{f"{name}_count": counts[name][value] for name in names},
                **{f"{name}_per_million": round(1_000_000 * counts[name][value] / tokens[name], 6) for name in names},
            }
        )
    rows.sort(
        key=lambda row: (
            -float(row["mean_per_million"]),
            -int(row["corpora_present"]),
            -float(row["median_per_million"]),
            str(row["form"]),
        )
    )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--corpus", action="append", type=split_input, required=True, help="NAME=aggregate-json; repeat")
    parser.add_argument("--target", type=int, default=900)
    parser.add_argument("--out", required=True)
    parser.add_argument("--ranking-out", help="CSV of every ranked lemma with per-corpus counts and frequencies")
    parser.add_argument("--inventory-out", help="compact selected-forms inventory JSON")
    parser.add_argument("--top-lists", type=int, default=20, help="how many entries per POS sanity list")
    args = parser.parse_args()

    if len(args.corpus) < 2:
        raise SystemExit(
            "select-research-900-de.py needs at least two corpora. Ranking and measuring on one corpus is "
            "circular and the number it produces is not a coverage finding."
        )

    corpus_rows: dict[str, list[dict]] = {}
    corpus_tokens: dict[str, int] = {}
    lemma_counts: dict[str, Counter[str]] = {}
    surface_counts: dict[str, Counter[str]] = {}
    category_counts: dict[str, dict[str, Counter[str]]] = {"nouns": {}, "verbs": {}, "adjectives": {}}
    upos_by_category = {"nouns": "NOUN", "verbs": "VERB", "adjectives": "ADJ"}
    has_pos = True
    for name, path in args.corpus:
        if name in corpus_rows:
            raise SystemExit(f"duplicate corpus name: {name}")
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = rows_of(data)
        corpus_rows[name] = rows
        corpus_tokens[name] = int(data["runningTokens"])
        lemma_counts[name] = Counter()
        surface_counts[name] = Counter()
        for category in category_counts.values():
            category[name] = Counter()
        for row in rows:
            surface = normal(str(row["surface"]))
            lemma = normal(str(row["lemma"]))
            count = int(row["count"])
            lemma_counts[name][lemma] += count
            surface_counts[name][surface] += count
            upos = row.get("upos")
            if upos is None:
                has_pos = False
                continue
            for category, wanted in upos_by_category.items():
                if upos == wanted:
                    category_counts[category][name][lemma] += count

    if args.target < 1:
        raise SystemExit("--target must be positive")
    ranked = ranking_rows(lemma_counts, corpus_tokens)
    if args.target > len(ranked):
        raise SystemExit(f"--target {args.target} exceeds the {len(ranked)} distinct lemmas observed")
    selected = {str(row["form"]) for row in ranked[: args.target]}

    coverage: dict[str, dict[str, object]] = {}
    for name, rows in corpus_rows.items():
        exact = family = 0
        for row in rows:
            surface = normal(str(row["surface"]))
            lemma = normal(str(row["lemma"]))
            count = int(row["count"])
            if surface in selected:
                exact += count
            if surface in selected or lemma in selected:
                family += count
        tokens = corpus_tokens[name]
        coverage[name] = {
            "runningTokens": tokens,
            "exactCoveredTokens": exact,
            "exactCoveragePercent": round(100 * exact / tokens, 3),
            "familyAwareCoveredTokens": family,
            "familyAwareCoveragePercent": round(100 * family / tokens, 3),
        }

    family_values = [float(entry["familyAwareCoveragePercent"]) for entry in coverage.values()]
    exact_values = [float(entry["exactCoveragePercent"]) for entry in coverage.values()]
    report = {
        "language": "de",
        "method": {
            "targetForms": args.target,
            "selection": "every observed Stanza German lemma ranked by equal-corpus mean per-million frequency; keep the highest values",
            "matching": "exact NFC-normalised surface form or predicted German lemma; no compound, derivational or separable-prefix credit",
            "pooling": "none; every corpus keeps its own numerator and denominator",
        },
        "corpora": [{"name": name, "runningTokens": corpus_tokens[name]} for name in corpus_rows],
        "distinctLemmasObserved": len(ranked),
        "coverage": coverage,
        "familyAwareRangePercent": [min(family_values), max(family_values)],
        "familyAwareEqualCorpusMeanPercent": round(statistics.fmean(family_values), 3),
        "exactFormRangePercent": [min(exact_values), max(exact_values)],
        "exactFormEqualCorpusMeanPercent": round(statistics.fmean(exact_values), 3),
        "topLemmas": ranked[: args.top_lists],
        "topSurfaceForms": ranking_rows(surface_counts, corpus_tokens)[: args.top_lists],
    }
    if has_pos:
        for category, counts in category_counts.items():
            report[f"top{category.capitalize()}"] = ranking_rows(counts, corpus_tokens)[: args.top_lists]
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.ranking_out:
        with Path(args.ranking_out).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(ranked[0]) + ["rank", "research_900_selected"])
            writer.writeheader()
            for index, row in enumerate(ranked, start=1):
                writer.writerow({**row, "rank": index, "research_900_selected": str(row["form"]) in selected})

    if args.inventory_out:
        Path(args.inventory_out).write_text(
            json.dumps(
                {
                    "description": (
                        "Frequency-selected 900-lemma German research inventory. It is a vocabulary-selection "
                        "decision for this study and does not by itself create playable course cards."
                    ),
                    "language": "de",
                    "method": report["method"],
                    "corpora": report["corpora"],
                    "selectedForms": sorted(selected),
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    print(json.dumps({key: value for key, value in report.items() if not key.startswith("top")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
