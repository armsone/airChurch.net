#!/usr/bin/env python3
"""Read-only public event audit. No AI, credentials, collection refresh, or DB writes."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.parse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, help='New evidence directory (must not exist)')
parser.add_argument('--previous', help='Previous audit directory for event/source changes')
args = parser.parse_args()
previous = None
if args.previous:
    previous = json.loads((Path(args.previous) / 'state.json').read_text())
out = Path(args.output)
out.mkdir(parents=True, exist_ok=False)
started = time.perf_counter()
today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
base = {'from': str(today), 'to': str(today + dt.timedelta(days=365))}
requests, failures, findings = [], [], []

def fetch_pages(name, extra):
    items, seen, cursor = [], set(), None
    for page in range(10):
        params = {**base, **extra, **({'cursor': cursor} if cursor else {})}
        url = 'https://airchurch.net/api/events?' + urllib.parse.urlencode(params)
        began = time.perf_counter()
        result = subprocess.run(['curl', '--fail', '--silent', '--show-error',
            '--max-time', '20', '--user-agent', 'Mozilla/5.0', url], capture_output=True)
        if result.returncode:
            raise RuntimeError(f'{name}: request failed ({result.returncode})')
        path = out / f'{name}-{page}.json'
        path.write_bytes(result.stdout)
        requests.append({'file': path.name, 'url': url, 'bytes': len(result.stdout),
            'sha256': hashlib.sha256(result.stdout).hexdigest(),
            'seconds': round(time.perf_counter() - began, 3)})
        data = json.loads(result.stdout)
        if not isinstance(data.get('items'), list) or 'nextCursor' not in data:
            raise RuntimeError(f'{name}: unexpected response schema')
        items.extend(data['items'])
        cursor = data['nextCursor']
        if not cursor:
            return items, data.get('sources', [])
        if not isinstance(cursor, str) or cursor in seen:
            raise RuntimeError(f'{name}: repeated or invalid cursor')
        seen.add(cursor)
    raise RuntimeError(f'{name}: page cap reached; incomplete audit')

def valid_date(value):
    try:
        return isinstance(value, str) and dt.date.fromisoformat(value).isoformat() == value
    except (ValueError, TypeError):
        return False

counts, all_items, sources = {}, [], []
try:
    all_items, sources = fetch_pages('all', {})
    counts['all'] = len(all_items)
    ids = [x.get('id') for x in all_items]
    if len(set(ids)) != len(ids):
        failures.append({'check': 'duplicate_id'})
    for item in all_items:
        rid = item.get('id')
        if not (isinstance(rid, str) and len(rid) == 32 and all(c in '0123456789abcdef' for c in rid)):
            failures.append({'check': 'id_shape', 'id': rid})
        a, b = item.get('startDate'), item.get('endDate')
        if not (valid_date(a) and valid_date(b) and a <= b and a <= base['to'] and b >= base['from']):
            failures.append({'check': 'date_interval', 'id': rid})
        if not str(item.get('sourceUrl', '')).startswith(('https://', 'http://')):
            failures.append({'check': 'source_url', 'id': rid})
    week_end = str(today + dt.timedelta(days=6))
    saturday_offset = (5 - today.weekday()) % 7 if today.weekday() != 6 else 0
    weekend_start = str(today + dt.timedelta(days=saturday_offset))
    weekend_end = str(today + dt.timedelta(days=saturday_offset + (today.weekday() != 6)))
    cases = [
        ('seoul', {'region': '서울'}, lambda x: x['region'] == '서울'),
        ('family', {'audience': '가정'}, lambda x: x['audience'] == '가정'),
        ('praise', {'category': '찬양·공연'}, lambda x: x['category'] == '찬양·공연'),
        ('online', {'online': '1'}, lambda x: x['attendance'] in ('온라인', '현장·온라인')),
        ('jiguchon', {'church': '10017'}, lambda x: x['churchPublicId'] == 10017),
        ('week', {'to': week_end}, lambda x: x['startDate'] <= week_end),
        ('weekend', {'from': weekend_start, 'to': weekend_end},
            lambda x: x['startDate'] <= weekend_end and x['endDate'] >= weekend_start),
        ('paged', {'limit': '25'}, lambda x: True),
    ]
    for name, params, matches in cases:
        rows, _ = fetch_pages(name, params)
        counts[name] = len(rows)
        expected = {x['id'] for x in all_items if matches(x)}
        actual = {x['id'] for x in rows}
        if expected != actual or len(actual) != len(rows):
            failures.append({'check': 'filter_set', 'case': name,
                'missing': sorted(expected - actual), 'unexpected': sorted(actual - expected),
                'duplicates': len(rows) - len(actual)})
    findings = [{'source': x.get('id'), 'status': x.get('status'),
        'lastSuccessAt': x.get('lastSuccessAt')} for x in sources
        if x.get('enabled') and x.get('status') not in ('ok',)]
except (RuntimeError, ValueError, KeyError, TypeError) as error:
    failures.append({'check': 'audit_incomplete', 'reason': str(error)})

state = {'events': {x['id']: {k: v for k, v in x.items() if k != 'checkedAt'} for x in all_items},
    'sources': {x['id']: {'enabled': x.get('enabled'), 'status': x.get('status')} for x in sources}}
changes = None
if previous and not failures:
    changes = {}
    for kind in ('events', 'sources'):
        before, after = previous[kind], state[kind]
        changes[kind] = {'added': sorted(after.keys() - before.keys()),
            'removed': sorted(before.keys() - after.keys()),
            'changed': sorted(k for k in before.keys() & after.keys() if before[k] != after[k])}
if not failures:
    (out / 'state.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
summary = {'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
    'ok': not failures, 'counts': counts, 'failures': failures,
    'changes': changes,
    'source_attention_count': len(findings), 'requests': len(requests),
    'elapsed_seconds': round(time.perf_counter() - started, 3),
    'ai_calls': 0, 'writes_to_site': 0,
    'limitations': 'API structure/filter consistency only. No source truth or booking availability check. Concurrent updates can cause differences.'}
compact = json.dumps(summary, ensure_ascii=False, separators=(',', ':')) + '\n'
(out / 'summary.json').write_text(compact)
(out / 'evidence.json').write_text(json.dumps({'requests': requests,
    'source_attention': findings, 'raw_response_bytes': sum(x['bytes'] for x in requests),
    'summary_bytes': len(compact.encode('utf-8'))}, ensure_ascii=False, indent=2) + '\n')
print(compact, end='')
raise SystemExit(0 if summary['ok'] else 1)
