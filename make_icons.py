"""Generate LockShell icons: a blue lock on a white background (matches the white iOS design)."""
from PIL import Image, ImageDraw

BLUE = (0, 122, 255)
BLUE2 = (64, 156, 255)

def make(size, path, maskable=False, rounded=False):
    S = size * 4
    img = Image.new("RGBA", (S, S), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    # very soft gray vignette ring for depth
    scale = 0.78 if maskable else 1.0
    cx, cy = S / 2, S / 2 + S * 0.02 * scale
    bw, bh = S * 0.46 * scale, S * 0.36 * scale
    bx0, by0 = cx - bw / 2, cy - bh * 0.18
    # shackle
    sw = S * 0.075 * scale
    sr = S * 0.15 * scale
    top = by0 - sr * 1.55
    d.rounded_rectangle([cx - sr - sw / 2, top, cx + sr + sw / 2, by0 + sw], radius=sr + sw / 2, outline=BLUE, width=int(sw))
    # body with subtle vertical gradient
    body = Image.new("RGBA", (int(bw), int(bh)), BLUE)
    bd = ImageDraw.Draw(body)
    for y in range(int(bh)):
        t = y / bh
        c = tuple(int(BLUE2[i] * (1 - t) + BLUE[i] * t) for i in range(3)) + (255,)
        bd.line([(0, y), (bw, y)], fill=c)
    mask = Image.new("L", body.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=S * 0.06 * scale, fill=255)
    img.paste(body, (int(bx0), int(by0)), mask)
    # keyhole
    kr = S * 0.038 * scale
    ky = by0 + bh * 0.42
    d.ellipse([cx - kr, ky - kr, cx + kr, ky + kr], fill="white")
    d.polygon([(cx - kr * 0.5, ky), (cx + kr * 0.5, ky), (cx + kr * 0.8, ky + bh * 0.3), (cx - kr * 0.8, ky + bh * 0.3)], fill="white")
    img = img.resize((size, size), Image.LANCZOS)
    if rounded:
        m = Image.new("L", (size * 4, size * 4), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=size * 4 * 0.22, fill=255)
        img.putalpha(m.resize((size, size), Image.LANCZOS))
    else:
        img = img.convert("RGB")
    img.save(path, optimize=True)

make(192, "icons/icon-192.png")
make(512, "icons/icon-512.png")
make(512, "icons/icon-maskable-512.png", maskable=True)
make(180, "icons/apple-touch-icon.png")  # iOS rounds corners itself; keep opaque square
make(32, "icons/favicon-32.png", rounded=True)
print("icons written")
