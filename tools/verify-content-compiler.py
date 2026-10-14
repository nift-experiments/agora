#!/usr/bin/env python3
"""Bounded nested-include incremental/forced equivalence probe; always restore source bytes."""
import hashlib, json, os, subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = root / 'app'
compiler = root / 'tools/compile-content.ts'
pages = ['en/introduction/account.mdx', 'en/api-reference/api-ref/cloud-recording/authentication.mdx']
included = app / 'content/includes/en/shared/console/sign-up.mdx'
original = included.read_bytes()
def run(force=False):
    result = subprocess.run([os.environ.get('BUN', str(Path.home()/'.bun/bin/bun')), str(compiler), *(['--force'] if force else []), '--only', *pages], cwd=root, check=True, capture_output=True, text=True)
    return json.loads(result.stdout.strip().splitlines()[-1])
def artifacts():
    return {name: json.loads((app/'public/__nift'/name).read_text()) for name in ['content-manifest.json','content-metadata.json']}
run()
baseline = artifacts()
observations = {}
try:
    included.write_bytes(original + b'\n\nNift compiler dependency verification paragraph.\n')
    observations['incremental'] = run()
    changed = artifacts()
    assert observations['incremental']['compiled'] == 1, observations
    for name in changed:
        assert changed[name][pages[0]] != baseline[name][pages[0]], name
        assert changed[name][pages[1]] == baseline[name][pages[1]], name
    observations['forced'] = run(True)
    assert artifacts() == changed, 'Incremental and forced results differ'
finally:
    included.write_bytes(original)
    observations['restored'] = run()
assert hashlib.sha256(included.read_bytes()).digest() == hashlib.sha256(original).digest()
assert artifacts() == baseline, 'Restored source does not reproduce baseline artifacts'
print(json.dumps({'nestedIncludeInvalidation': True, 'unchangedSiblingPreserved': True, 'forcedEquivalence': True, 'sourceBytesRestored': True, 'runs': observations}, indent=2))
