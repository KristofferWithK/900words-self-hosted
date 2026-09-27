#!/usr/bin/env python3
"""Lemma-aware Danish transcript coverage for the frozen 900words inventory.

This is intentionally a separate measure from ``measure-spoken-coverage.mjs``.
It preserves that script's transcript cleanup and word-token denominator, then
asks a pinned Stanza Danish POS/lemma model for each *pre-tokenized* word. A
token is covered when either its exact lowercased NFC form or its predicted
lemma occurs in the chosen taught inventory.

The result gives inflectional credit (for example ``købe`` / ``købte``), not
credit for compounds, derivations, word families in a broad semantic sense, or
learner acquisition. Keep input corpora and model files outside Git.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Iterable

import regex
import stanza
import torch


ROOT = Path(__file__).resolve().parent.parent
TOKEN_RE = regex.compile(r"[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*")
SPEAKER_PREFIX_RE = re.compile(r"^\s*(?:taler|speaker)\s+[^:\n]+:\s*", re.IGNORECASE | re.MULTILINE)
RESEARCH_INVENTORY = json.loads(
    (ROOT / "src/data/spoken-coverage-research.da.json").read_text(encoding="utf-8")
)
# Owner-approved conversational reductions.  These are deliberately narrow:
# they are not spelling correction or generic fuzzy/substring matching.
SPOKEN_FORM_EQUIVALENCES = {
    unicodedata.normalize("NFC", source).lower(): unicodedata.normalize("NFC", target).lower()
    for source, target in RESEARCH_INVENTORY["spokenFormEquivalences"].items()
}


def normal(value: str) -> str:
    return unicodedata.normalize("NFC", value).lower()


def transcript_tokens(text: str) -> list[str]:
    transcript = SPEAKER_PREFIX_RE.sub("", str(text))
    return TOKEN_RE.findall(unicodedata.normalize("NFC", transcript))


def documents(path: Path, text_field: str) -> Iterable[str]:
    if path.suffix.lower() == ".json":
        value = json.loads(path.read_text(encoding="utf-8"))
        values = value if isinstance(value, list) else [value]
        for item in values:
            if isinstance(item, str):
                yield item
            elif isinstance(item, dict) and isinstance(item.get(text_field), str):
                yield item[text_field]
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            yield line
            continue
        if isinstance(value, str):
            yield value
        elif isinstance(value, dict) and isinstance(value.get(text_field), str):
            yield value[text_field]


def inventories(
    with_support: bool, both_inventories: bool, candidate_additions: set[str]
) -> dict[str, tuple[set[str], str]]:
    words = json.loads((ROOT / "src/data/words.da.json").read_text(encoding="utf-8"))
    cards = {normal(word["da"]) for word in words}
    card_inventory = (cards, "900 card headwords and their inflections")
    if not with_support:
        return {"cards": card_inventory}
    groups = json.loads((ROOT / "src/data/function-words.da.json").read_text(encoding="utf-8"))
    support = {normal(form) for forms in groups.values() for form in forms}
    course_inventory = (
        cards | support | candidate_additions,
        "900 card headwords and their inflections + 252 support forms and their inflections"
        + (f" + {len(candidate_additions)} selected research additions" if candidate_additions else ""),
    )
    if both_inventories:
        return {"cards": card_inventory, "cardsPlusSupport": course_inventory}
    return {"cardsPlusSupport": course_inventory}


def run(args: argparse.Namespace) -> dict:
    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(1)
    candidate_additions = {normal(form) for form in args.extra_form}
    if args.with_research_additions:
        candidate_additions.update(normal(form) for form in RESEARCH_INVENTORY["selectedForms"])
    selected_inventories = inventories(args.with_support, args.both_inventories, candidate_additions)
    nlp = stanza.Pipeline(
        "da",
        processors="tokenize,pos,lemma",
        tokenize_pretokenized=True,
        model_dir=args.model_dir,
        pos_package=args.pos_package,
        use_gpu=False,
        verbose=False,
    )

    total = analysed = 0
    document_count = 0
    frequencies: Counter[str] = Counter()
    lemma_pairs: Counter[tuple[str, str]] = Counter()
    lemma_pos_pairs: Counter[tuple[str, str, str]] = Counter()
    examples: dict[str, str] = {}
    per_inventory = {
        key: {"taught": taught, "name": name, "exact": 0, "lemma_covered": 0, "lemma_only": 0,
              "outside": Counter()}
        for key, (taught, name) in selected_inventories.items()
    }

    def count_batch(batch: list[list[str]]) -> None:
        nonlocal total, analysed
        parsed = nlp(batch)
        parsed_words = [word for sentence in parsed.sentences for word in sentence.words]
        flattened = [token for tokens in batch for token in tokens]
        if len(parsed_words) != len(flattened):
            raise RuntimeError(f"Stanza changed the frozen token count: expected {len(flattened)}, got {len(parsed_words)}")
        for raw, parsed_word in zip(flattened, parsed_words, strict=True):
            token = normal(raw)
            lemma = normal(parsed_word.lemma or "")
            upos = parsed_word.upos or ""
            total += 1
            frequencies[token] += 1
            if lemma:
                analysed += 1
                lemma_pairs[(token, lemma)] += 1
                if upos:
                    lemma_pos_pairs[(token, lemma, upos)] += 1
                examples.setdefault(token, lemma)
            for result in per_inventory.values():
                direct = token in result["taught"]
                by_lemma = lemma in result["taught"] or SPOKEN_FORM_EQUIVALENCES.get(token) in result["taught"]
                if direct:
                    result["exact"] += 1
                if direct or by_lemma:
                    result["lemma_covered"] += 1
                    if not direct and by_lemma:
                        result["lemma_only"] += 1
                else:
                    result["outside"][token] += 1

    batch: list[list[str]] = []
    for index, text in enumerate(documents(Path(args.input), args.text_field)):
        if args.max_documents is not None and index >= args.max_documents:
            break
        document_count += 1
        tokens = transcript_tokens(text)
        if not tokens:
            continue
        batch.append(tokens)
        if len(batch) < args.batch_documents:
            continue
        count_batch(batch)
        batch = []
    if batch:
        count_batch(batch)

    def pct(part: int) -> float:
        return round((part / total) * 100, 3) if total else 0.0

    report = {
        "method": "frozen running-token denominator; exact NFC-normalised form, Stanza Danish predicted lemma, or approved spoken-form equivalence (ha=>have; ik=>ikke); no compound, derivational or semantic-family credit",
        "stanzaVersion": stanza.__version__,
        "modelDirectory": str(Path(args.model_dir).resolve()),
        "input": str(Path(args.input).resolve()),
        "textField": args.text_field,
        "researchAdditionForms": sorted(candidate_additions),
        "documents": document_count,
        "runningTokens": total,
        "tokensWithPredictedLemma": analysed,
    }
    coverage = {}
    for key, result in per_inventory.items():
        taught = result["taught"]
        top_outside = [
            {"word": word, "count": count, "predictedLemma": examples.get(word, "")}
            for word, count in sorted(result["outside"].items(), key=lambda entry: (-entry[1], entry[0]))[:30]
        ]
        top_lemma_gains = [
            {"surface": surface, "lemma": lemma, "count": count}
            for (surface, lemma), count in sorted(lemma_pairs.items(), key=lambda entry: (-entry[1], entry[0]))
            if surface not in taught and lemma in taught
        ][:30]
        coverage[key] = {
            "inventory": result["name"],
            "inventoryLemmasOrForms": len(taught),
            "exactCoveredTokens": result["exact"],
            "exactCoveragePercent": pct(result["exact"]),
            "lemmaAwareCoveredTokens": result["lemma_covered"],
            "lemmaAwareCoveragePercent": pct(result["lemma_covered"]),
            "lemmaOnlyCoveredTokens": result["lemma_only"],
            "lemmaOnlyCoveragePoints": round(pct(result["lemma_covered"]) - pct(result["exact"]), 3),
            "mostFrequentOutsideInventory": top_outside,
            "mostFrequentLemmaOnlyMatches": top_lemma_gains,
        }
    report["coverage"] = coverage
    report["_surfaceLemmaCounts"] = [
        {"surface": surface, "lemma": lemma, "count": count}
        for (surface, lemma), count in sorted(lemma_pairs.items())
    ]
    report["_surfaceLemmaPosCounts"] = [
        {"surface": surface, "lemma": lemma, "upos": upos, "count": count}
        for (surface, lemma, upos), count in sorted(lemma_pos_pairs.items())
    ]
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--text-field", default="text")
    parser.add_argument("--with-support", action="store_true")
    parser.add_argument("--both-inventories", action="store_true", help="report cards-only and cards-plus-support from the same parse")
    parser.add_argument(
        "--with-research-additions",
        action="store_true",
        help="include the owner-selected forms in src/data/spoken-coverage-research.da.json",
    )
    parser.add_argument(
        "--extra-form",
        action="append",
        default=[],
        help="selected form to add to the cards-plus-support research inventory; repeat for each form",
    )
    parser.add_argument("--pos-package", default="ddt_nocharlm")
    parser.add_argument("--batch-documents", type=int, default=12)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--max-documents", type=int, help="process only the first N documents (smoke testing only)")
    parser.add_argument("--out")
    parser.add_argument(
        "--frequency-out",
        help="write aggregate surface/lemma counts for cross-corpus ranking; never writes transcript text",
    )
    parser.add_argument(
        "--pos-frequency-out",
        help="write aggregate surface/lemma/UPOS counts for category ranking; never writes transcript text",
    )
    args = parser.parse_args()
    report = run(args)
    aggregate_counts = report.pop("_surfaceLemmaCounts")
    aggregate_pos_counts = report.pop("_surfaceLemmaPosCounts")
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    print(rendered, end="")
    if args.out:
        Path(args.out).write_text(rendered, encoding="utf-8")
    if args.frequency_out:
        aggregate = {
            "method": report["method"],
            "input": report["input"],
            "documents": report["documents"],
            "runningTokens": report["runningTokens"],
            "surfaceLemmaCounts": aggregate_counts,
        }
        Path(args.frequency_out).write_text(
            json.dumps(aggregate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    if args.pos_frequency_out:
        aggregate = {
            "method": report["method"],
            "input": report["input"],
            "documents": report["documents"],
            "runningTokens": report["runningTokens"],
            "surfaceLemmaPosCounts": aggregate_pos_counts,
        }
        Path(args.pos_frequency_out).write_text(
            json.dumps(aggregate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )


if __name__ == "__main__":
    main()
