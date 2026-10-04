"""Generate the iOS and Android app icons (and the Android launch splash) from one square source.

    python scripts/make-app-icons.py <source-1024.png|webp>

The source is Casey on a white field. iOS takes it as-is (Apple masks the corners itself).
Android's adaptive icon is masked by the launcher, often to a circle, so the suitcase is scaled
until the farthest point of its outline sits inside the 66 dp safe circle of the 108 dp layer.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
IOS_ICON = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
WHITE = (255, 255, 255, 255)


def content_box(im):
    """Bounding box of everything that is not the white field."""
    rgb = im.convert("RGB")
    mask = rgb.point(lambda v: 255 if v < 235 else 0).convert("L")
    # a pixel counts when any channel is darker than the field
    r, g, b = [c.point(lambda v: 255 if v < 235 else 0) for c in rgb.split()]
    from PIL import ImageChops
    return ImageChops.lighter(ImageChops.lighter(r, g), b).getbbox() or mask.getbbox()


def farthest_radius(im, box):
    """Distance from the content's centre to its farthest non-white pixel, in source px."""
    rgb = im.convert("RGB").resize((256, 256))
    k = im.width / 256
    cx, cy = (box[0] + box[2]) / 2 / k, (box[1] + box[3]) / 2 / k
    best = 0.0
    px = rgb.load()
    for y in range(256):
        for x in range(256):
            if min(px[x, y]) < 235:
                best = max(best, ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5)
    return best * k + k  # one sample of slack


def placed(src, box, canvas_px, content_diameter_px, bg=None):
    """src scaled so its content's farthest radius spans content_diameter_px/2, centred on canvas."""
    radius = farthest_radius(src, box)
    scale = (content_diameter_px / 2) / radius
    size = max(1, round(src.width * scale))
    art = src.convert("RGBA").resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_px, canvas_px), bg or (0, 0, 0, 0))
    cx, cy = (box[0] + box[2]) / 2 * scale, (box[1] + box[3]) / 2 * scale
    canvas.alpha_composite(art, (round(canvas_px / 2 - cx), round(canvas_px / 2 - cy)))
    return canvas


def main(source):
    src = Image.open(source).convert("RGB")
    assert src.size[0] == src.size[1], "source must be square"
    box = content_box(src)

    # iOS: one 1024 icon, opaque RGB (App Store Connect rejects an alpha channel).
    src.resize((1024, 1024), Image.LANCZOS).save(IOS_ICON)

    if not RES.exists():
        print("no android/ project here; iOS icon written from", source)
        return
    for name, d in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        layer = round(108 * d)
        # Adaptive foreground: content inside the 66 dp safe circle; the white background
        # layer is @color/ic_launcher_background.
        placed(src, box, layer, 66 * d).save(folder / "ic_launcher_foreground.png")
        # Legacy (Android 7.x): a white rounded square and a white circle. The source's own
        # white field would square off the shape, so the shape is applied as the alpha last.
        legacy = round(48 * d)
        for filename, draw_shape in (
            ("ic_launcher.png", lambda dr: dr.rounded_rectangle((0, 0, legacy - 1, legacy - 1), radius=round(9 * d), fill=255)),
            ("ic_launcher_round.png", lambda dr: dr.ellipse((0, 0, legacy - 1, legacy - 1), fill=255)),
        ):
            icon = Image.new("RGBA", (legacy, legacy), WHITE)
            icon.alpha_composite(placed(src, box, legacy, 44 * d))
            shape = Image.new("L", (legacy, legacy), 0)
            draw_shape(ImageDraw.Draw(shape))
            icon.putalpha(shape)
            icon.save(folder / filename)

    # Launch splash (the theme's background before the web view paints): Casey centred on white.
    for splash in RES.glob("drawable*/splash.png"):
        w, h = Image.open(splash).size
        canvas = Image.new("RGB", (w, h), (255, 255, 255))
        side = round(min(w, h) * 0.6)
        art = placed(src, box, side, side * 0.95)
        canvas.paste(art, ((w - side) // 2, (h - side) // 2), art)
        canvas.save(splash)
    print("icons written from", source, "content box", box)


if __name__ == "__main__":
    main(sys.argv[1])
