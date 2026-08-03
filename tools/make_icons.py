# 生成 PWA 图标（深底 + 双球 VS 风格）
from PIL import Image, ImageDraw
import os

os.makedirs('icons', exist_ok=True)

def make_icon(size):
    img = Image.new('RGBA', (size, size), (4, 7, 15, 255))
    d = ImageDraw.Draw(img)
    s = size
    # 网格线
    for g in range(0, s + 1, s // 8):
        d.line([(g, 0), (g, s)], fill=(0, 229, 255, 18), width=1)
        d.line([(0, g), (s, g)], fill=(0, 229, 255, 18), width=1)
    # 左球（青）
    c1 = s * 0.32
    for r in range(int(s * 0.16), 0, -1):
        a = int(200 * (1 - r / (s * 0.16)))
        d.ellipse([c1 - r, s * 0.5 - r, c1 + r, s * 0.5 + r], fill=(0, 229, 255, a))
    d.ellipse([c1 - s * 0.16, s * 0.5 - s * 0.16, c1 + s * 0.16, s * 0.5 + s * 0.16], fill=(0, 229, 255, 255))
    d.ellipse([c1 - s * 0.05, s * 0.5 - s * 0.05, c1 + s * 0.05, s * 0.5 + s * 0.05], fill=(255, 255, 255, 255))
    # 右球（品红）
    c2 = s * 0.68
    for r in range(int(s * 0.16), 0, -1):
        a = int(200 * (1 - r / (s * 0.16)))
        d.ellipse([c2 - r, s * 0.5 - r, c2 + r, s * 0.5 + r], fill=(255, 45, 120, a))
    d.ellipse([c2 - s * 0.16, s * 0.5 - s * 0.16, c2 + s * 0.16, s * 0.5 + s * 0.16], fill=(255, 45, 120, 255))
    d.ellipse([c2 - s * 0.05, s * 0.5 - s * 0.05, c2 + s * 0.05, s * 0.5 + s * 0.05], fill=(255, 255, 255, 255))
    # 光环
    d.arc([s * 0.06, s * 0.06, s * 0.94, s * 0.94], 0, 360, fill=(0, 229, 255, 120), width=max(2, s // 32))
    d.arc([s * 0.1, s * 0.1, s * 0.9, s * 0.9], 90, 270, fill=(255, 45, 120, 120), width=max(2, s // 32))
    # 角标
    for (x, y, col) in [(0.02, 0.02, (0, 229, 255)), (0.98, 0.98, (255, 45, 120))]:
        d.line([(s * x, s * y), (s * x + s * 0.12, s * y)], fill=col, width=max(2, s // 24))
        d.line([(s * x, s * y), (s * x, s * y + s * 0.12)], fill=col, width=max(2, s // 24))
    img.save(f'icons/icon-{size}.png')
    print(f'icon-{size}.png 生成')

make_icon(192)
make_icon(512)
