# -*- coding: utf-8 -*-
"""比对拆分前后 JS 内容：git 版单文件 script vs 拼接后的 js/ 模块（忽略空行与文件头注释差异）。"""
import re, subprocess, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 1. 取 git HEAD 版本的单文件 script
old = subprocess.run(['git', 'show', 'HEAD:index.html'], capture_output=True, text=True, encoding='utf-8', cwd=ROOT).stdout
m = re.search(r'<script>(.*?)</script>', old, re.S)
assert m, 'git 版未找到 <script>'
old_js = m.group(1)

# 2. 拼接当前 js/ 模块（按 index.html 中引用顺序）
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
order = re.findall(r'<script src="js/(\w+)\.js"></script>', html)
parts = []
for name in order:
    p = os.path.join(ROOT, 'js', name + '.js')
    parts.append(open(p, encoding='utf-8').read())
new_js = '\n'.join(parts)

def norm(s):
    # 去空行、去行首尾空白、跳过块注释（文件头）与 'use strict'（允许差异）
    lines = [ln.strip() for ln in s.split('\n') if ln.strip()]
    out = []
    in_block = False
    for ln in lines:
        if in_block:
            if '*/' in ln:
                in_block = False
            continue
        if ln.startswith('/*'):
            if '*/' not in ln:
                in_block = True
            continue
        if ln == "'use strict';" or ln.startswith('// ===='):
            continue
        out.append(ln)
    return out

a, b = norm(old_js), norm(new_js)
print('git 版行数:', len(a), '| 拼接后行数:', len(b))
# 模块重组会改变行序，用行多重集合比较（每行内容与出现次数一致 = 无逻辑丢失）
from collections import Counter
ca, cb = Counter(a), Counter(b)
if ca == cb:
    print('RESULT: 行多重集合完全一致，无逻辑丢失（仅模块顺序重组）')
    sys.exit(0)
diff = ca - cb
extra = cb - ca
print(f'git 独有行: {sum(diff.values())} 条 | 拼接独有行: {sum(extra.values())} 条')
for ln, n in list(diff.items())[:8]:
    print('  git独有:', repr(ln[:100]), 'x', n)
for ln, n in list(extra.items())[:8]:
    print('  拼接独有:', repr(ln[:100]), 'x', n)
sys.exit(1)
