#!/usr/bin/env python3
"""Read event-source health; optionally retry up to three due transient failures.

Credentials are read from AIRCHURCH_ADMIN_USERNAME/PASSWORD in memory only.
Default is diagnostics only. No timers, repeated retries, or scheduler are installed.
"""
import argparse
import collections
import http.cookiejar
import json
import os
from pathlib import Path
import time
import urllib.request
import urllib.error

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True)
parser.add_argument('--refresh-due', action='store_true')
args = parser.parse_args()
username = os.environ.get('AIRCHURCH_ADMIN_USERNAME')
password = os.environ.get('AIRCHURCH_ADMIN_PASSWORD')
if not username or not password:
    raise SystemExit('AIRCHURCH_ADMIN_USERNAME/PASSWORD are required.')
out = Path(args.output)
out.mkdir(parents=True, exist_ok=False)
origin = 'https://airchurch.net'
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
started = time.perf_counter()
calls, actions, errors = 0, [], []

def request(path, payload=None):
    global calls
    calls += 1
    req = urllib.request.Request(origin + path,
        data=None if payload is None else json.dumps(payload).encode(),
        headers={'Origin': origin, 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json'})
    try:
        with client.open(req, timeout=35) as response:
            data = response.read()
            return json.loads(data) if 'application/json' in response.headers.get('Content-Type', '') else {}
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f'HTTP {exc.code}') from None

def health(label):
    data = request('/api/admin/events?view=health')
    if not isinstance(data.get('sources'), list) or data.get('truncated') is not False:
        raise RuntimeError('Health response incomplete; no automatic action.')
    (out / f'{label}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return data

def retryable(source):
    error = source.get('lastError') or ''
    return (source.get('refreshAllowed') is True and source.get('due') is True
        and source.get('status') == 'failed'
        and 'TimeoutError' in error
        and not any(x in error.lower() for x in ('robots', 'challenge', 'forbidden', 'disallow')))

before, after = {}, {}
try:
    if request('/api/admin/unlock', {'username': username, 'password': password}).get('role') != 'admin':
        raise RuntimeError('Administrator session unavailable.')
    before = health('before')
    selected = sorted((s for s in before['sources'] if retryable(s)), key=lambda s: s['nextCheckAt'])[:3]
    if args.refresh_due:
        for source in selected:
            # The server rechecks due time and lease when it claims this source.
            try:
                result = request('/api/admin/events', {'sourceId': source['id']})
                actions.append({'source': source['id'], 'processed': result.get('sourcesProcessed')})
            except Exception as exc:
                errors.append({'source': source['id'], 'error': type(exc).__name__, 'outcome': 'uncertain; read back before any retry'})
                break
    after = health('after') if actions or errors else before
except Exception as exc:
    errors.append({'error': type(exc).__name__, 'message': str(exc)[:160]})
finally:
    try:
        request('/api/admin/lock', {})
    except Exception:
        errors.append({'error': 'logout_failed'})

old = {s['id']: s for s in before.get('sources', [])}
changes = [{'id': s['id'], 'before': old[s['id']]['status'], 'after': s['status'],
    'lastError': s.get('lastError'), 'nextCheckAt': s.get('nextCheckAt')}
    for s in after.get('sources', []) if s['id'] in old
    and any(s.get(k) != old[s['id']].get(k) for k in ('status', 'lastError', 'nextCheckAt'))]
summary = {'ok': not errors, 'mode': 'bounded_refresh' if args.refresh_due else 'read_only',
    'sources': len(after.get('sources', [])),
    'statuses': dict(collections.Counter(s['status'] for s in after.get('sources', []))),
    'retryable_due': [s['id'] for s in after.get('sources', []) if retryable(s)],
    'actions': actions, 'changes': changes, 'errors': errors,
    'requests': calls, 'seconds': round(time.perf_counter() - started, 3), 'ai_calls': 0}
(out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(summary, ensure_ascii=False, separators=(',', ':')))
raise SystemExit(0 if summary['ok'] else 1)
