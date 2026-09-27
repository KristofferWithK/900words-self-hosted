#!/usr/bin/env python3
"""Select and measure a frequency-pruned 900-item Danish research inventory.

The existing 900 card forms, 252 support forms, and approved research additions
make a 1,158-form audit inventory. This tool ranks every form together and
keeps the highest-frequency 900. Frequency is the equal-corpus mean per
million running tokens. Inputs are aggregate-only frequency reports from
measure-spoken-lemma-coverage.py; no transcript text is read or written.
"""

from __future__ import annotations

import argparse
import json
import statistics
import unicodedata
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RESEARCH = json.loads((ROOT / "src/data/spoken-coverage-research.da.json").read_text(encoding="utf-8"))


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


def inventory() -> tuple[set[str], set[str], set[str], dict[str, str]]:
    cards = {normal(item["da"]) for item in json.loads((ROOT / "src/data/words.da.json").read_text(encoding="utf-8"))}
    groups = json.loads((ROOT / "src/data/function-words.da.json").read_text(encoding="utf-8"))
    support = {normal(form) for forms in groups.values() for form in forms}
    additions = {normal(form) for form in RESEARCH["selectedForms"]}
    equivalences = {normal(source): normal(target) for source, target in RESEARCH["spokenFormEquivalences"].items()}
    return cards, support, additions, equivalences


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", action="append", type=split_input, required=True, help="NAME=aggregate-frequency-json; repeat")
    parser.add_argument("--target", type=int, default=900)
    parser.add_argument("--out", required=True)
    parser.add_argument("--inventory-out", help="optional small selected-forms inventory JSON")
    args = parser.parse_args()

    cards, support, additions, equivalences = inventory()
    candidates = cards | support | additions
    if len(candidates) != len(cards) + len(support) + len(additions):
        raise ValueError("card, support, and research-addition forms must be disjoint")
    if args.target < 1 or args.target > len(candidates):
        raise ValueError("target must be between 1 and the full inventory size")

    corpus_rows: dict[str, list[dict[str, object]]] = {}
    corpus_tokens: dict[str, int] = {}
    corpus_lemma_counts: dict[str, Counter[str]] = {}
    for name, path in args.corpus:
        if name in corpus_rows:
            raise ValueError(f"duplicate corpus name: {name}")
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data["surfaceLemmaCounts"]
        corpus_rows[name] = rows
        corpus_tokens[name] = int(data["runningTokens"])
        counts: Counter[str] = Counter()
        for row in rows:
            surface = normal(str(row["surface"]))
            lemma = normal(str(row["lemma"]))
            counts[equivalences.get(surface, lemma)] += int(row["count"])
        corpus_lemma_counts[name] = counts

    corpus_names = list(corpus_rows)
    scored: list[dict[str, object]] = []
    for form in sorted(candidates):
        ppms = [1_000_000 * corpus_lemma_counts[name][form] / corpus_tokens[name] for name in corpus_names]
        counts = [corpus_lemma_counts[name][form] for name in corpus_names]
        scored.append(
            {
                "form": form,
                "mean_per_million": round(statistics.fmean(ppms), 6),
                "median_per_million": round(statistics.median(ppms), 6),
                "corpora_present": sum(count > 0 for count in counts),
                **{f"{name}_count": corpus_lemma_counts[name][form] for name in corpus_names},
                **{f"{name}_per_million": round(1_000_000 * corpus_lemma_counts[name][form] / corpus_tokens[name], 6) for name in corpus_names},
            }
        )

    # Deterministic tie-breaks retain words that occur in more corpora, then
    # with the higher median frequency, then alphabetically.
    scored.sort(key=lambda row: (-float(row["mean_per_million"]), -int(row["corpora_present"]), -float(row["median_per_million"]), str(row["form"])))
    selected = {str(row["form"]) for row in scored[:args.target]}
    removed = scored[args.target:]

    coverage: dict[str, dict[str, object]] = {}
    for name, rows in corpus_rows.items():
        exact = 0
        family = 0
        for row in rows:
            surface = normal(str(row["surface"]))
            lemma = normal(str(row["lemma"]))
            count = int(row["count"])
            if surface in selected:
                exact += count
            if surface in selected or equivalences.get(surface, lemma) in selected:
                family += count
        tokens = corpus_tokens[name]
        coverage[name] = {
            "runningTokens": tokens,
            "exactCoveredTokens": exact,
            "exactCoveragePercent": round(100 * exact / tokens, 3),
            "familyAwareCoveredTokens": family,
            "familyAwareCoveragePercent": round(100 * family / tokens, 3),
        }

    report = {
        "method": {
            "targetForms": args.target,
            "selection": "all card forms, support forms, and approved additions ranked by equal-corpus mean per-million frequency; keep the highest values",
            "matching": "exact NFC-normalised form or predicted Danish lemma; ha=>have and ik=>ikke apply only to family-aware coverage",
        },
        "inventory": {
            "cards": len(cards),
            "support": len(support),
            "researchAdditions": sorted(additions),
            "candidateForms": len(candidates),
            "selectedFormsCount": len(selected),
            "removedFormsCount": len(removed),
            "selectedForms": sorted(selected),
        },
        "corpora": [{"name": name, "runningTokens": corpus_tokens[name]} for name in corpus_names],
        "coverage": coverage,
        "rankedCandidates": scored,
        "removedLowestFrequencyForms": removed,
    }
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.inventory_out:
        inventory_report = {
            "description": "Frequency-pruned 900-item Danish research inventory; does not itself modify playable course cards.",
            "method": report["method"],
            "corpora": report["corpora"],
            "selectedForms": sorted(selected),
        }
        Path(args.inventory_out).write_text(json.dumps(inventory_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
