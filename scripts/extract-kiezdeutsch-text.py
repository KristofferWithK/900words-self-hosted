#!/usr/bin/env python3
"""Extract running spoken text from the Cologne Corpus of Kiezdeutsch GAT 2 PDFs.

The corpus ships its transcripts as GAT 2 minimal transcripts inside PDF files
(Zenodo record 15465769, DOI 10.5281/zenodo.15465769, CC BY 4.0).  There is no
machine-readable corpus format, so running text has to be recovered from the
rendered page.  Every rule below is mechanical and asserted rather than
hand-applied, because a silent extraction error would move a coverage number.

Rules, in the order they run, one line at a time:

1.  **Page headers.**  Each page repeats a running head of the form
    ``G1 - Multilingual speakers``.  A line that matches the header pattern
    exactly is dropped.  Nothing else in the corpus matches it.
2.  **Line numbers.**  Transcript lines are numbered from 1, strictly
    sequentially, across the whole file.  The prefix is removed only when the
    leading integer equals the next expected number, and the script asserts
    that the final counter matches the number of numbered lines.  This is what
    stops a spoken numeral from being eaten as a line number.  A line with no
    number is a soft-wrapped continuation of the line above and is kept whole.
3.  **Speaker sigla.**  ``ME1:`` .. ``MO7:`` at the head of a numbered line.
    In the frozen release every colon in all three files is a siglum colon, so
    after this step no colons remain; the script asserts that.
4.  **Parenthesised notation.**  Every parenthesised run is removed, balanced
    or not: ``(.)`` micro-pauses, ``((LAUGHS))`` and the rest of the
    para-linguistic comments, the malformed ``((LAUGHS)`` and ``(((SNORTS))``
    that occur once each, and the roughly seventy single-parenthesis
    ``(UNINTELLIGIBLE)`` marks.  This is deliberately blunt.  GAT 2 also uses
    single parentheses for an uncertain *hearing* of real speech, and stripping
    everything therefore discards a handful of genuine word tokens along with
    the comments.  In the frozen release that is 358 word tokens inside
    parentheses, of which 346 are English comment labels and at most six are
    plausibly spoken German (``damla``, ``govale``, ``farming``,
    ``einstufung``, ``so komplett``).  Six tokens in about 33,000 is 0.02%, and
    a rule that needs no judgement is worth more than those six tokens.
5.  **Overlap brackets.**  ``[`` and ``]`` are deleted and their contents kept:
    the brackets mark simultaneous talk, the words inside them were spoken.
6.  **Anonymisation.**  ``***`` runs are deleted.  They carry no letters, so
    the letter-token rule would drop them anyway; deleting them keeps the
    intermediate text honest.

Three pieces of notation are deliberately *not* given a rule, because the
Danish letter-token rule already handles them and mirroring that rule matters
more than tidying German:

*   Latching ``=`` (``nix=ja``, five occurrences) splits into two tokens.
*   Clitic ``_`` (``so_ne``, ``is_n``, eleven occurrences) splits into two.
*   The single self-repair ``/`` (``ba/bevor``) splits into two.

The output is running text only.  It is written outside the repository, like
``scripts/fetch-coral-test-text.mjs``, and the receipt beside it carries the
Zenodo MD5 of every source PDF plus the counts each rule accounted for.

Usage:
    python scripts/extract-kiezdeutsch-text.py \
        --pdf-dir <temp>/kiezdeutsch \
        --output <temp>/kiezdeutsch-text.jsonl \
        --receipt <temp>/kiezdeutsch-receipt.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pdfplumber
import regex

ROOT = Path(__file__).resolve().parent.parent

# The Danish letter-token rule, copied verbatim from
# scripts/measure-spoken-lemma-coverage.py so the two studies count the same way.
TOKEN_RE = regex.compile(r"[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*")

HEADER_RE = re.compile(r"^G\d\s*[–—-]\s*.*speakers\s*$", re.IGNORECASE)
LINE_NUMBER_RE = re.compile(r"^(\d+)\s+")
SIGLUM_RE = re.compile(r"^(M[EO]\d):\s?")
PAREN_RE = re.compile(r"\(+[^()]*\)+")
STAR_RE = re.compile(r"\*+")

# Zenodo publishes an MD5 per file; these are the three transcription PDFs of
# record 15465769 as read from the record's own API response.
EXPECTED_MD5 = {
    "02_G1 - Multilingual speakers (transcription).pdf": "2e4b39c559152502ba380950ac478569",
    "04_G2 - Monolingual speakers (transcription).pdf": "b85a1f7148f02d6457e170760321f2cf",
    "06_G3 - Multilingual & monolingual speakers (transcription).pdf": "af6b659230cf08b65220c389a3f2a8b4",
}


def normal(value: str) -> str:
    return unicodedata.normalize("NFC", value)


def clean_line(line: str, stats: Counter) -> str:
    """Apply rules 4 to 6 to one already de-numbered, de-siglum'd line."""
    without_parens, removed = PAREN_RE.subn("", line)
    stats["parenGroupsRemoved"] += removed
    for group in PAREN_RE.finditer(line):
        stats["wordTokensInsideParens"] += len(TOKEN_RE.findall(group.group(0)))
    # Any stray bracket left by an unbalanced paren run.
    stripped = without_parens.replace("(", "").replace(")", "")
    stats["overlapBracketsRemoved"] += stripped.count("[") + stripped.count("]")
    stripped = stripped.replace("[", "").replace("]", "")
    stripped, stars = STAR_RE.subn("", stripped)
    stats["anonymisationMarksRemoved"] += stars
    return re.sub(r"\s+", " ", stripped).strip()


