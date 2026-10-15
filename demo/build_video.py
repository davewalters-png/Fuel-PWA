#!/usr/bin/env python3
"""Compose a Trimble Modus-themed narrated walkthrough video for YardFuel."""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
SLIDES = ROOT / "slides"
CAPTURES = ROOT / "captures"
W, H = 1280, 720

# Trimble Modus palette
BLUE_DARK = (0, 79, 131)  # #004f83
BLUE = (0, 99, 163)  # #0063a3
YELLOW = (251, 173, 38)  # #fbad26
GRAY = (37, 42, 46)  # #252a2e
STEEL = (110, 123, 135)
WHITE = (255, 255, 255)
OFFWHITE = (245, 247, 249)
PALE_YELLOW = (255, 245, 228)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def gradient_bg() -> Image.Image:
    img = Image.new("RGB", (W, H), BLUE_DARK)
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        r = int(BLUE_DARK[0] * (1 - t) + GRAY[0] * t)
        g = int(BLUE_DARK[1] * (1 - t) + GRAY[1] * t)
        b = int(BLUE_DARK[2] * (1 - t) + GRAY[2] * t)
        for x in range(W):
            # subtle diagonal highlight
            boost = 12 * math.sin((x + y) * 0.004)
            px[x, y] = (
                min(255, max(0, int(r + boost * 0.2))),
                min(255, max(0, int(g + boost * 0.35))),
                min(255, max(0, int(b + boost * 0.55))),
            )
    return img


def draw_header(draw: ImageDraw.ImageDraw, title: str, subtitle: str | None = None) -> None:
    # yellow accent bar
    draw.rectangle([0, 0, W, 8], fill=YELLOW)
    draw.text((64, 36), "TRIMBLE", font=font(22, True), fill=YELLOW)
    draw.text((64, 72), title, font=font(44, True), fill=WHITE)
    if subtitle:
        draw.text((64, 130), subtitle, font=font(22), fill=(200, 210, 220))


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        test = f"{cur} {word}".strip()
        if draw.textlength(test, font=fnt) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def save(img: Image.Image, name: str) -> Path:
    SLIDES.mkdir(parents=True, exist_ok=True)
    path = SLIDES / name
    img.save(path, "PNG")
    return path


def slide_title() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, 8], fill=YELLOW)
    draw.rectangle([0, H - 90, W, H], fill=(0, 50, 85))
    draw.text((64, 180), "TRIMBLE", font=font(28, True), fill=YELLOW)
    draw.text((64, 230), "YardFuel", font=font(86, True), fill=WHITE)
    draw.text((64, 330), "Fuel Ticket PWA for TMT Fleet Maintenance", font=font(30), fill=(210, 220, 230))
    draw.text((64, 390), "End-to-end walkthrough  ·  MCP integration layer", font=font(22), fill=STEEL)
    draw.text((64, H - 58), "Capture at the island  →  Sync via MCP  →  Populate TMT fuel ticket", font=font(20), fill=WHITE)
    return save(img, "00-title.png")


def slide_agenda() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Walkthrough agenda", "From fuel island to TMT fuel ticket")
    items = [
        "01   Progressive web app on any device",
        "02   Primary and other dispensed products",
        "03   Asset selection and meter capture",
        "04   Push through MCP / TMT client",
        "05   Offline queue and fuel ticket population",
    ]
    y = 200
    for item in items:
        draw.rounded_rectangle([64, y, W - 64, y + 58], radius=10, fill=(0, 70, 115))
        draw.rectangle([64, y, 72, y + 58], fill=YELLOW)
        draw.text((96, y + 14), item, font=font(24, True), fill=WHITE)
        y += 72
    return save(img, "01-agenda.png")


