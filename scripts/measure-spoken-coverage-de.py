#!/usr/bin/env python3
"""Lemma-aware German transcript aggregation, mirroring the Danish run.

This is the German counterpart of ``scripts/measure-spoken-lemma-coverage.py``.
It keeps that script's frozen letter-token denominator and its family-aware
matching rule, and swaps the Danish Stanza pipeline for the German one.  Input
corpora and model files stay outside Git; the outputs are aggregate
surface/lemma/UPOS counts only, never transcript text.

Three things differ from the Danish script, and each is a deliberate mirror
rather than an improvement:

*   **No inventory is built in.**  Danish had 900 card headwords and 252
    support forms to measure against.  German has no course, so the inventory
    is supplied with ``--inventory`` (a JSON list of forms, or an object with a
    ``selectedForms`` list) and is optional.  With no inventory the script only
    emits the aggregates, which is what the ranking step needs.
*   **No spoken-form equivalences.**  Danish had two owner-approved
    reductions, ``ha => have`` and ``ik => ikke``.  No German equivalences have
    been approved, so the map is empty unless ``--equivalences`` supplies one.
*   **No multi-word-token expansion.**  Stanza's German default pipeline
    includes an `mwt` processor that would split `zum` into `zu` + `dem`.  It
    is deliberately left out: expanding one running token into two would break
    the frozen letter-token denominator that the whole comparison rests on, and
    the script asserts that Stanza returns exactly as many words as it was
    given.  Contracted prepositions therefore stay single tokens with a single
    predicted lemma.
*   **No separable-prefix reconstruction.**  German splits a separable verb
    across two tokens (``macht ... auf``).  Universal Dependencies gives the
    finite verb the base lemma ``machen`` and leaves ``auf`` as its own token
    with lemma ``auf``, and identifying the pair would need a dependency parse
    the Danish run did not use either.  So a particle counts as its own token
    against its own lemma, and ``aufmachen`` is never reconstructed.  This
    undercounts rather than overcounts coverage.

Usage:
    python scripts/measure-spoken-coverage-de.py \
        --input <temp>/kiezdeutsch-text.jsonl \
        --model-dir <temp>/stanza \
        --corpus-name kiezdeutsch \
        --pos-frequency-out <temp>/kiezdeutsch.pos-counts.de.json \
        --frequency-out <temp>/kiezdeutsch.lemma-counts.de.json
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Iterable

import regex
import stanza
import torch


ROOT = Path(__file__).resolve().parent.parent
# The Danish letter-token rule, copied verbatim so the two studies count the
# same way.  A token is a run of letters and combining marks, optionally joined
# by an apostrophe or a hyphen.
TOKEN_RE = regex.compile(r"[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*")
# The Danish script strips line-initial speaker prefixes from its transcripts.
# German sources here arrive already stripped, but the rule is kept so an
# unstripped source cannot silently inflate the denominator.
SPEAKER_PREFIX_RE = re.compile(r"^\s*(?:sprecher|speaker)\s+[^:\n]+:\s*", re.IGNORECASE | re.MULTILINE)


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

    with path.open(encoding="utf-8") as handle:
        for line in handle:
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


def load_inventory(path: str | None) -> set[str]:
    if not path:
        return set()
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    forms = value if isinstance(value, list) else value.get("selectedForms", [])
    return {normal(form) for form in forms}


def load_equivalences(path: str | None) -> dict[str, str]:
    if not path:
        return {}
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    mapping = value if isinstance(value, dict) and "spokenFormEquivalences" not in value else value["spokenFormEquivalences"]
    return {normal(source): normal(target) for source, target in mapping.items()}


def run(args: argparse.Namespace) -> dict:
    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(1)
    taught = load_inventory(args.inventory)
    equivalences = load_equivalences(args.equivalences)
    # Stanza's per-processor `package` overrides are easy to pass and easy to
    # have silently ignored: `pos_package="combined_nocharlm"` loaded
    # `combined_charlm.pt` on Stanza 1.14.0 without complaining.  So the
    # packages go through the `package` mapping, and whatever actually resolved
    # is read back off the pipeline config and written into the report.  Never
    # record the package you asked for; record the file that loaded.
    packages = {name: value for name, value in (("pos", args.pos_package), ("lemma", args.lemma_package)) if value}
    nlp = stanza.Pipeline(
        "de",
        processors="tokenize,pos,lemma",
        tokenize_pretokenized=True,
        model_dir=args.model_dir,
        package=packages or None,
        use_gpu=False,
        verbose=False,
    )
    resolved_models = {
        name: Path(str(nlp.config.get(f"{name}_model_path", ""))).name
        for name in ("tokenize", "pos", "lemma")
    }

    total = analysed = document_count = 0
    lemma_pairs: Counter[tuple[str, str]] = Counter()
    lemma_pos_pairs: Counter[tuple[str, str, str]] = Counter()
    examples: dict[str, str] = {}
    exact = family = family_only = 0
    outside: Counter[str] = Counter()

    def count_batch(batch: list[list[str]]) -> None:
        nonlocal total, analysed, exact, family, family_only
        parsed = nlp(batch)
        parsed_words = [word for sentence in parsed.sentences for word in sentence.words]
        flattened = [token for tokens in batch for token in tokens]
        if len(parsed_words) != len(flattened):
            raise RuntimeError(
                f"Stanza changed the frozen token count: expected {len(flattened)}, got {len(parsed_words)}"
            )
        for raw, parsed_word in zip(flattened, parsed_words, strict=True):
            token = normal(raw)
            lemma = normal(parsed_word.lemma or "")
            upos = parsed_word.upos or ""
            total += 1
            if lemma:
                analysed += 1
                lemma_pairs[(token, lemma)] += 1
                if upos:
                    lemma_pos_pairs[(token, lemma, upos)] += 1
                examples.setdefault(token, lemma)
            if not taught:
                continue
            direct = token in taught
            by_lemma = lemma in taught or equivalences.get(token) in taught
            if direct:
                exact += 1
            if direct or by_lemma:
                family += 1
                if not direct:
                    family_only += 1
            else:
                outside[token] += 1

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
        "method": (
            "frozen running-token denominator; exact NFC-normalised form or Stanza German predicted lemma; "
            "no compound, derivational, separable-prefix or semantic-family credit"
        ),
        "language": "de",
        "corpusName": args.corpus_name,
        "stanzaVersion": stanza.__version__,
        "stanzaModels": resolved_models,
        "torchVersion": torch.__version__,
        "modelDirectory": str(Path(args.model_dir).resolve()),
        "input": str(Path(args.input).resolve()),
        "textField": args.text_field,
        "spokenFormEquivalences": equivalences,
        "documents": document_count,
        "runningTokens": total,
        "tokensWithPredictedLemma": analysed,
        "distinctSurfaceForms": len({surface for surface, _ in lemma_pairs}),
        "distinctLemmas": len({lemma for _, lemma in lemma_pairs}),
    }
    if taught:
        report["coverage"] = {
            "inventoryForms": len(taught),
            "exactCoveredTokens": exact,
            "exactCoveragePercent": pct(exact),
            "familyAwareCoveredTokens": family,
            "familyAwareCoveragePercent": pct(family),
            "familyOnlyCoveredTokens": family_only,
            "familyOnlyCoveragePoints": round(pct(family) - pct(exact), 3),
            "mostFrequentOutsideInventory": [
                {"word": word, "count": count, "predictedLemma": examples.get(word, "")}
                for word, count in sorted(outside.items(), key=lambda entry: (-entry[1], entry[0]))[:30]
            ],
        }
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
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--corpus-name", required=True)
    parser.add_argument("--text-field", default="text")
    parser.add_argument("--inventory", help="JSON list of forms, or an object with selectedForms; optional")
    parser.add_argument("--equivalences", help="JSON map of approved spoken-form reductions; optional")
    # Left unset by default: Stanza's own German defaults are the `combined`
    # treebank, and pinning the resolved model filenames in the report is worth
    # more than asserting a package name the loader may or may not honour.
    parser.add_argument("--pos-package")
    parser.add_argument("--lemma-package")
    parser.add_argument("--batch-documents", type=int, default=64)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--max-documents", type=int, help="process only the first N documents (smoke testing only)")
    parser.add_argument("--out")
    parser.add_argument("--frequency-out", help="aggregate surface/lemma counts; never writes transcript text")
    parser.add_argument("--pos-frequency-out", help="aggregate surface/lemma/UPOS counts; never writes transcript text")
    args = parser.parse_args()

    report = run(args)
    aggregate_counts = report.pop("_surfaceLemmaCounts")
    aggregate_pos_counts = report.pop("_surfaceLemmaPosCounts")
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    print(rendered, end="")
    if args.out:
        Path(args.out).write_text(rendered, encoding="utf-8")
    shared = {
        "method": report["method"],
        "language": report["language"],
        "corpusName": report["corpusName"],
        "stanzaVersion": report["stanzaVersion"],
        "stanzaModels": report["stanzaModels"],
        "documents": report["documents"],
        "runningTokens": report["runningTokens"],
    }
    if args.frequency_out:
        Path(args.frequency_out).write_text(
            json.dumps({**shared, "surfaceLemmaCounts": aggregate_counts}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    if args.pos_frequency_out:
        Path(args.pos_frequency_out).write_text(
            json.dumps({**shared, "surfaceLemmaPosCounts": aggregate_pos_counts}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