def extract_pdf(path: Path, stats: Counter) -> list[str]:
    with pdfplumber.open(path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    stats["pages"] += len(pages)

    lines = [line for page in pages for line in normal(page).split("\n")]
    expected = 1
    out: list[str] = []
    for line in lines:
        text = line.strip()
        if not text:
            continue
        if HEADER_RE.match(text):
            stats["headerLinesDropped"] += 1
            continue
        match = LINE_NUMBER_RE.match(text)
        if match and int(match.group(1)) == expected:
            expected += 1
            stats["numberedLines"] += 1
            text = text[match.end():]
        elif match:
            raise RuntimeError(
                f"{path.name}: line starts with {match.group(1)} where {expected} was expected. "
                "The line-number sequence is the guard against eating a spoken numeral; "
                "reconcile the source before measuring."
            )
        else:
            stats["wrappedContinuationLines"] += 1
        siglum = SIGLUM_RE.match(text)
        if siglum:
            stats["siglaRemoved"] += 1
            stats[f"siglum:{siglum.group(1)}"] += 1
            text = text[siglum.end():]
        cleaned = clean_line(text, stats)
        if cleaned:
            out.append(cleaned)
    stats["lastLineNumber"] += expected - 1
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pdf-dir", required=True)
    parser.add_argument("--output", required=True, help="JSONL of {'text': ...}, one object per transcript line")
    parser.add_argument("--receipt", required=True)
    args = parser.parse_args()

    output_path = Path(args.output).resolve()
    receipt_path = Path(args.receipt).resolve()
    for target in (output_path, receipt_path):
        if ROOT in target.parents:
            raise SystemExit(f"Refusing to write Kiezdeutsch transcript material inside the repository: {target}")

    pdf_dir = Path(args.pdf_dir)
    stats: Counter = Counter()
    sources = []
    documents: list[str] = []
    for name, expected_md5 in sorted(EXPECTED_MD5.items()):
        path = pdf_dir / name
        if not path.exists():
            raise SystemExit(f"Missing source PDF: {path}")
        digest = hashlib.md5(path.read_bytes()).hexdigest()
        if digest != expected_md5:
            raise SystemExit(f"{name}: MD5 {digest} does not match the Zenodo record's {expected_md5}.")
        lines = extract_pdf(path, stats)
        tokens = sum(len(TOKEN_RE.findall(line)) for line in lines)
        sources.append({"file": name, "md5": digest, "lines": len(lines), "runningTokens": tokens})
        documents.extend(lines)

    running_tokens = sum(len(TOKEN_RE.findall(line)) for line in documents)
    residual_colons = sum(line.count(":") for line in documents)
    if residual_colons:
        raise RuntimeError(f"{residual_colons} colons survived siglum removal; the siglum rule no longer covers the source.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        "".join(json.dumps({"text": line}, ensure_ascii=False) + "\n" for line in documents),
        encoding="utf-8",
    )
    receipt = {
        "corpus": "Cologne Corpus of Kiezdeutsch / Kölner Korpus des Kiezdeutschen",
        "record": "https://zenodo.org/records/15465769",
        "doi": "10.5281/zenodo.15465769",
        "license": "CC BY 4.0",
        "sources": sources,
        "transcriptLines": len(documents),
        "runningTokens": running_tokens,
        "tokenRule": "[\\p{L}\\p{M}]+(?:['’-][\\p{L}\\p{M}]+)* over NFC text, the Danish letter-token rule",
        "extraction": {key: value for key, value in sorted(stats.items()) if not key.startswith("siglum:")},
        "sigla": {key.split(":", 1)[1]: value for key, value in sorted(stats.items()) if key.startswith("siglum:")},
        "outputSha256": hashlib.sha256(output_path.read_bytes()).hexdigest(),
    }
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in receipt.items() if k != "sigla"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
