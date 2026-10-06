#!/usr/bin/env python3
"""Summarise a simulator soak (ios-sim.yml mode=soak).

    python3 scripts/soak-report.py launch.log [start-profile.xml end-profile.xml] > soak-report.md

Reads the performance log the app streamed to its console (`PERFLOG {json}`
lines, src/ui/diagnostics/boot.ts) and, when given, the Time Profiler exports
of the start and the end of the soak (`xctrace export ... time-profile`).
Writes Markdown: word-hit cost in the first 50 hits against the last 50 and
per 5 minutes, the recorder's counts over time, and the 15 heaviest symbols
of the WebContent process at the start and at the end, by self and by total
time. Also writes perflog.jsonl (the events, one per line) beside launch.log.

Standard library only: it runs on a bare macOS runner.
"""
import json
import os
import statistics
import sys
import xml.etree.ElementTree as ET
from collections import Counter

WORD_HITS = {'answer-right', 'answer-wrong', 'article-right', 'article-wrong', 'card', 'card-select', 'wheel'}


def read_perflog(path):
    events = []
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            i = line.find('PERFLOG {')
            if i < 0:
                continue
            try:
                events.append(json.loads(line[i + len('PERFLOG '):].strip()))
            except json.JSONDecodeError:
                pass
    return events


def stats(values):
    if not values:
        return '–'
    return f"n {len(values)}, median {statistics.median(values):.0f}, p90 {sorted(values)[int(len(values) * 0.9) - 1 if len(values) >= 10 else -1]:.0f}, worst {max(values):.0f} ms"


