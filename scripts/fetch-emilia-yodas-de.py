#!/usr/bin/env python3
"""Fetch transcript text only from the German CC BY 4.0 half of Emilia.

`amphion/Emilia-Dataset` holds two halves under different licences.  The
original `Emilia/` half is CC BY-NC 4.0 and **must not be used** for a
commercial marketing claim.  Only `Emilia-YODAS/` is CC BY 4.0.  This script
refuses to look anywhere except `Emilia-YODAS/DE`.

The German CC BY portion is 161 webdataset shards, `DE-B000000.tar` through
`DE-B000160.tar`, about 1.04 GB each and 167 GB in total.  A shard holds one
`.mp3` and one `.json` per utterance.  Only the `.json` members are read, and
only their transcript text and per-segment metadata are kept; audio is never
extracted and never written.  Each tar is deleted as soon as it has been
walked, so peak disk use is one shard plus the accumulated text.

**Sampling.**  The 161 shards are cut into `--shards` equal strata and one
shard is drawn from each with `random.Random(900)`, so the sample is spread
across the whole list and is reproducible from the seed alone.  The chosen
shard names are written into the receipt; they are the provenance, not the seed.

**Access.**  The dataset is gated.  Reading it needs a Hugging Face account
that has accepted the dataset's Terms of Access *and* a token with the
`canReadGatedRepos` permission.  Without both, every file resolves 403
`GatedRepo` and this script stops before downloading anything.

Usage:
    HF_TOKEN=... python scripts/fetch-emilia-yodas-de.py \
        --output <temp>/emilia-de-text.jsonl \
        --receipt <temp>/emilia-de-receipt.json \
        --work-dir <temp>/emilia-work
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import tarfile
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

import regex

ROOT = Path(__file__).resolve().parent.parent

DATASET = "amphion/Emilia-Dataset"
# The repository head read at https://huggingface.co/api/datasets/amphion/Emilia-Dataset
# on 2026-08-27.  A different SHA means the shard list may have moved; reconcile
# the pin before measuring rather than measuring a different corpus.
EXPECTED_REVISION = "d7f2f7340a6385696f3766c8049fa920a4707c07"
DIRECTORY = "Emilia-YODAS/DE"
SHARD_COUNT = 161
SEED = 900

# The Danish letter-token rule, copied verbatim from
# scripts/measure-spoken-lemma-coverage.py.
TOKEN_RE = regex.compile(r"[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*")


def request(url: str, token: str | None) -> bytes:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response:
        return response.read()


def assert_pinned_revision(token: str | None) -> None:
    payload = json.loads(request(f"https://huggingface.co/api/datasets/{DATASET}/revision/main", token))
    sha = payload.get("sha")
    if sha != EXPECTED_REVISION:
        raise SystemExit(
            f"Expected {DATASET} revision {EXPECTED_REVISION}, received {sha or 'no SHA'}. "
            "Reconcile the source pin before measuring."
        )


def shard_plan(count: int) -> list[str]:
    if count < 1 or count > SHARD_COUNT:
        raise SystemExit(f"--shards must be between 1 and {SHARD_COUNT}")
    rng = random.Random(SEED)
    names = []
    for index in range(count):
        low = index * SHARD_COUNT // count
        high = (index + 1) * SHARD_COUNT // count
        names.append(f"DE-B{rng.randrange(low, high):06d}.tar")
    return names


def download(name: str, token: str | None, work_dir: Path) -> Path:
    url = f"https://huggingface.co/datasets/{DATASET}/resolve/{EXPECTED_REVISION}/{DIRECTORY}/{name}"
    target = work_dir / name
    try:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=1800) as response, target.open("wb") as handle:
            while chunk := response.read(1 << 20):
                handle.write(chunk)
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise SystemExit(
                f"HTTP {error.code} for {DIRECTORY}/{name}: {error.headers.get('X-Error-Message', '')}\n"
                "The dataset is gated. The account must accept the Terms of Access at "
                f"https://huggingface.co/datasets/{DATASET} and the token must carry the "
                "canReadGatedRepos permission."
            ) from error
        raise
    return target


def walk_shard(path: Path) -> tuple[list[dict], int]:
    rows: list[dict] = []
    tokens = 0
    with tarfile.open(path, "r") as archive:
        for member in archive:
            if not member.isfile() or not member.name.endswith(".json"):
                continue
            handle = archive.extractfile(member)
            if handle is None:
                continue
            record = json.loads(handle.read().decode("utf-8"))
            text = record.get("text")
            if not isinstance(text, str):
                continue
            text = unicodedata.normalize("NFC", text)
            tokens += len(TOKEN_RE.findall(text))
            rows.append(
                {
                    "text": text,
                    "id": record.get("id"),
                    "duration": record.get("duration"),
                    "language": record.get("language"),
                    "speaker": record.get("speaker"),
                    "dnsmos": record.get("dnsmos"),
                }
            )
    return rows, tokens


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--work-dir", required=True)
    parser.add_argument("--shards", type=int, default=6)
    parser.add_argument("--min-tokens", type=int, default=1_000_000)
    args = parser.parse_args()

    output_path = Path(args.output).resolve()
    receipt_path = Path(args.receipt).resolve()
    work_dir = Path(args.work_dir).resolve()
    for target in (output_path, receipt_path, work_dir):
        if ROOT in target.parents:
            raise SystemExit(f"Refusing to write Emilia transcript material inside the repository: {target}")

    token = os.environ.get("HF_TOKEN")
    assert_pinned_revision(token)
    plan = shard_plan(args.shards)
    work_dir.mkdir(parents=True, exist_ok=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    shards = []
    total_tokens = 0
    total_rows = 0
    with output_path.open("w", encoding="utf-8") as out:
        for name in plan:
            archive = download(name, token, work_dir)
            size = archive.stat().st_size
            rows, tokens = walk_shard(archive)
            archive.unlink()
            for row in rows:
                out.write(json.dumps(row, ensure_ascii=False) + "\n")
            total_tokens += tokens
            total_rows += len(rows)
            shards.append({"shard": name, "tarBytes": size, "segments": len(rows), "runningTokens": tokens})
            print(f"{name}: {len(rows)} segments, {tokens} running tokens, {total_tokens} cumulative", flush=True)

    if total_tokens < args.min_tokens:
        raise SystemExit(
            f"Collected {total_tokens} running tokens, below the {args.min_tokens} target. "
            "Raise --shards and rerun; the stratified plan is stable under a larger count only "
            "if the receipt records the new shard list."
        )

    receipt = {
        "corpus": "Emilia-YODAS German (CC BY 4.0 half of amphion/Emilia-Dataset)",
        "dataset": DATASET,
        "revision": EXPECTED_REVISION,
        "directory": DIRECTORY,
        "license": "CC BY 4.0 (the Emilia-YODAS half only; the Emilia/ half is CC BY-NC and excluded)",
        "shardListSize": SHARD_COUNT,
        "seed": SEED,
        "sampling": f"{args.shards} equal strata over DE-B000000..DE-B{SHARD_COUNT - 1:06d}, one shard drawn per stratum with random.Random({SEED})",
        "shards": shards,
        "segments": total_rows,
        "runningTokens": total_tokens,
        "tokenRule": "[\\p{L}\\p{M}]+(?:['’-][\\p{L}\\p{M}]+)* over NFC text, the Danish letter-token rule",
        "collection": "transcript .json members only; .mp3 members never extracted; each tar deleted after it is walked",
        "outputSha256": hashlib.sha256(output_path.read_bytes()).hexdigest(),
    }
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in receipt.items() if key != "shards"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