def slide_pwa() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Runs anywhere", "Installable PWA — phone, tablet, desktop")
    tiles = [
        ("Browser", "Chrome, Edge, Safari"),
        ("Installable", "Standalone home-screen app"),
        ("Offline-ready", "IndexedDB sync queue"),
        ("Secure push", "Shared TMT client layer"),
    ]
    for i, (h, s) in enumerate(tiles):
        x = 64 + (i % 2) * 580
        y = 200 + (i // 2) * 180
        draw.rounded_rectangle([x, y, x + 540, y + 150], radius=14, fill=(0, 70, 115))
        draw.rectangle([x, y, x + 10, y + 150], fill=YELLOW)
        draw.text((x + 36, y + 36), h, font=font(30, True), fill=WHITE)
        draw.text((x + 36, y + 84), s, font=font(22), fill=(200, 210, 220))
    return save(img, "02-pwa.png")


def slide_products() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Products dispensed", "One visit · one fuel ticket")
    primary = [("DIESEL", "DSL"), ("GASOLINE", "GAS"), ("PROPANE", "LPG")]
    other = [("ANTIFREEZE", "AFRZ"), ("ENGINE OIL", "OIL"), ("DEF", "DEF")]
    draw.text((64, 190), "PRIMARY", font=font(18, True), fill=YELLOW)
    for i, (name, code) in enumerate(primary):
        x = 64 + i * 380
        draw.rounded_rectangle([x, 225, x + 350, 340], radius=12, fill=BLUE)
        draw.text((x + 28, 250), name, font=font(26, True), fill=WHITE)
        draw.text((x + 28, 295), f"TMT FuelCode  {code}", font=font(18), fill=PALE_YELLOW)
    draw.text((64, 390), "OTHER PRODUCTS", font=font(18, True), fill=YELLOW)
    for i, (name, code) in enumerate(other):
        x = 64 + i * 380
        draw.rounded_rectangle([x, 425, x + 350, 540], radius=12, fill=(0, 70, 115))
        draw.text((x + 28, 450), name, font=font(24, True), fill=WHITE)
        draw.text((x + 28, 495), f"TMT FuelCode  {code}", font=font(18), fill=(200, 210, 220))
    return save(img, "03-products.png")


def slide_capture() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Capture the visit", "Asset, meters, and line items")
    steps = [
        ("1", "Search TMT unit", "Truck, equipment, or generator"),
        ("2", "Record meters", "Odometer and/or hour meter"),
        ("3", "Add products", "Quantities and optional cost"),
        ("4", "Submit ticket", "Online push or offline queue"),
    ]
    for i, (n, title, body) in enumerate(steps):
        y = 190 + i * 110
        draw.ellipse([64, y + 10, 124, y + 70], fill=YELLOW)
        draw.text((84, y + 22), n, font=font(28, True), fill=GRAY)
        draw.text((160, y + 12), title, font=font(28, True), fill=WHITE)
        draw.text((160, y + 52), body, font=font(22), fill=(190, 200, 210))
    return save(img, "04-capture.png")


def slide_architecture() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw_header(draw, "MCP integration layer", "Browser and agents share one TMT client")
    boxes = [
        (80, 230, 360, 430, "YardFuel PWA"),
        (460, 230, 820, 430, "TMT Client\n+ MCP Server"),
        (920, 230, 1200, 430, "TMT Fleet\nMaintenance"),
    ]
    for x1, y1, x2, y2, label in boxes:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=16, fill=BLUE)
        draw.rectangle([x1, y1, x1 + 10, y2], fill=YELLOW)
        lines = label.split("\n")
        ty = y1 + 60
        for line in lines:
            tw = draw.textlength(line, font=font(26, True))
            draw.text(((x1 + x2) / 2 - tw / 2, ty), line, font=font(26, True), fill=WHITE)
            ty += 40
    # arrows
    draw.polygon([(370, 320), (450, 300), (450, 340)], fill=YELLOW)
    draw.polygon([(830, 320), (910, 300), (910, 340)], fill=YELLOW)
    draw.text((64, 500), "POST /Fleet_ServiceCenter/FuelTicket", font=font(24, True), fill=YELLOW)
    draw.text((64, 545), "Identical payload from UI submit or tmt_create_fuel_ticket MCP tool", font=font(20), fill=(200, 210, 220))
    return save(img, "05-architecture.png")


