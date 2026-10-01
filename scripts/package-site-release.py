#!/usr/bin/env python3
"""Package an existing Sites build: python3 scripts/package-site-release.py OUTPUT.tar.gz.
Requires a successful build and clean tracked files. Excludes untracked public
assets, preserves long paths, and checks every archived path and file byte.
"""
import json
import pathlib
import subprocess
import sys
import tarfile

root = pathlib.Path(__file__).resolve().parents[1]
archive = pathlib.Path(sys.argv[1]).resolve()
if subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=root, text=True).strip():
    raise SystemExit('Commit tracked changes before packaging.')
if not (root / 'dist/server/index.js').is_file():
    raise SystemExit('Run npm run build before packaging.')
tracked = set(subprocess.check_output(['git', 'ls-files', 'public'], cwd=root, text=True).splitlines())
expected = {'.openai/hosting.json'}
archive.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(archive, 'w:gz') as bundle:
    bundle.add(root / '.openai/hosting.json', arcname='.openai/hosting.json', recursive=False)
    for path in sorted((root / 'dist').rglob('*')):
        if path.is_dir():
            continue
        relative = path.relative_to(root / 'dist')
        if relative.parts[0] == 'client':
            source = 'public/' + str(pathlib.Path(*relative.parts[1:]))
            if (root / source).is_file() and source not in tracked:
                continue
        name = 'dist/' + str(relative)
        bundle.add(path, arcname=name, recursive=False)
        expected.add(name)
with tarfile.open(archive) as bundle:
    if {item.name for item in bundle} != expected:
        raise SystemExit('Archive paths differ from the build.')
    for item in bundle.getmembers():
        if item.isfile() and bundle.extractfile(item).read() != (root / item.name).read_bytes():
            raise SystemExit('Archive content differs from the build: ' + item.name)
print(json.dumps({'archive': str(archive), 'files': len(expected), 'verified': True}))
