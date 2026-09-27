#!/usr/bin/env python3
"""Build an equal-corpus Danish spoken-vocabulary ranking from aggregate counts.

Inputs are the ``--frequency-out`` files from measure-spoken-lemma-coverage.py.
They contain only aggregate surface/lemma counts, never transcript text.  Each
corpus contributes equally: per-million frequencies are averaged by corpus,
and rank is normalised by that corpus's number of observed lemma types.  This
avoids allowing the largest corpus to determine the entire recommendation.
"""

from __future__ import annotations

import argparse
import csv
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


def selected_inventory() -> tuple[set[str], set[str], set[str], dict[str, str]]:
    cards = {normal(item["da"]) for item in json.loads((ROOT / "src/data/words.da.json").read_text(encoding="utf-8"))}
    groups = json.loads((ROOT / "src/data/function-words.da.json").read_text(encoding="utf-8"))
    support = {normal(form) for forms in groups.values() for form in forms}
    additions = {normal(form) for form in RESEARCH["selectedForms"]}
    equivalences = {normal(source): normal(target) for source, target in RESEARCH["spokenFormEquivalences"].items()}
    return cards, support, additions, equivalences


def status_for(lemma: str, cards: set[str], support: set[str], additions: set[str]) -> str:
    if lemma in cards:
        return "card"
    if lemma in support:
        return "support"
    if lemma in additions:
        return "research-addition"
    return "not-selected"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", action="append", type=split_input, required=True, help="NAME=aggregate-frequency-json; repeat")
    parser.add_argument("--out-csv", required=True)
    parser.add_argument("--out-json", required=True)
    parser.add_argument("--marketing-inventory", help="optional selected-forms inventory from select-marketing-900.py")
    args = parser.parse_args()

    cards, support, additions, equivalences = selected_inventory()
    marketing_selection: set[str] = set()
    if args.marketing_inventory:
        marketing_data = json.loads(Path(args.marketing_inventory).read_text(encoding="utf-8"))
        marketing_selection = {normal(form) for form in marketing_data["selectedForms"]}
    corpus_counts: dict[str, Counter[str]] = {}
    corpus_tokens: dict[str, int] = {}
    for name, path in args.corpus:
        if name in corpus_counts:
            raise ValueError(f"duplicate corpus name: {name}")
        data = json.loads(path.read_text(encoding="utf-8"))
        counts: Counter[str] = Counter()
        for row in data["surfaceLemmaCounts"]:
            surface = normal(row["surface"])
            lemma = normal(row["lemma"])
            effective = equivalences.get(surface, lemma)
            counts[effective] += int(row["count"])
        corpus_counts[name] = counts
        corpus_tokens[name] = int(data["runningTokens"])

    ranks: dict[str, dict[str, int]] = {}
    for name, counts in corpus_counts.items():
        ranks[name] = {
            lemma: index
            for index, (lemma, _count) in enumerate(sorted(counts.items(), key=lambda entry: (-entry[1], entry[0])), start=1)
        }

    # Keep every selected course/research item in the report, even where it
    # has no occurrence in the sampled corpora.  This makes the comparison a
    # genuine selection audit rather than a list limited to observed words.
    all_lemmas = sorted(
        set().union(*(set(counts) for counts in corpus_counts.values()))
        | cards
        | support
        | additions
    )
    corpus_names = list(corpus_counts)
    rows: list[dict[str, object]] = []
    for lemma in all_lemmas:
        ppms = [1_000_000 * corpus_counts[name][lemma] / corpus_tokens[name] for name in corpus_names]
        relative_ranks = [
            ranks[name].get(lemma, len(ranks[name]) + 1) / (len(ranks[name]) + 1)
            for name in corpus_names
        ]
        present_ranks = [ranks[name][lemma] for name in corpus_names if lemma in ranks[name]]
        rows.append(
            {
                "lemma": lemma,
                "selection": status_for(lemma, cards, support, additions),
                "marketing_900_selected": lemma in marketing_selection,
                "is_spoken_equivalence_target": lemma in equivalences.values(),
                "corpora_present": sum(lemma in corpus_counts[name] for name in corpus_names),
                "mean_per_million": round(statistics.fmean(ppms), 3),
                "median_per_million": round(statistics.median(ppms), 3),
                "mean_normalized_rank": round(statistics.fmean(relative_ranks), 6),
                "mean_rank_when_present": round(statistics.fmean(present_ranks), 3) if present_ranks else None,
                **{f"{name}_count": corpus_counts[name][lemma] for name in corpus_names},
                **{f"{name}_per_million": round(1_000_000 * corpus_counts[name][lemma] / corpus_tokens[name], 3) for name in corpus_names},
                **{f"{name}_rank": ranks[name].get(lemma, "") for name in corpus_names},
            }
        )

    rows.sort(key=lambda row: (row["mean_normalized_rank"], -float(row["mean_per_million"]), str(row["lemma"])))
    for index, row in enumerate(rows, start=1):
        row["cross_corpus_rank"] = index

    fieldnames = list(rows[0]) if rows else ["cross_corpus_rank", "lemma"]
    with Path(args.out_csv).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    report = {
        "method": {
            "unit": "effective lemma: Stanza lemma except owner-approved ha=>have and ik=>ikke",
            "frequency": "per-million running tokens, equal arithmetic mean across corpora",
            "rank": "mean corpus-normalized rank; absent lemmas receive the bottom rank in that corpus",
            "selection": "card, support, owner-selected research addition, or not selected",
        },
        "researchInventory": {
            "cards": len(cards),
            "support": len(support),
            "selectedAdditions": sorted(additions),
            "spokenFormEquivalences": equivalences,
            "marketing900SelectedForms": len(marketing_selection),
        },
        "corpora": [{"name": name, "runningTokens": corpus_tokens[name], "lemmaTypes": len(corpus_counts[name])} for name in corpus_names],
        "rows": rows,
    }
    Path(args.out_json).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