def slide_offline() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Offline resilience", "Queue locally · sync when connected")
    bullets = [
        "Transactions persist in IndexedDB on the device",
        "Status tracked: pending → syncing → synced",
        "Automatic retry when the browser comes online",
        "Fuel ticket IDs returned from TMT / mock store",
    ]
    y = 210
    for b in bullets:
        draw.ellipse([72, y + 10, 92, y + 30], fill=YELLOW)
        draw.text((120, y), b, font=font(26), fill=WHITE)
        y += 80
    return save(img, "06-offline.png")


def slide_payload() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Fuel ticket payload", "Mapped to Integration Toolkit fields")
    code = (
        "UnitID: TRK-1042\n"
        "Meter: 214900\n"
        "FuelTicketDetails:\n"
        "  • DSL  48.2 gal\n"
        "  • DEF   2.5 gal\n"
        "  • OIL   4.0 qt\n"
        "ExternalReference: yf-…"
    )
    draw.rounded_rectangle([64, 190, W - 64, 620], radius=16, fill=(20, 28, 34))
    draw.rectangle([64, 190, 74, 620], fill=YELLOW)
    y = 220
    for line in code.split("\n"):
        color = YELLOW if line.startswith("  •") or line.endswith(":") else WHITE
        draw.text((110, y), line, font=font(28), fill=color)
        y += 48
    return save(img, "07-payload.png")


def slide_app_frame(capture: Path, caption: str, name: str) -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw_header(draw, caption, "Live YardFuel interface")
    shot = Image.open(capture).convert("RGB")
    # fit into frame
    frame = (64, 180, W - 64, H - 48)
    fw, fh = frame[2] - frame[0], frame[3] - frame[1]
    shot.thumbnail((fw - 20, fh - 20))
    ox = frame[0] + (fw - shot.width) // 2
    oy = frame[1] + (fh - shot.height) // 2
    draw.rounded_rectangle([frame[0], frame[1], frame[2], frame[3]], radius=12, fill=(15, 20, 24))
    img.paste(shot, (ox, oy))
    return save(img, name)


def slide_close() -> Path:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, 8], fill=YELLOW)
    draw.text((64, 220), "TRIMBLE", font=font(28, True), fill=YELLOW)
    draw.text((64, 270), "Thank you", font=font(72, True), fill=WHITE)
    draw.text((64, 370), "YardFuel  ·  TMT Fleet Maintenance", font=font(28), fill=(200, 210, 220))
    draw.text((64, 430), "Capture  →  MCP layer  →  Fuel ticket", font=font(24), fill=STEEL)
    draw.rectangle([0, H - 90, W, H], fill=(0, 50, 85))
    draw.text((64, H - 55), "Integration Toolkit  ·  Fleet_ServiceCenter/FuelTicket", font=font(20), fill=WHITE)
    return save(img, "99-close.png")


