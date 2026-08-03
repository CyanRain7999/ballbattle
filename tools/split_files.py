# -*- coding: utf-8 -*-
"""将单文件 index.html 拆分为 css/style.css + js/ 模块（普通 script 标签按序加载，兼容 file://）。"""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'index.html')

html = open(SRC, encoding='utf-8').read()

# ---------- 1. 提取 CSS ----------
m = re.search(r'<style>(.*?)</style>', html, re.S)
assert m, '未找到 <style> 块'
css = m.group(1)
os.makedirs(os.path.join(ROOT, 'css'), exist_ok=True)
open(os.path.join(ROOT, 'css', 'style.css'), 'w', encoding='utf-8').write(css)
print('css/style.css', len(css), 'chars')

# ---------- 2. 提取 JS 并按注释标记切分 ----------
m = re.search(r'<script>(.*?)</script>', html, re.S)
assert m, '未找到 <script> 块'
js = m.group(1)
lines = js.split('\n')

# 标记 → 模块
MARK_MOD = {
    '工具': 'core',
    '数据': 'data',
    '音效': 'audio',
    '状态': 'core',
    '屏幕管理': 'core',
    '选择屏': 'select',
    '选择屏星尘粒子背景': 'select',
    '装饰绘制': 'draw',
    '球绘制（精美 2D 平面风格）': 'draw',
    '战斗': 'core',      # 特殊：头部（battleCanvas/bctx）归 core
    '多球辅助（V8：支持 2/3/4 球）': 'core',  # 特殊：前段(辅助函数/fieldRect/resizeCanvas)归 core，makeOrb 起归 battle
    '能力': 'battle',
    '特效': 'effects',
    '场景实体（新能力系统）': 'entities',
    '战斗更新': 'battle',
    '能力底纹（球体底层按能力区分）': 'draw',
    '场景实体绘制': 'draw',
    '战斗绘制': 'draw',
    'HUD': 'hud',
    '转场': 'ui',
    '结算': 'ui',
    '主循环': 'ui',
    '事件': 'ui',
    '启动': 'ui',
}

# 找到每个标记的行号
marks = []
for i, ln in enumerate(lines):
    mm = re.match(r'// ---------------- (.+?) ----------------', ln.strip())
    if mm and mm.group(1) in MARK_MOD:
        marks.append((i, mm.group(1)))

assert len(marks) == len(MARK_MOD), f'标记数量不符: {len(marks)} vs {len(MARK_MOD)}'

mods = {k: [] for k in set(MARK_MOD.values())}
# 切段：标记行(含) → 下一标记行(不含)
for idx, (line_no, title) in enumerate(marks):
    end = marks[idx + 1][0] if idx + 1 < len(marks) else len(lines)
    seg = lines[line_no:end]
    mod = MARK_MOD[title]
    if title == '战斗':
        # 只有注释 + battleCanvas/bctx 两行
        mods['core'].extend(seg)
    elif title == '多球辅助（V8：支持 2/3/4 球）':
        text = '\n'.join(seg)
        pos = text.find('function makeOrb(')
        assert pos > 0, '未找到 makeOrb 切分点'
        mods['core'].append(text[:pos])
        mods['battle'].append(text[pos:])
    else:
        mods[mod].append('\n'.join(seg))

# ---------- 3. 写出模块文件 ----------
jsdir = os.path.join(ROOT, 'js')
os.makedirs(jsdir, exist_ok=True)
# 加载顺序：core → draw → data（draw 先于 data，因 data.DECORS 引用 draw 的绘制函数）→ audio → effects → select → battle → entities → hud → ui
order = ['core', 'draw', 'data', 'audio', 'effects', 'select', 'battle', 'entities', 'hud', 'ui']
total = 0
for name in order:
    body = '\n'.join(mods[name]).strip('\n') + '\n'
    if name == 'core':
        body = "'use strict';\n\n" + body
    path = os.path.join(jsdir, name + '.js')
    open(path, 'w', encoding='utf-8').write(body)
    total += len(body)
    print(f'js/{name}.js', len(body), 'chars')

# ---------- 4. 重写 index.html：CSS → link，内联 script → 外链 ----------
scripts = '\n'.join(f'  <script src="js/{n}.js"></script>' for n in order)
html2 = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="css/style.css">', html, count=1, flags=re.S)
html2 = re.sub(r'<script>.*?</script>', scripts, html2, count=1, flags=re.S)
open(SRC, 'w', encoding='utf-8').write(html2)
print('index.html rewritten,', len(html2), 'chars (was', len(html), ')')
print('JS total:', total, 'chars')
