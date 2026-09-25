from PIL import Image, ImageDraw
def make(size, path, pad=0.0):
    S = size*4
    img = Image.new("RGB", (S, S))
    px = img.load()
    c1, c2 = (99, 102, 241), (236, 72, 153)  # indigo -> pink
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2*S)
            px[x, y] = tuple(int(c1[i]*(1-t) + c2[i]*t) for i in range(3))
    d = ImageDraw.Draw(img)
    cx = S/2
    bw, bh = S*0.44, S*0.34
    bx0, by0 = cx-bw/2, S*0.46
    # shackle
    sw = S*0.07
    sr = S*0.15
    d.arc([cx-sr, by0-sr*1.9, cx+sr, by0+sr*0.1], 180, 360, fill="white", width=int(sw))
    d.rectangle([cx-sr, by0-sr*0.9, cx-sr+sw, by0+5], fill="white")
    d.rectangle([cx+sr-sw, by0-sr*0.9, cx+sr, by0+5], fill="white")
    # body
    d.rounded_rectangle([bx0, by0, bx0+bw, by0+bh], radius=S*0.05, fill="white")
    # keyhole
    kr = S*0.035
    ky = by0 + bh*0.42
    d.ellipse([cx-kr, ky-kr, cx+kr, ky+kr], fill=c1)
    d.polygon([(cx-kr*0.55, ky), (cx+kr*0.55, ky), (cx+kr*0.9, ky+bh*0.33), (cx-kr*0.9, ky+bh*0.33)], fill=c1)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
make(192, "icons/icon-192.png")
make(512, "icons/icon-512.png")
make(180, "icons/apple-touch-icon.png")
make(32, "icons/favicon-32.png")