def parse_vtt(path: Path) -> list[tuple[float, float, str]]:
    cues: list[tuple[float, float, str]] = []
    lines = path.read_text().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if "-->" in line:
            start_s, end_s = [p.strip().replace(",", ".") for p in line.split("-->")]
            def to_sec(t: str) -> float:
                h, m, s = t.split(":")
                return int(h) * 3600 + int(m) * 60 + float(s)
            start, end = to_sec(start_s), to_sec(end_s)
            i += 1
            text_parts = []
            while i < len(lines) and lines[i].strip():
                text_parts.append(lines[i].strip())
                i += 1
            cues.append((start, end, " ".join(text_parts)))
        else:
            i += 1
    return cues


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # slides
    paths = [
        slide_title(),
        slide_agenda(),
        slide_pwa(),
        slide_products(),
        slide_capture(),
    ]
    home = CAPTURES / "01-home.png"
    if home.exists():
        paths.append(slide_app_frame(home, "YardFuel at the island", "08-app.png"))
    paths.extend(
        [
            slide_architecture(),
            slide_offline(),
            slide_payload(),
            slide_close(),
        ]
    )

    audio = OUT / "YardFuel-TMT-Walkthrough.mp3"
    duration = float(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nk=1:nw=1",
                str(audio),
            ],
            text=True,
        ).strip()
    )

    # Map slides to narration timeline segments (seconds)
    timeline = [
        (0.0, 9.7, paths[0]),  # welcome / title
        (9.7, 21.9, paths[1]),  # agenda / e2e
        (21.9, 32.8, paths[2]),  # PWA anywhere
        (32.8, 47.1, paths[3]),  # products
        (47.1, 59.1, paths[4]),  # capture / asset
        (59.1, 71.5, paths[5] if len(paths) > 8 else paths[4]),  # app or capture
        (71.5, 85.5, paths[-4]),  # architecture MCP
        (85.5, 97.1, paths[-3]),  # offline
        (97.1, 110.5, paths[-2]),  # payload
        (110.5, duration, paths[-1]),  # close
    ]

    # If we have app slide at index 5 of paths list carefully
    # Rebuild timeline more carefully based on actual paths list length
    title, agenda, pwa, products, capture = paths[0], paths[1], paths[2], paths[3], paths[4]
    if home.exists():
        app, arch, offline, payload, close = paths[5], paths[6], paths[7], paths[8], paths[9]
        timeline = [
            (0.0, 9.7, title),
            (9.7, 21.9, agenda),
            (21.9, 32.8, pwa),
            (32.8, 47.1, products),
            (47.1, 59.1, capture),
            (59.1, 71.5, app),
            (71.5, 85.5, arch),
            (85.5, 97.1, offline),
            (97.1, 110.5, payload),
            (110.5, duration, close),
        ]
    else:
        arch, offline, payload, close = paths[5], paths[6], paths[7], paths[8]
        timeline = [
            (0.0, 9.7, title),
            (9.7, 21.9, agenda),
            (21.9, 32.8, pwa),
            (32.8, 47.1, products),
            (47.1, 71.5, capture),
            (71.5, 85.5, arch),
            (85.5, 97.1, offline),
            (97.1, 110.5, payload),
            (110.5, duration, close),
        ]

    concat_list = OUT / "concat.txt"
    segment_files: list[Path] = []
    for idx, (start, end, img_path) in enumerate(timeline):
        seg_dur = max(0.2, end - start)
        seg = OUT / f"seg_{idx:02d}.mp4"
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-loop",
                "1",
                "-i",
                str(img_path),
                "-t",
                f"{seg_dur:.3f}",
                "-vf",
                "fade=t=in:st=0:d=0.35,fade=t=out:st={:.3f}:d=0.35,format=yuv420p".format(
                    max(0.0, seg_dur - 0.35)
                ),
                "-r",
                "30",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                str(seg),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        segment_files.append(seg)

    with concat_list.open("w") as f:
        for seg in segment_files:
            f.write(f"file '{seg}'\n")

    silent = OUT / "video_silent.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c",
            "copy",
            str(silent),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    final = OUT / "YardFuel-TMT-Walkthrough.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(silent),
            "-i",
            str(audio),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(final),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Also place copies in a downloads-friendly folder
    downloads = ROOT.parent / "downloads"
    downloads.mkdir(exist_ok=True)
    for src_name in [
        "YardFuel-TMT-Walkthrough.mp4",
        "YardFuel-TMT-Walkthrough.mp3",
    ]:
        src = OUT / src_name
        dst = downloads / src_name
        dst.write_bytes(src.read_bytes())

    print(f"VIDEO={final}")
    print(f"MP3={audio}")
    print(f"DURATION={duration}")
    print(f"DOWNLOADS={downloads}")


if __name__ == "__main__":
    build()
