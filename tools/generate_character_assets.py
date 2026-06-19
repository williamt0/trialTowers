#!/usr/bin/env python3
"""Generate non-hero character sprites for the Electron build.

The game loads static PNGs from web/assets and animation frames from
web/assets/anim. This script intentionally never writes hero_* files.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "web" / "assets"
ANIM = ASSETS / "anim"
PREVIEW = ASSETS / "character_asset_preview.png"
MANIFEST = ASSETS / "character_asset_manifest.json"

OUTLINE = (14, 12, 22, 235)
INK = (28, 27, 36, 255)
HILITE = (245, 248, 255, 90)
SKIN = (226, 186, 146, 255)
GOLD = (236, 195, 86, 255)
STEEL = (137, 152, 178, 255)


def rgba(c, a=255):
    return (int(c[0]), int(c[1]), int(c[2]), int(a))


def shade(c, amt):
    c = c[:3]
    if amt >= 0:
        return tuple(int(v + (255 - v) * amt) for v in c)
    return tuple(max(0, int(v * (1 + amt))) for v in c)


def mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


class SpriteCanvas:
    def __init__(self, size=256, aa=3):
        self.size = size
        self.aa = aa
        self.k = size / 256
        self.img = Image.new("RGBA", (size * aa, size * aa), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img, "RGBA")

    def p(self, x, y):
        return (int(round(x * self.k * self.aa)), int(round(y * self.k * self.aa)))

    def box(self, cx, cy, rx, ry):
        x0, y0 = self.p(cx - rx, cy - ry)
        x1, y1 = self.p(cx + rx, cy + ry)
        return (x0, y0, x1, y1)

    def sw(self, w):
        return max(1, int(round(w * self.k * self.aa)))

    def ellipse(self, cx, cy, rx, ry, fill, outline=OUTLINE, width=4):
        box = self.box(cx, cy, rx, ry)
        if outline:
            self.d.ellipse(box, fill=outline)
            inset = self.sw(width)
            box = (box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset)
        self.d.ellipse(box, fill=fill)

    def rect(self, x0, y0, x1, y1, fill, outline=None, width=3, radius=0):
        a = self.p(x0, y0)
        b = self.p(x1, y1)
        box = (a[0], a[1], b[0], b[1])
        if radius:
            self.d.rounded_rectangle(box, radius=self.sw(radius), fill=fill, outline=outline, width=self.sw(width) if outline else 1)
        else:
            self.d.rectangle(box, fill=fill, outline=outline, width=self.sw(width) if outline else 1)

    def poly(self, pts, fill, outline=OUTLINE, width=4):
        p = [self.p(x, y) for x, y in pts]
        if outline:
            self.d.polygon(p, fill=outline)
            cx = sum(x for x, _ in pts) / len(pts)
            cy = sum(y for _, y in pts) / len(pts)
            shrink = []
            for x, y in pts:
                shrink.append((cx + (x - cx) * 0.91, cy + (y - cy) * 0.91))
            p = [self.p(x, y) for x, y in shrink]
        self.d.polygon(p, fill=fill)
        if outline and width:
            self.d.line(p + [p[0]], fill=outline, width=self.sw(max(1, width * 0.35)), joint="curve")

    def line(self, pts, fill, width=4):
        self.d.line([self.p(x, y) for x, y in pts], fill=fill, width=self.sw(width), joint="curve")

    def glow(self, cx, cy, rx, ry, color, alpha=70, blur=10):
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer, "RGBA")
        ld.ellipse(self.box(cx, cy, rx, ry), fill=rgba(color, alpha))
        layer = layer.filter(ImageFilter.GaussianBlur(self.sw(blur)))
        self.img.alpha_composite(layer)

    def shine(self, cx, cy, rx, ry, alpha=55):
        self.ellipse(cx - rx * 0.22, cy - ry * 0.34, rx * 0.42, ry * 0.28, (255, 255, 255, alpha), outline=None)

    def finish(self):
        return self.img.resize((self.size, self.size), Image.Resampling.LANCZOS)


def draw_shadow(c, cx=128, cy=184, w=84, h=18):
    c.glow(cx, cy, w, h, (0, 0, 8), 115, 8)


def eyes(c, x, y, scale=1, glow=False):
    fill = (245, 250, 255, 245) if not glow else (150, 255, 235, 255)
    pupil = (20, 25, 36, 255) if not glow else (255, 255, 255, 230)
    c.ellipse(x - 9 * scale, y, 5 * scale, 6 * scale, fill, outline=None)
    c.ellipse(x + 9 * scale, y, 5 * scale, 6 * scale, fill, outline=None)
    c.ellipse(x - 7 * scale, y + 1 * scale, 2.3 * scale, 3 * scale, pupil, outline=None)
    c.ellipse(x + 11 * scale, y + 1 * scale, 2.3 * scale, 3 * scale, pupil, outline=None)


def crown(c, x, y, scale=1):
    c.poly(
        [
            (x - 22 * scale, y + 8 * scale),
            (x - 18 * scale, y - 16 * scale),
            (x - 8 * scale, y - 2 * scale),
            (x, y - 22 * scale),
            (x + 9 * scale, y - 2 * scale),
            (x + 20 * scale, y - 16 * scale),
            (x + 22 * scale, y + 8 * scale),
        ],
        GOLD,
        width=3,
    )


NPCS = {
    "sage": ((110, 164, 230), "sage"),
    "merchant": ((224, 184, 76), "merchant"),
    "healer": ((112, 220, 142), "healer"),
    "smith": ((203, 119, 72), "smith"),
    "quester": ((255, 178, 72), "banner"),
    "guard": ((148, 166, 206), "guard"),
    "scholar": ((192, 174, 245), "scholar"),
    "cook": ((238, 160, 108), "cook"),
    "gambler": ((213, 128, 194), "cards"),
    "bard": ((135, 214, 214), "instrument"),
    "monk": ((174, 194, 150), "beads"),
    "child": ((242, 184, 96), "child"),
    "innkeep": ((220, 166, 105), "mug"),
    "enchanter": ((184, 140, 245), "mage"),
    "fisher": ((130, 188, 218), "rod"),
    "arenamaster": ((224, 126, 76), "plume"),
    "watchman": ((162, 176, 212), "watch"),
    "priest": ((231, 219, 190), "priest"),
    "storyteller": ((205, 165, 130), "book"),
    "caravaneer": ((214, 178, 92), "pack"),
    "courier": ((142, 215, 176), "satchel"),
    "miner": ((174, 150, 120), "pick"),
    "tavernkeep": ((220, 158, 94), "mug"),
    "hermit": ((150, 164, 150), "hood"),
    "crier": ((235, 198, 88), "bell"),
    "drunkard": ((200, 150, 105), "bottle"),
    "busker": ((138, 220, 206), "instrument"),
    "seer": ((200, 126, 230), "orb"),
    "lamplighter": ((180, 174, 135), "lamp"),
    "gravedigger": ((142, 142, 134), "shovel"),
    "fishmonger": ((134, 188, 208), "fish"),
    "herbalist": ((160, 210, 142), "herb"),
    "taxman": ((208, 182, 94), "ledger"),
    "dancer": ((235, 140, 195), "ribbons"),
    "acolyte": ((224, 222, 198), "acolyte"),
    "ratcatcher": ((164, 150, 124), "net"),
    "errant": ((178, 190, 218), "errant"),
    "washer": ((190, 184, 202), "cloth"),
    "farmer": ((190, 205, 118), "hat"),
    "quartermaster": ((212, 176, 106), "pack"),
    "bountymaster": ((205, 112, 88), "guard"),
    "magistrate": ((180, 150, 210), "judge"),
    "ranger": ((142, 178, 135), "bow"),
    "pilgrimkeeper": ((222, 222, 200), "priest"),
    "mythic": ((168, 112, 220), "orb"),
    "fixer": ((206, 164, 82), "cards"),
    "informant": ((132, 205, 220), "satchel"),
    "pedlar": ((214, 182, 124), "pack"),
    "shepherd": ((195, 206, 168), "staff"),
    "climber": ((168, 190, 224), "pack"),
    "villager": ((180, 180, 190), "plain"),
    "peasant": ((178, 166, 132), "hat"),
    "noble": ((226, 194, 108), "noble"),
    "beggar": ((142, 138, 130), "hood"),
    "pilgrim": ((216, 216, 235), "priest"),
    "laborer": ((176, 138, 106), "pick"),
    "urchin": ((212, 184, 142), "child"),
}


MOBS = {
    "slime": ("slime", (104, 220, 110), "plain"),
    "darter": ("bug", (232, 88, 150), "dart"),
    "spitter": ("frog", (235, 142, 58), "spit"),
    "bomber": ("imp", (210, 72, 58), "bomb"),
    "nest": ("nest", (74, 56, 68), "plain"),
    "splitter": ("slime", (150, 235, 116), "mimic"),
    "froster": ("ghost", (145, 215, 255), "ice"),
    "wisp": ("spirit", (180, 170, 255), "spark"),
    "lurker": ("beast", (78, 210, 200), "stealth"),
    "sentinel": ("knight", (230, 200, 110), "tower"),
    "bloodbat": ("bat", (232, 82, 105), "blood"),
    "seraphling": ("mage", (255, 236, 160), "halo"),
    "voidling": ("imp", (190, 115, 255), "void"),
    "vinesnap": ("plant", (86, 200, 82), "vine"),
    "prowler": ("beast", (66, 165, 96), "cat"),
    "dartfrog": ("frog", (238, 176, 54), "poison"),
    "stinger": ("bug", (218, 196, 82), "stinger"),
    "silverback": ("beast", (166, 166, 178), "ape"),
    "legion": ("knight", (146, 166, 220), "spear"),
    "arbalist": ("knight", (118, 138, 200), "crossbow"),
    "warhound": ("beast", (150, 120, 92), "hound"),
    "packwolf": ("beast", (184, 132, 84), "wolf"),
    "bruiser": ("beast", (205, 118, 70), "tusk"),
    "spearhunt": ("beast", (215, 160, 82), "spear"),
    "wardenE": ("elf", (136, 220, 126), "warden"),
    "dancer": ("elf", (174, 230, 150), "blade"),
    "treant": ("plant", (106, 168, 88), "tree"),
    "impling": ("imp", (224, 108, 158), "small"),
    "hexcaster": ("mage", (192, 92, 204), "hex"),
    "brute": ("imp", (172, 78, 122), "brute"),
    "bombfiend": ("imp", (230, 88, 80), "bomb"),
    "swordsman": ("knight", (234, 218, 166), "sword"),
    "arcanist": ("mage", (184, 150, 255), "arcane"),
    "thrall": ("bat", (220, 88, 100), "thrall"),
    "spiritling": ("spirit", (172, 232, 255), "spirit"),
    "drakeling": ("dragon", (234, 146, 62), "small"),
    "felguard": ("imp", (182, 108, 255), "guard"),
    "shade": ("ghost", (146, 198, 232), "shade"),
    "echoarcher": ("ghost", (132, 182, 224), "bow"),
    "seraph": ("spirit", (255, 232, 164), "seraph"),
    "templar": ("knight", (238, 218, 150), "templar"),
    "magmite": ("imp", (255, 120, 40), "lava"),
    "cinderdart": ("bug", (255, 156, 56), "ember"),
    "pyrecaster": ("mage", (255, 136, 68), "fire"),
    "emberhound": ("beast", (240, 106, 48), "hound"),
    "slagbrute": ("beast", (255, 86, 30), "lava"),
    "sporeling": ("plant", (160, 210, 95), "spore"),
    "hound": ("beast", (150, 120, 92), "hound"),
    "general": ("knight", (156, 92, 255), "general"),
}


CHAMPS = {
    "champ_1": ("bat", (220, 70, 92), "count"),
    "champ_2": ("spirit", (255, 220, 112), "aurelia"),
    "champ_3": ("dragon", (240, 112, 70), "vermithrax"),
    "champ_4": ("imp", (170, 88, 255), "malgoth"),
}


BOSSES = {
    "boss_f1": ("beast", (150, 210, 120), "trial"),
    "boss_f2": ("plant", (110, 205, 90), "jungle"),
    "boss_f3": ("knight", (120, 170, 235), "emperor"),
    "boss_f4": ("beast", (235, 150, 60), "warlord"),
    "boss_f5": ("elf", (120, 210, 110), "queen"),
    "boss_f6": ("imp", (200, 90, 160), "duke"),
    "boss_f7": ("knight", (245, 225, 150), "swordmaster"),
    "boss_f7m": ("mage", (190, 150, 255), "matriarch"),
    "boss_f8": ("dragon", (180, 110, 255), "court"),
    "boss_f9": ("ghost", (150, 215, 255), "echo"),
    "boss_f10": ("imp", (255, 120, 40), "molten"),
    "boss_f11": ("spirit", (255, 235, 170), "crown"),
}


def pose_for(state, i, frames):
    t = 0 if frames <= 1 else i / frames
    a = math.sin(t * math.tau)
    b = math.cos(t * math.tau)
    if state == "walk":
        return {"bob": -7 * abs(a), "sway": 5 * a, "step": a, "tilt": 0.08 * a, "attack": 0}
    if state == "attack":
        p = i / max(1, frames - 1)
        swing = math.sin(p * math.pi)
        return {"bob": -3 * swing, "sway": 12 * swing, "step": swing, "tilt": -0.12 + 0.24 * p, "attack": swing}
    return {"bob": 2.5 * a, "sway": 1.6 * b, "step": 0.25 * a, "tilt": 0.025 * a, "attack": 0}


def draw_folk(c, key, color, gear, pose, big=False):
    col = color
    cx = 128 + pose["sway"] * 0.35
    cy = 132 + pose["bob"]
    scale = 1.22 if big else (0.75 if gear == "child" else 1)
    draw_shadow(c, cx, 184 + (scale - 1) * 8, 52 * scale, 12 * scale)

    # Legs and shoes
    step = pose["step"]
    for side in (-1, 1):
        lx = cx + side * (12 + 3 * step * side) * scale
        c.line([(lx, cy + 42 * scale), (lx + side * 4 * step, cy + 66 * scale)], shade(col, -0.45) + (255,), width=8 * scale)
        c.ellipse(lx + side * 5, cy + 70 * scale, 9 * scale, 5 * scale, shade(col, -0.65) + (255,), outline=None)

    # Robe/tunic
    c.poly(
        [
            (cx - 34 * scale, cy + 52 * scale),
            (cx - 22 * scale, cy - 14 * scale),
            (cx + 24 * scale, cy - 14 * scale),
            (cx + 38 * scale, cy + 52 * scale),
            (cx + 22 * scale, cy + 66 * scale),
            (cx - 24 * scale, cy + 66 * scale),
        ],
        shade(col, -0.03) + (255,),
    )
    c.rect(cx - 24 * scale, cy + 20 * scale, cx + 28 * scale, cy + 29 * scale, shade(col, -0.5) + (255,), radius=2)
    c.ellipse(cx - 7 * scale, cy + 23 * scale, 4 * scale, 4 * scale, GOLD, outline=None)

    # Arms
    c.line([(cx - 24 * scale, cy), (cx - 45 * scale, cy + 30 * scale)], shade(col, -0.18) + (255,), width=10 * scale)
    c.line([(cx + 24 * scale, cy), (cx + 46 * scale + pose["attack"] * 18, cy + 28 * scale - pose["attack"] * 16)], shade(col, -0.16) + (255,), width=10 * scale)
    c.ellipse(cx - 47 * scale, cy + 32 * scale, 6 * scale, 6 * scale, SKIN, outline=None)
    c.ellipse(cx + 48 * scale + pose["attack"] * 18, cy + 30 * scale - pose["attack"] * 16, 6 * scale, 6 * scale, SKIN, outline=None)

    # Head and hair/hat
    c.ellipse(cx, cy - 37 * scale, 23 * scale, 24 * scale, SKIN)
    seed = sum((i + 1) * ord(ch) for i, ch in enumerate(key))
    hair = shade((80, 58, 40), (seed % 5) * 0.06)
    c.ellipse(cx, cy - 50 * scale, 25 * scale, 14 * scale, hair + (255,), outline=None)
    eyes(c, cx, cy - 38 * scale, 0.75 * scale)

    # Profession silhouette.
    if gear in {"guard", "watch", "errant", "plume"}:
        c.ellipse(cx, cy - 54 * scale, 25 * scale, 13 * scale, STEEL, outline=OUTLINE, width=3)
        if gear in {"guard", "errant", "plume"}:
            c.line([(cx + 48 * scale, cy + 56 * scale), (cx + 58 * scale, cy - 58 * scale)], (162, 130, 70, 255), width=4 * scale)
            c.poly([(cx + 50 * scale, cy - 60 * scale), (cx + 66 * scale, cy - 60 * scale), (cx + 58 * scale, cy - 82 * scale)], STEEL)
        if gear == "errant":
            c.ellipse(cx - 44 * scale, cy + 16 * scale, 16 * scale, 25 * scale, (78, 100, 150, 255))
    elif gear in {"mage", "orb", "judge"}:
        c.poly([(cx - 36 * scale, cy - 48 * scale), (cx + 36 * scale, cy - 48 * scale), (cx + 3 * scale, cy - 96 * scale)], shade(col, -0.28) + (255,))
        c.glow(cx + 54 * scale, cy - 20 * scale, 18 * scale, 18 * scale, col, 90, 8)
        c.ellipse(cx + 54 * scale, cy - 20 * scale, 11 * scale, 11 * scale, shade(col, 0.35) + (230,))
    elif gear in {"merchant", "pack", "satchel"}:
        c.rect(cx + 34 * scale, cy + 5 * scale, cx + 63 * scale, cy + 39 * scale, (124, 84, 48, 255), outline=OUTLINE, radius=4)
        if gear == "merchant":
            c.ellipse(cx + 48 * scale, cy + 2 * scale, 10 * scale, 10 * scale, GOLD, outline=None)
    elif gear in {"healer", "priest", "acolyte"}:
        c.rect(cx - 5 * scale, cy + 2 * scale, cx + 5 * scale, cy + 38 * scale, (204, 66, 66, 255), radius=1)
        c.rect(cx - 18 * scale, cy + 14 * scale, cx + 18 * scale, cy + 24 * scale, (204, 66, 66, 255), radius=1)
        if gear == "priest":
            c.glow(cx, cy - 78 * scale, 18 * scale, 8 * scale, (255, 236, 170), 80, 5)
    elif gear in {"smith", "pick"}:
        c.line([(cx + 50 * scale, cy + 38 * scale), (cx + 72 * scale, cy - 28 * scale)], STEEL, width=5 * scale)
        c.rect(cx + 62 * scale, cy - 40 * scale, cx + 88 * scale, cy - 24 * scale, (86, 92, 104, 255), outline=OUTLINE, radius=3)
    elif gear in {"cook"}:
        c.rect(cx - 20 * scale, cy - 83 * scale, cx + 20 * scale, cy - 56 * scale, (245, 245, 238, 255), outline=OUTLINE, radius=4)
        for ox in (-14, 0, 14):
            c.ellipse(cx + ox * scale, cy - 84 * scale, 10 * scale, 10 * scale, (250, 250, 246, 255), outline=None)
    elif gear in {"cards"}:
        c.rect(cx + 43 * scale, cy - 8 * scale, cx + 62 * scale, cy + 20 * scale, (250, 250, 250, 255), outline=(160, 40, 56, 255), radius=2)
        c.ellipse(cx + 52 * scale, cy + 6 * scale, 3 * scale, 3 * scale, (200, 36, 48, 255), outline=None)
    elif gear in {"instrument"}:
        c.ellipse(cx - 50 * scale, cy + 30 * scale, 15 * scale, 21 * scale, (126, 82, 42, 255), outline=OUTLINE, width=3)
        c.line([(cx - 39 * scale, cy + 14 * scale), (cx - 18 * scale, cy - 18 * scale)], (126, 82, 42, 255), width=5 * scale)
    elif gear in {"beads"}:
        for n in range(6):
            c.ellipse(cx - 18 * scale + n * 7 * scale, cy + 5 * scale + math.sin(n) * 3, 3 * scale, 3 * scale, GOLD, outline=None)
    elif gear in {"mug", "bottle"}:
        c.rect(cx + 42 * scale, cy + 0, cx + 60 * scale, cy + 26 * scale, (205, 156, 88, 255), outline=OUTLINE, radius=3)
        c.rect(cx + 44 * scale, cy - 5 * scale, cx + 58 * scale, cy + 1 * scale, (245, 232, 198, 255), radius=2)
    elif gear in {"rod", "fish"}:
        c.line([(cx + 44 * scale, cy + 62 * scale), (cx + 78 * scale, cy - 72 * scale)], (106, 72, 42, 255), width=3 * scale)
        c.ellipse(cx + 73 * scale, cy - 12 * scale, 10 * scale, 5 * scale, (130, 190, 220, 255), outline=OUTLINE, width=2)
    elif gear in {"banner", "bell"}:
        c.line([(cx + 48 * scale, cy + 60 * scale), (cx + 48 * scale, cy - 72 * scale)], (114, 76, 42, 255), width=4 * scale)
        c.poly([(cx + 48 * scale, cy - 72 * scale), (cx + 84 * scale, cy - 55 * scale), (cx + 48 * scale, cy - 39 * scale)], shade(col, 0.15) + (255,))
    elif gear in {"hat", "farmer"}:
        c.ellipse(cx, cy - 58 * scale, 38 * scale, 9 * scale, (210, 176, 90, 255), outline=OUTLINE, width=2)
        c.poly([(cx - 22 * scale, cy - 60 * scale), (cx + 22 * scale, cy - 60 * scale), (cx + 8 * scale, cy - 82 * scale), (cx - 10 * scale, cy - 82 * scale)], (214, 178, 90, 255), outline=OUTLINE)
    elif gear in {"hood", "plain", "child"}:
        c.ellipse(cx, cy - 55 * scale, 27 * scale, 19 * scale, shade(col, -0.35) + (255,), outline=OUTLINE if gear == "hood" else None, width=2)
    elif gear in {"lamp"}:
        c.line([(cx + 56 * scale, cy + 54 * scale), (cx + 56 * scale, cy - 48 * scale)], (98, 72, 42, 255), width=4 * scale)
        c.glow(cx + 56 * scale, cy - 54 * scale, 18 * scale, 18 * scale, (255, 190, 82), 100, 8)
        c.ellipse(cx + 56 * scale, cy - 54 * scale, 8 * scale, 11 * scale, (255, 210, 100, 230), outline=OUTLINE, width=2)
    elif gear in {"book", "ledger", "scholar"}:
        c.rect(cx + 38 * scale, cy + 4 * scale, cx + 65 * scale, cy + 28 * scale, (124, 58, 46, 255), outline=OUTLINE, radius=3)
        c.line([(cx - 8 * scale, cy - 40 * scale), (cx + 8 * scale, cy - 40 * scale)], INK, width=2 * scale)
    elif gear in {"ribbons"}:
        c.line([(cx - 42 * scale, cy + 10 * scale), (cx - 70 * scale, cy - 12 * scale), (cx - 58 * scale, cy + 30 * scale)], (255, 100, 190, 210), width=5 * scale)
        c.line([(cx + 44 * scale, cy + 8 * scale), (cx + 76 * scale, cy - 12 * scale), (cx + 62 * scale, cy + 30 * scale)], (255, 190, 230, 210), width=5 * scale)
    elif gear in {"bow"}:
        c.line([(cx + 50 * scale, cy + 38 * scale), (cx + 72 * scale, cy - 35 * scale), (cx + 56 * scale, cy - 62 * scale)], (120, 80, 46, 255), width=4 * scale)
        c.line([(cx + 56 * scale, cy - 62 * scale), (cx + 50 * scale, cy + 38 * scale)], (232, 222, 190, 210), width=1.5 * scale)
    elif gear in {"noble"}:
        crown(c, cx, cy - 72 * scale, 0.58 * scale)
    elif gear in {"shovel", "net", "cloth", "herb", "staff"}:
        c.line([(cx + 50 * scale, cy + 62 * scale), (cx + 70 * scale, cy - 50 * scale)], (116, 82, 48, 255), width=4 * scale)
        if gear == "herb":
            c.ellipse(cx + 68 * scale, cy - 48 * scale, 9 * scale, 6 * scale, (120, 220, 110, 255), outline=None)


def draw_slime(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"], 145 + pose["bob"]
    draw_shadow(c, cx, 184, 55 * size, 13 * size)
    c.glow(cx, cy, 56 * size, 42 * size, color, 45, 8)
    c.ellipse(cx, cy + 8 * size, 54 * size, 38 * size, shade(color, -0.02) + (235,), width=5)
    c.ellipse(cx + 8 * size, cy - 24 * size, 22 * size, 14 * size, shade(color, 0.18) + (230,), width=3)
    if gear == "mimic":
        c.poly([(cx - 28, cy + 10), (cx + 26, cy + 10), (cx + 18, cy + 26), (cx - 22, cy + 27)], (40, 24, 30, 230), outline=None)
        for n in range(5):
            x = cx - 22 + n * 11
            c.poly([(x, cy + 11), (x + 6, cy + 11), (x + 3, cy + 22)], (245, 236, 200, 255), outline=None)
    elif gear == "spore":
        for ox, oy in [(-28, -12), (16, -24), (30, 8)]:
            c.ellipse(cx + ox, cy + oy, 10, 12, (215, 225, 110, 230), outline=OUTLINE, width=2)
    else:
        eyes(c, cx + 8, cy - 3, 0.9, glow=gear in {"ice"})
    if gear == "ice":
        c.poly([(cx - 50, cy + 0), (cx - 28, cy - 28), (cx - 18, cy + 8)], (210, 245, 255, 210), outline=None)
        c.poly([(cx + 36, cy + 5), (cx + 54, cy - 16), (cx + 56, cy + 18)], (210, 245, 255, 210), outline=None)


def draw_beast(c, key, color, gear, pose, size=1):
    cx, cy = 118 + pose["sway"], 145 + pose["bob"]
    draw_shadow(c, cx + 12, 185, 70 * size, 13 * size)
    step = pose["step"]
    for n, lx in enumerate([-36, -8, 22, 48]):
        c.line([(cx + lx * size, cy + 24 * size), (cx + (lx + 5 * math.sin(step + n)) * size, cy + 57 * size)], shade(color, -0.45) + (255,), width=9 * size)
    c.line([(cx - 58 * size, cy + 0), (cx - 88 * size, cy - 20 * size), (cx - 72 * size, cy - 34 * size)], shade(color, -0.38) + (255,), width=10 * size)
    c.ellipse(cx, cy, 60 * size, 36 * size, shade(color, -0.02) + (255,), width=5)
    c.ellipse(cx + 62 * size, cy - 20 * size, 33 * size, 29 * size, shade(color, 0.04) + (255,), width=5)
    c.ellipse(cx + 90 * size, cy - 12 * size, 22 * size, 14 * size, shade(color, -0.02) + (255,), width=3)
    c.poly([(cx + 44 * size, cy - 40 * size), (cx + 52 * size, cy - 70 * size), (cx + 66 * size, cy - 42 * size)], shade(color, -0.15) + (255,))
    c.poly([(cx + 72 * size, cy - 42 * size), (cx + 92 * size, cy - 68 * size), (cx + 92 * size, cy - 34 * size)], shade(color, -0.15) + (255,))
    c.ellipse(cx + 94 * size, cy - 16 * size, 5 * size, 4 * size, INK, outline=None)
    eyes(c, cx + 60 * size, cy - 25 * size, 0.65 * size)
    if gear in {"spear", "ape"}:
        c.line([(cx + 45 * size, cy + 30 * size), (cx + 88 * size + pose["attack"] * 28, cy - 64 * size - pose["attack"] * 16)], (124, 82, 44, 255), width=4 * size)
        if gear == "spear":
            c.poly([(cx + 83 * size, cy - 67 * size), (cx + 99 * size, cy - 66 * size), (cx + 91 * size, cy - 86 * size)], STEEL)
    if gear in {"tusk", "warlord"}:
        c.poly([(cx + 78 * size, cy - 7 * size), (cx + 112 * size, cy + 4 * size), (cx + 84 * size, cy + 9 * size)], (238, 224, 190, 255), outline=OUTLINE, width=2)
    if gear in {"lava", "hound"}:
        c.glow(cx + 8 * size, cy + 2 * size, 58 * size, 34 * size, (255, 90, 30), 45, 6)
        for ox in (-18, 16, 45):
            c.ellipse(cx + ox * size, cy - 16 * size, 6 * size, 5 * size, (255, 170, 58, 230), outline=None)


def draw_knight(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"] * 0.5, 136 + pose["bob"]
    draw_shadow(c, cx, 187, 54 * size, 12 * size)
    step = pose["step"]
    for side in (-1, 1):
        c.line([(cx + side * 13 * size, cy + 40 * size), (cx + side * (15 + 6 * step) * size, cy + 66 * size)], shade(color, -0.58) + (255,), width=9 * size)
    c.ellipse(cx, cy + 18 * size, 35 * size, 47 * size, shade(color, -0.06) + (255,), width=5)
    c.ellipse(cx, cy - 37 * size, 25 * size, 25 * size, shade(STEEL, 0.02) + (255,), width=4)
    c.rect(cx - 21 * size, cy - 42 * size, cx + 23 * size, cy - 31 * size, INK, radius=2)
    c.ellipse(cx - 34 * size, cy + 8 * size, 17 * size, 27 * size, shade(color, -0.25) + (255,), width=4)
    if gear in {"spear", "templar", "tower", "general"}:
        c.line([(cx + 40 * size, cy + 58 * size), (cx + 56 * size + pose["attack"] * 34, cy - 76 * size - pose["attack"] * 16)], (130, 92, 48, 255), width=5 * size)
        c.poly([(cx + 49 * size, cy - 82 * size), (cx + 66 * size, cy - 82 * size), (cx + 58 * size, cy - 108 * size)], STEEL)
    elif gear == "crossbow":
        c.line([(cx + 36 * size, cy - 6 * size), (cx + 78 * size, cy - 18 * size)], (118, 78, 42, 255), width=8 * size)
        c.line([(cx + 72 * size, cy - 34 * size), (cx + 84 * size, cy - 2 * size)], STEEL, width=3 * size)
    else:
        c.line([(cx + 33 * size, cy + 42 * size), (cx + 70 * size + pose["attack"] * 28, cy - 55 * size - pose["attack"] * 26)], STEEL, width=5 * size)
    if gear in {"templar", "emperor", "general"}:
        crown(c, cx, cy - 66 * size, 0.62 * size)
        c.glow(cx, cy + 3 * size, 55 * size, 52 * size, color, 36, 8)
    elif gear in {"spear", "sword"}:
        c.rect(cx - 5 * size, cy - 78 * size, cx + 5 * size, cy - 48 * size, (210, 52, 56, 255), radius=1)


def draw_mage(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"] * 0.45, 138 + pose["bob"]
    draw_shadow(c, cx, 187, 50 * size, 12 * size)
    c.poly(
        [
            (cx - 38 * size, cy + 62 * size),
            (cx - 22 * size, cy - 16 * size),
            (cx + 24 * size, cy - 16 * size),
            (cx + 43 * size, cy + 62 * size),
        ],
        shade(color, -0.10) + (255,),
    )
    c.ellipse(cx, cy - 35 * size, 22 * size, 22 * size, SKIN, width=3)
    c.poly([(cx - 40 * size, cy - 48 * size), (cx + 40 * size, cy - 48 * size), (cx + 3 * size, cy - 100 * size)], shade(color, -0.30) + (255,))
    c.line([(cx + 39 * size, cy + 60 * size), (cx + 61 * size + pose["attack"] * 22, cy - 60 * size - pose["attack"] * 18)], (126, 86, 48, 255), width=5 * size)
    orb_col = (255, 170, 80) if gear in {"fire", "pyre"} else shade(color, 0.40)
    c.glow(cx + 62 * size + pose["attack"] * 22, cy - 68 * size - pose["attack"] * 18, 22 * size, 22 * size, orb_col, 120, 8)
    c.ellipse(cx + 62 * size + pose["attack"] * 22, cy - 68 * size - pose["attack"] * 18, 10 * size, 10 * size, orb_col + (245,), outline=None)
    if gear in {"halo", "seraph"}:
        c.ellipse(cx, cy - 105 * size, 24 * size, 7 * size, (255, 238, 170, 160), outline=(255, 245, 205, 180), width=2)
    eyes(c, cx, cy - 36 * size, 0.65 * size, glow=True)


def draw_imp(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"] * 0.5, 142 + pose["bob"]
    draw_shadow(c, cx, 187, 54 * size, 12 * size)
    c.line([(cx - 30 * size, cy + 33 * size), (cx - 73 * size, cy + 42 * size), (cx - 72 * size, cy - 10 * size)], shade(color, -0.52) + (255,), width=8 * size)
    c.poly([(cx - 76 * size, cy - 10 * size), (cx - 60 * size, cy - 3 * size), (cx - 74 * size, cy + 7 * size)], shade(color, -0.35) + (255,))
    c.ellipse(cx, cy + 20 * size, 37 * size, 39 * size, shade(color, -0.06) + (255,), width=5)
    c.ellipse(cx, cy - 32 * size, 28 * size, 27 * size, shade(color, 0.04) + (255,), width=4)
    c.line([(cx - 12 * size, cy - 50 * size), (cx - 32 * size, cy - 84 * size)], (235, 218, 184, 255), width=6 * size)
    c.line([(cx + 13 * size, cy - 50 * size), (cx + 36 * size, cy - 84 * size)], (235, 218, 184, 255), width=6 * size)
    eyes(c, cx, cy - 32 * size, 0.72 * size, glow=True)
    if gear in {"bomb", "lava"}:
        c.glow(cx + 54 * size, cy + 16 * size, 22 * size, 22 * size, (255, 90, 30), 100, 7)
        c.ellipse(cx + 54 * size, cy + 16 * size, 16 * size, 16 * size, (48, 42, 38, 255), width=3)
        c.ellipse(cx + 59 * size, cy + 8 * size, 5 * size, 5 * size, (255, 170, 62, 255), outline=None)
    if gear in {"guard", "brute", "malgoth", "duke"}:
        c.ellipse(cx - 36 * size, cy + 12 * size, 16 * size, 25 * size, shade(color, -0.25) + (255,), width=3)
    if gear in {"void"}:
        c.glow(cx, cy + 4 * size, 54 * size, 54 * size, (150, 80, 255), 75, 12)


def draw_plant(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"] * 0.4, 145 + pose["bob"]
    draw_shadow(c, cx, 188, 62 * size, 12 * size)
    trunk = mix(color, (90, 62, 38), 0.45)
    c.ellipse(cx, cy + 22 * size, 36 * size, 43 * size, trunk + (255,), width=5)
    for ang in [-1.1, -0.55, 0.1, 0.65, 1.15]:
        ex = cx + math.cos(ang) * 42 * size
        ey = cy - 20 * size + math.sin(ang) * 24 * size
        c.line([(cx, cy - 6 * size), (ex, ey)], shade(color, -0.25) + (255,), width=8 * size)
        c.ellipse(ex, ey, 22 * size, 12 * size, shade(color, 0.08) + (235,), width=3)
    if gear in {"tree", "jungle"}:
        crown(c, cx, cy - 54 * size, 0.58 * size)
    elif gear in {"vine"}:
        c.line([(cx + 36 * size, cy - 16 * size), (cx + 75 * size + pose["attack"] * 28, cy - 48 * size)], shade(color, -0.12) + (255,), width=6 * size)
    eyes(c, cx, cy + 8 * size, 0.62 * size, glow=False)


def draw_frog(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"], 148 + pose["bob"]
    draw_shadow(c, cx, 187, 58 * size, 12 * size)
    c.ellipse(cx, cy + 10 * size, 52 * size, 35 * size, shade(color, -0.02) + (255,), width=5)
    c.ellipse(cx - 24 * size, cy - 24 * size, 17 * size, 17 * size, shade(color, 0.08) + (255,), width=3)
    c.ellipse(cx + 24 * size, cy - 24 * size, 17 * size, 17 * size, shade(color, 0.08) + (255,), width=3)
    eyes(c, cx, cy - 25 * size, 0.72 * size)
    c.line([(cx - 20 * size, cy + 22 * size), (cx + 20 * size, cy + 21 * size)], shade(color, -0.5) + (255,), width=2 * size)
    if gear in {"poison", "spit"}:
        for ox, oy in [(-32, 4), (10, -3), (30, 15)]:
            c.ellipse(cx + ox * size, cy + oy * size, 5 * size, 4 * size, (70, 70, 40, 160), outline=None)


def draw_bug(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"], 145 + pose["bob"]
    draw_shadow(c, cx, 186, 52 * size, 12 * size)
    c.ellipse(cx - 18 * size, cy, 30 * size, 32 * size, shade(color, -0.05) + (255,), width=4)
    c.ellipse(cx + 26 * size, cy - 2 * size, 27 * size, 28 * size, shade(color, 0.04) + (255,), width=4)
    for side in (-1, 1):
        for n in range(3):
            y = cy - 20 * size + n * 18 * size
            c.line([(cx - 3 * size, y), (cx + side * 62 * size, y - side * pose["step"] * 7)], shade(color, -0.45) + (255,), width=4 * size)
    c.ellipse(cx - 18 * size, cy - 28 * size, 26 * size, 12 * size, (220, 240, 255, 90), outline=(220, 240, 255, 100), width=1)
    c.ellipse(cx + 18 * size, cy - 28 * size, 26 * size, 12 * size, (220, 240, 255, 90), outline=(220, 240, 255, 100), width=1)
    eyes(c, cx + 30 * size, cy - 10 * size, 0.52 * size)
    if gear in {"stinger", "dart", "ember"}:
        c.poly([(cx - 54 * size, cy + 2 * size), (cx - 80 * size, cy - 8 * size), (cx - 61 * size, cy + 18 * size)], shade(color, -0.2) + (255,))
    if gear == "ember":
        c.glow(cx - 18 * size, cy, 40 * size, 40 * size, (255, 120, 40), 60, 8)


def draw_bat(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"], 136 + pose["bob"]
    draw_shadow(c, cx, 187, 50 * size, 11 * size)
    flap = 18 * pose["step"]
    for side in (-1, 1):
        c.poly(
            [
                (cx + side * 10 * size, cy - 6 * size),
                (cx + side * 72 * size, cy - 36 * size - flap * size),
                (cx + side * 56 * size, cy + 22 * size),
                (cx + side * 30 * size, cy + 10 * size),
            ],
            shade(color, -0.24) + (235,),
        )
    c.ellipse(cx, cy + 10 * size, 24 * size, 33 * size, shade(color, -0.03) + (255,), width=4)
    c.ellipse(cx, cy - 28 * size, 23 * size, 21 * size, shade(color, 0.06) + (255,), width=4)
    c.poly([(cx - 16 * size, cy - 42 * size), (cx - 25 * size, cy - 68 * size), (cx - 6 * size, cy - 48 * size)], shade(color, -0.2) + (255,))
    c.poly([(cx + 16 * size, cy - 42 * size), (cx + 27 * size, cy - 68 * size), (cx + 7 * size, cy - 48 * size)], shade(color, -0.2) + (255,))
    eyes(c, cx, cy - 27 * size, 0.58 * size, glow=True)
    if gear in {"count", "thrall"}:
        c.poly([(cx - 21 * size, cy + 48 * size), (cx, cy + 28 * size), (cx + 22 * size, cy + 48 * size)], (245, 245, 235, 255), outline=None)
        if gear == "count":
            crown(c, cx, cy - 58 * size, 0.55 * size)


def draw_spirit(c, key, color, gear, pose, size=1):
    cx, cy = 128 + pose["sway"] * 0.6, 135 + pose["bob"]
    c.glow(cx, cy, 70 * size, 82 * size, color, 95, 16)
    draw_shadow(c, cx, 190, 42 * size, 10 * size)
    c.ellipse(cx, cy - 6 * size, 38 * size, 45 * size, shade(color, 0.20) + (200,), outline=(230, 240, 255, 150), width=3)
    c.poly(
        [
            (cx - 34 * size, cy + 22 * size),
            (cx - 16 * size, cy + 68 * size),
            (cx + 0 * size, cy + 42 * size),
            (cx + 18 * size, cy + 70 * size),
            (cx + 35 * size, cy + 22 * size),
        ],
        shade(color, 0.10) + (170,),
        outline=(230, 240, 255, 105),
        width=2,
    )
    eyes(c, cx, cy - 18 * size, 0.70 * size, glow=True)
    if gear in {"seraph", "aurelia", "crown"}:
        c.ellipse(cx, cy - 70 * size, 31 * size, 9 * size, (255, 238, 180, 160), outline=(255, 248, 210, 190), width=2)
        c.glow(cx, cy - 10 * size, 66 * size, 70 * size, (255, 220, 120), 42, 14)
        if gear == "crown":
            crown(c, cx, cy - 72 * size, 0.68 * size)


def draw_ghost(c, key, color, gear, pose, size=1):
    draw_spirit(c, key, color, gear, pose, size)
    cx, cy = 128 + pose["sway"] * 0.6, 135 + pose["bob"]
    c.rect(cx - 25 * size, cy - 4 * size, cx + 25 * size, cy + 3 * size, (20, 30, 42, 120), radius=2)
    if gear == "bow":
        c.line([(cx + 44 * size, cy + 36 * size), (cx + 68 * size, cy - 32 * size), (cx + 44 * size, cy - 56 * size)], (170, 220, 255, 190), width=4 * size)


def draw_dragon(c, key, color, gear, pose, size=1):
    cx, cy = 119 + pose["sway"], 143 + pose["bob"]
    draw_shadow(c, cx + 12, 188, 68 * size, 12 * size)
    flap = 15 * pose["step"]
    for side in (-1, 1):
        c.poly(
            [
                (cx + side * 4 * size, cy - 8 * size),
                (cx + side * 76 * size, cy - 62 * size - flap * size),
                (cx + side * 56 * size, cy + 10 * size),
                (cx + side * 20 * size, cy + 18 * size),
            ],
            shade(color, -0.20) + (220,),
        )
    c.line([(cx - 44 * size, cy + 22 * size), (cx - 84 * size, cy + 45 * size), (cx - 95 * size, cy + 8 * size)], shade(color, -0.42) + (255,), width=9 * size)
    c.ellipse(cx, cy + 10 * size, 42 * size, 34 * size, shade(color, -0.03) + (255,), width=5)
    c.ellipse(cx + 48 * size, cy - 25 * size, 29 * size, 24 * size, shade(color, 0.05) + (255,), width=4)
    c.ellipse(cx + 74 * size, cy - 18 * size, 18 * size, 11 * size, shade(color, 0.02) + (255,), width=3)
    for ox in (36, 58):
        c.poly([(cx + ox * size, cy - 42 * size), (cx + (ox + 8) * size, cy - 70 * size), (cx + (ox + 17) * size, cy - 43 * size)], (240, 225, 190, 255))
    eyes(c, cx + 50 * size, cy - 28 * size, 0.52 * size, glow=True)
    if gear in {"vermithrax", "court"}:
        crown(c, cx + 30 * size, cy - 62 * size, 0.55 * size)


def draw_nest(c, key, color, gear, pose, size=1):
    cx, cy = 128, 152 + pose["bob"] * 0.4
    draw_shadow(c, cx, 190, 72 * size, 14 * size)
    c.ellipse(cx, cy + 12 * size, 65 * size, 35 * size, shade(color, -0.08) + (255,), width=5)
    for a in range(9):
        ang = a / 9 * math.tau
        x0 = cx + math.cos(ang) * 10 * size
        y0 = cy + 8 * size + math.sin(ang) * 5 * size
        x1 = cx + math.cos(ang) * 66 * size
        y1 = cy + 8 * size + math.sin(ang) * 32 * size
        c.line([(x0, y0), (x1, y1)], shade(color, -0.35) + (230,), width=5 * size)
    for ox, oy in [(-25, -4), (18, -8), (0, 15)]:
        c.ellipse(cx + ox * size, cy + oy * size, 14 * size, 20 * size, (232, 222, 190, 255), width=3)


def draw_elf(c, key, color, gear, pose, size=1):
    draw_folk(c, key, color, "bow" if gear != "blade" else "errant", pose, big=False)
    cx, cy = 128 + pose["sway"] * 0.35, 132 + pose["bob"]
    c.poly([(cx - 21 * size, cy - 39 * size), (cx - 52 * size, cy - 48 * size), (cx - 22 * size, cy - 52 * size)], SKIN, outline=OUTLINE, width=2)
    c.poly([(cx + 21 * size, cy - 39 * size), (cx + 52 * size, cy - 48 * size), (cx + 22 * size, cy - 52 * size)], SKIN, outline=OUTLINE, width=2)
    if gear in {"queen", "warden"}:
        crown(c, cx, cy - 72 * size, 0.55 * size)


DRAWERS = {
    "slime": draw_slime,
    "beast": draw_beast,
    "knight": draw_knight,
    "mage": draw_mage,
    "imp": draw_imp,
    "plant": draw_plant,
    "frog": draw_frog,
    "bug": draw_bug,
    "bat": draw_bat,
    "spirit": draw_spirit,
    "ghost": draw_ghost,
    "dragon": draw_dragon,
    "nest": draw_nest,
    "elf": draw_elf,
}


def render_kind(kind, spec, state="idle", frame=0, frames=16, size=256, boss=False):
    look, color, gear = spec
    pose = pose_for(state, frame, frames)
    c = SpriteCanvas(size=size, aa=3)
    if kind == "npc":
        draw_folk(c, spec[0], spec[1], spec[2], pose, big=boss)
    else:
        drawer = DRAWERS.get(look, draw_slime)
        drawer(c, spec[0] if len(spec) > 3 else "", color, gear, pose, size=1.35 if boss else 1)
    return c.finish()


def save_png(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)


def export_key(prefix, key, spec, static_size=256, anim_size=256, combat=False, boss=False):
    if key.startswith("hero_"):
        raise RuntimeError("Refusing to write hero asset")
    static = render_kind("npc" if prefix == "npc" else "mob", (key, spec[0], spec[1]) if prefix == "npc" else spec, "idle", 2, 16, static_size, boss)
    save_png(static, ASSETS / f"{key}.png")
    count = 0
    for state in ("idle", "walk"):
        for i in range(16):
            img = render_kind("npc" if prefix == "npc" else "mob", (key, spec[0], spec[1]) if prefix == "npc" else spec, state, i, 16, anim_size, boss)
            save_png(img, ANIM / f"{key}_{state}_{i+1}.png")
            count += 1
    # The current engine only consumes hero attack frames, but these are useful
    # if NPC/mob attack animation is wired in later.
    for i in range(8):
        img = render_kind("npc" if prefix == "npc" else "mob", (key, spec[0], spec[1]) if prefix == "npc" else spec, "attack", i, 8, anim_size, boss)
        save_png(img, ANIM / f"{key}_attack_{i+1}.png")
        count += 1
    return count + 1


def make_preview(all_keys):
    cell = 96
    cols = 12
    rows = math.ceil(len(all_keys) / cols)
    img = Image.new("RGBA", (cols * cell, rows * cell), (13, 14, 22, 255))
    d = ImageDraw.Draw(img, "RGBA")
    for idx, (key, path) in enumerate(all_keys):
        r, c = divmod(idx, cols)
        tile = Image.open(path).convert("RGBA").resize((76, 76), Image.Resampling.LANCZOS)
        x, y = c * cell + 10, r * cell + 6
        d.rounded_rectangle((c * cell + 4, r * cell + 4, c * cell + cell - 4, r * cell + cell - 4), radius=8, fill=(22, 24, 36, 255), outline=(56, 60, 82, 255))
        img.alpha_composite(tile, (x, y))
        d.text((c * cell + 7, r * cell + 79), key[:13], fill=(198, 205, 224, 255))
    img.save(PREVIEW, optimize=True)


def main():
    ASSETS.mkdir(exist_ok=True)
    ANIM.mkdir(exist_ok=True)
    written = 0
    preview = []

    for key, spec in sorted(NPCS.items()):
        asset_key = f"npc_{key}"
        written += export_key("npc", asset_key, spec, combat=False)
        preview.append((asset_key, ASSETS / f"{asset_key}.png"))

    for key, spec in sorted(MOBS.items()):
        asset_key = f"mob_{key}"
        written += export_key("mob", asset_key, spec, combat=True)
        preview.append((asset_key, ASSETS / f"{asset_key}.png"))

    for key, spec in sorted(CHAMPS.items()):
        written += export_key("mob", key, spec, static_size=288, anim_size=288, combat=True, boss=True)
        preview.append((key, ASSETS / f"{key}.png"))

    for key, spec in sorted(BOSSES.items()):
        written += export_key("mob", key, spec, static_size=384, anim_size=384, combat=True, boss=True)
        preview.append((key, ASSETS / f"{key}.png"))

    make_preview(preview)
    data = {
        "generated_by": "tools/generate_character_assets.py",
        "hero_assets_touched": False,
        "static_assets": len(preview),
        "png_files_written": written,
        "idle_walk_frames_per_character": 16,
        "attack_frames_per_character": 8,
        "preview": str(PREVIEW.relative_to(ROOT)),
        "groups": {
            "npc": len(NPCS),
            "mob": len(MOBS),
            "champ": len(CHAMPS),
            "boss": len(BOSSES),
        },
    }
    MANIFEST.write_text(json.dumps(data, indent=2) + "\n")
    print(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
