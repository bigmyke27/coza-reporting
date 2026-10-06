#!/usr/bin/env python3
"""Stamp every CSS/JS reference with a fresh ?v= so browsers load the newest
files after each deploy (GitHub Pages lets browsers cache files for 10 minutes).
Run before committing:  python3 tools/bump-version.py"""
import re, time, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
v = time.strftime('%Y%m%d%H%M')

html = root / 'index.html'
s = html.read_text()
s = re.sub(r'(css/app\.css|js/app\.js)(\?v=\w+)?', rf'\1?v={v}', s)
html.write_text(s)

for f in (root / 'js').glob('*.js'):
    s = f.read_text()
    f.write_text(re.sub(r"(from '\./[\w-]+\.js)(\?v=\w+)?'", rf"\1?v={v}'", s))

print('version', v)