def hits_report(events, out):
    hits = [e for e in events if e.get('type') == 'hit' and e.get('kind') in WORD_HITS]
    steers = [e for e in events if e.get('type') == 'hit' and e.get('kind') == 'steer']
    kinds = Counter(e['kind'] for e in hits)
    out.append(f"**{len(hits)} word hits** ({', '.join(f'{k} {v}' for k, v in sorted(kinds.items()))}), {len(steers)} steering taps.\n")
    if not hits:
        return
    out.append('| | cost (max of frame gap, input+handler) | worst frame gap | handler | play() resolved |')
    out.append('|---|---|---|---|---|')
    for label, part in (('first 50', hits[:50]), ('last 50', hits[-50:])):
        out.append(f"| {label} | {stats([h['cost'] for h in part])} | {stats([h['worstGap'] for h in part if h.get('worstGap') is not None])} | "
                   f"{stats([h['handler'] for h in part if h.get('handler') is not None])} | {stats([h['playResolved'] for h in part if h.get('playResolved') is not None])} |")
    out.append('')
    out.append('Per 5 minutes of app time (word hits):\n')
    out.append('| minutes | hits | median cost | p90 cost | worst cost | median handler | median play() call to resolved |')
    out.append('|---|---|---|---|---|---|---|')
    buckets = {}
    for h in hits:
        buckets.setdefault(int(h['up'] // 300000), []).append(h)
    for b in sorted(buckets):
        part = buckets[b]
        costs = sorted(h['cost'] for h in part)
        handlers = [h['handler'] for h in part if h.get('handler') is not None]
        # The media stack's own time for a start: what grew with the elements
        # alive (soak 1) and with Now Playing (soak 2, src/ui/mediaQuiet.ts).
        plays = [h['playResolved'] - h['playCall'] for h in part if h.get('playResolved') is not None and h.get('playCall') is not None]
        out.append(f"| {b * 5}-{b * 5 + 5} | {len(part)} | {statistics.median(costs):.0f} | {costs[max(0, int(len(costs) * 0.9) - 1)]:.0f} | {costs[-1]:.0f} | {statistics.median(handlers) if handlers else 0:.1f} | {statistics.median(plays) if plays else '–'} |")
    out.append('')


def snaps_report(events, out):
    snaps = [e for e in events if e.get('type') == 'snap']
    if not snaps:
        out.append('No snapshots in the log.\n')
        return
    picked, last_minute = [], -10
    for s in snaps:
        minute = s['up'] / 60000
        if minute - last_minute >= 5 or s is snaps[-1]:
            picked.append(s)
            last_minute = minute
    out.append('| min | audio made / alive / reused / audible | canvases made / alive / px | URLs made / revoked | storage chars | setItems / ms | win / doc listeners | timeouts / intervals live | rAF/s | React commits | DOM nodes |')
    out.append('|---|---|---|---|---|---|---|---|---|---|---|')
    for s in picked:
        a, c, u, st, li, t = s['audio'], s['canvas'], s['urls'], s['storage'], s['listeners'], s['timers']
        out.append(f"| {s['up'] / 60000:.0f} | {a['created']} / {a['alive']} / {a.get('reloaded', '-')} / {a.get('audible', '-')} | {c['created']} / {c['alive']} / {c['alivePixels']} | {u['created']} / {u['revoked']} | {st['chars']} | {st['setItems']} / {st['setItemMs']:.0f} | "
                   f"{li['window']} / {li['document']} | {t['timeouts']} / {t['intervals']} | {s['rafPerSecond']} | {s['reactCommits']} | {s['domNodes']} |")
    web = snaps[-1].get('webAudio')
    if web:
        out.append(f"\nWeb Audio words at the end: context {web.get('state')}, session {web.get('session')}, {web.get('buffers')} buffers ({web.get('bytes', 0) / 1e6:.1f} MB), "
                   f"{web.get('decodes')} decodes, {web.get('plays')} plays, {web.get('resumes')} resumes.")
    else:
        out.append('\nNo Web Audio word player in the log: the words were on the old element players (switch elementWords).')
    worst = snaps[-1]['storage'].get('worstSetItem')
    if worst:
        out.append(f"\nWorst localStorage write: {worst['key']} {worst['ms']} ms ({worst['chars']} chars) at {worst['up'] / 60000:.1f} min.")
    grown = snaps[-1]['listeners'].get('byType', {})
    if grown:
        out.append(f"Listener balance by type at the end: {', '.join(f'{k} {v}' for k, v in grown.items())}.")
    out.append('')


# ── Time Profiler export ────────────────────────────────────────────────────

def read_profile(path, want='WebContent'):
    """Self and total time per symbol, in ms, for the process matching `want`."""
    cache = {}
    self_ms, total_ms, process_ms = Counter(), Counter(), Counter()
    samples = 0

    def resolve(el):
        ref = el.get('ref')
        if ref is not None:
            return cache.get(ref)
        tag = el.tag
        if tag == 'frame':
            value = el.get('name') or el.get('addr') or '?'
        elif tag == 'backtrace':
            value = [resolve(f) for f in el if f.tag == 'frame']
        elif tag == 'process':
            value = el.get('fmt', '')
        elif tag == 'thread':
            proc = next((resolve(p) for p in el if p.tag == 'process'), '')
            value = proc or el.get('fmt', '')
        elif tag == 'weight':
            try:
                value = int(el.text or 0) / 1e6
            except ValueError:
                value = 1.0
        else:
            value = el.get('fmt', el.text)
        if el.get('id') is not None:
            cache[el.get('id')] = value
        return value

    for _event, el in ET.iterparse(path, events=('end',)):
        if el.tag != 'row':
            continue
        proc, weight, frames = '', 1.0, []
        for child in el:
            if child.tag == 'thread':
                proc = resolve(child) or ''
            elif child.tag == 'process':
                proc = resolve(child) or proc
            elif child.tag == 'weight':
                weight = resolve(child) or 1.0
            elif child.tag == 'backtrace':
                frames = resolve(child) or []
            else:
                resolve(child)
        el.clear()
        process_ms[proc.split(' (')[0]] += weight
        if want and want not in proc:
            continue
        samples += 1
        if frames:
            self_ms[frames[0]] += weight
            for name in set(frames):
                total_ms[name] += weight
    return samples, self_ms, total_ms, process_ms


def profile_report(start, end, out):
    rows = {}
    for label, path in (('start', start), ('end', end)):
        if path and os.path.exists(path) and os.path.getsize(path) > 0:
            try:
                rows[label] = read_profile(path)
            except ET.ParseError as e:
                out.append(f"{label}: could not parse {path}: {e}\n")
    if not rows:
        out.append('No profiler exports.\n')
        return
    for label, (samples, _s, _t, procs) in rows.items():
        top = ', '.join(f"{k} {v:.0f} ms" for k, v in procs.most_common(5))
        out.append(f"- {label}: {samples} WebContent samples; busiest processes: {top}")
    out.append('')
    for kind, idx in (('self', 1), ('total', 2)):
        out.append(f"Heaviest 15 symbols by {kind} time (WebContent), start vs end:\n")
        out.append('| # | start | ms | end | ms |')
        out.append('|---|---|---|---|---|')
        a = rows.get('start', (0, Counter(), Counter(), Counter()))[idx].most_common(15)
        b = rows.get('end', (0, Counter(), Counter(), Counter()))[idx].most_common(15)
        for i in range(15):
            sa = a[i] if i < len(a) else ('', 0)
            sb = b[i] if i < len(b) else ('', 0)
            out.append(f"| {i + 1} | `{sa[0][:70]}` | {sa[1]:.0f} | `{sb[0][:70]}` | {sb[1]:.0f} |")
        out.append('')
    if 'start' in rows and 'end' in rows:
        s_self, e_self = rows['start'][1], rows['end'][1]
        s_n, e_n = sum(s_self.values()) or 1, sum(e_self.values()) or 1
        growth = []
        for name in set(s_self) | set(e_self):
            share_s, share_e = s_self[name] / s_n, e_self[name] / e_n
            growth.append((share_e - share_s, name, share_s, share_e))
        growth.sort(reverse=True)
        out.append('Symbols whose share of self time grew most from start to end:\n')
        out.append('| symbol | start share | end share |')
        out.append('|---|---|---|')
        for d, name, a, b in growth[:15]:
            out.append(f"| `{name[:80]}` | {a * 100:.1f}% | {b * 100:.1f}% |")
        out.append('')
        # The media stack's known costs (soak 2): total time in each, start vs end.
        watch = ('MediaSessionManagerCocoa::updateNowPlayingInfo', 'MediaElementSession::computeNowPlayingInfo',
                 'PlatformMediaSessionManager::bestEligibleSessionForRemoteControls', 'MediaSessionManagerCocoa::clientCharacteristicsChanged',
                 'HTMLMediaElement::playInternal', 'HTMLMediaElement::pauseInternal', 'ScriptedAnimationController::serviceRequestAnimationFrameCallbacks')
        out.append('Media and frame work, total ms (WebContent), start vs end:' + chr(10))
        out.append('| symbol | start | end |')
        out.append('|---|---|---|')
        for w in watch:
            ts = sum(v for k, v in rows['start'][2].items() if w in k)
            te = sum(v for k, v in rows['end'][2].items() if w in k)
            out.append(f"| `{w}` | {ts:.0f} | {te:.0f} |")
        out.append('')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    log = sys.argv[1]
    events = read_perflog(log)
    with open(os.path.join(os.path.dirname(os.path.abspath(log)), 'perflog.jsonl'), 'w', encoding='utf-8') as f:
        for e in events:
            f.write(json.dumps(e) + '\n')
    out = ['## Soak: word-hit cost', '']
    out.append(f"{len(events)} log events streamed; last at {events[-1]['up'] / 60000:.1f} min of app time.\n" if events else 'No PERFLOG lines in the console log.\n')
    hits_report(events, out)
    out.append('## Soak: what piles up (recorder snapshots)\n')
    snaps_report(events, out)
    marks = Counter(e['what'].split(':')[0] for e in events if e.get('type') == 'mark')
    if marks:
        out.append(f"Marks: {', '.join(f'{k} {v}' for k, v in sorted(marks.items()))}.\n")
    out.append('## Soak: Time Profiler, start vs end\n')
    profile_report(sys.argv[2] if len(sys.argv) > 2 else None, sys.argv[3] if len(sys.argv) > 3 else None, out)
    print('\n'.join(out))


if __name__ == '__main__':
    main()
