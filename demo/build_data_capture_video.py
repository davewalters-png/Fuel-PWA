#!/usr/bin/env python3
"""Compose a detailed data-capture narrated video from live YardFuel screenshots."""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
SLIDES = ROOT / "slides-detail"
CAPTURES = ROOT / "captures-detail"
DOWNLOADS = ROOT.parent / "downloads"
W, H = 1280, 720

BLUE_DARK = (0, 79, 131)
BLUE = (0, 99, 163)
YELLOW = (251, 173, 38)
GRAY = (37, 42, 46)
WHITE = (255, 255, 255)
STEEL = (170, 185, 198)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    )
    return ImageFont.truetype(path, size)


def bg() -> Image.Image:
    img = Image.new("RGB", (W, H), BLUE_DARK)
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(BLUE_DARK[0] * (1 - t) + GRAY[0] * t)
        g = int(BLUE_DARK[1] * (1 - t) + GRAY[1] * t)
        b = int(BLUE_DARK[2] * (1 - t) + GRAY[2] * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    draw.rectangle([0, 0, W, 8], fill=YELLOW)
    return img


def save(img: Image.Image, name: str) -> Path:
    SLIDES.mkdir(parents=True, exist_ok=True)
    path = SLIDES / name
    img.save(path, "PNG")
    return path


def title_slide() -> Path:
    img = bg()
    d = ImageDraw.Draw(img)
    d.text((64, 180), "TRIMBLE", font=font(26, True), fill=YELLOW)
    d.text((64, 230), "YardFuel", font=font(78, True), fill=WHITE)
    d.text((64, 330), "Data Capture — Field Detail Walkthrough", font=font(30), fill=STEEL)
    d.text(
        (64, 400),
        "Asset · Meters · Products · Notes · Sync to TMT",
        font=font(24),
        fill=(200, 210, 220),
    )
    d.rectangle([0, H - 90, W, H], fill=(0, 50, 85))
    d.text(
        (64, H - 55),
        "Every field that becomes a TMT Fleet Maintenance fuel ticket",
        font=font(20),
        fill=WHITE,
    )
    return save(img, "00-title.png")


def close_slide() -> Path:
    img = bg()
    d = ImageDraw.Draw(img)
    d.text((64, 240), "TRIMBLE", font=font(26, True), fill=YELLOW)
    d.text((64, 290), "Data capture complete", font=font(54, True), fill=WHITE)
    d.text(
        (64, 380),
        "Asset, meters, products, and notes → TMT fuel ticket",
        font=font(24),
        fill=STEEL,
    )
    return save(img, "99-close.png")


def callout_slide(title: str, bullets: list[str], name: str) -> Path:
    img = bg()
    d = ImageDraw.Draw(img)
    d.text((64, 48), "TRIMBLE", font=font(20, True), fill=YELLOW)
    d.text((64, 90), title, font=font(40, True), fill=WHITE)
    y = 190
    for b in bullets:
        d.ellipse([72, y + 10, 92, y + 30], fill=YELLOW)
        d.text((120, y), b, font=font(26), fill=WHITE)
        y += 70
    return save(img, name)


def frame_capture(capture: Path, eyebrow: str, title: str, name: str) -> Path:
    img = bg()
    d = ImageDraw.Draw(img)
    d.text((64, 28), "TRIMBLE", font=font(18, True), fill=YELLOW)
    d.text((64, 58), eyebrow, font=font(18), fill=STEEL)
    d.text((64, 86), title, font=font(34, True), fill=WHITE)

    shot = Image.open(capture).convert("RGB")
    frame = (48, 145, W - 48, H - 36)
    fw, fh = frame[2] - frame[0], frame[3] - frame[1]
    d.rounded_rectangle([frame[0], frame[1], frame[2], frame[3]], radius=14, fill=(12, 18, 24))

    # Prefer cropping the form area for readability on 16:9
    sw, sh = shot.size
    # center crop to ~ app column
    target_aspect = fw / fh
    src_aspect = sw / sh
    if src_aspect > target_aspect:
        new_w = int(sh * target_aspect)
        left = (sw - new_w) // 2
        shot = shot.crop((left, 0, left + new_w, sh))
    else:
        new_h = int(sw / target_aspect)
        top = max(0, (sh - new_h) // 6)  # bias upward to keep form
        shot = shot.crop((0, top, sw, min(sh, top + new_h)))

    shot = shot.resize((fw - 24, fh - 24), Image.Resampling.LANCZOS)
    img.paste(shot, (frame[0] + 12, frame[1] + 12))
    return save(img, name)


def build() -> None:
    audio = OUT / "YardFuel-Data-Capture.mp3"
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

    title = title_slide()
    mapping = callout_slide(
        "What gets captured",
        [
            "Asset / UnitID from TMT search",
            "Odometer and hour meter",
            "Employee and location context",
            "Primary fuel + other fluid line items",
            "Notes, then push or offline queue",
        ],
        "01-fields.png",
    )
    codes = callout_slide(
        "TMT fuel code mapping",
        [
            "DIESEL → DSL    GASOLINE → GAS    PROPANE → LPG",
            "DEF → DEF    OIL → OIL    ANTIFREEZE → AFRZ",
            "Each line becomes a FuelTicketDetails row",
            "ExternalReference keeps the client transaction ID",
        ],
        "02-codes.png",
    )
    close = close_slide()

    # Timeline aligned to narration cues (seconds)
    frames = [
        (0.0, 9.7, title),
        (9.7, 27.5, frame_capture(CAPTURES / "01-home-status.png", "Step 1", "Open YardFuel · confirm online status", "cap-01.png")),
        (27.5, 33.6, frame_capture(CAPTURES / "02-new-ticket.png", "Step 2", "Start a new fueling ticket", "cap-02.png")),
        (33.6, 43.0, frame_capture(CAPTURES / "03-asset-search.png", "Step 3", "Search asset by unit ID, plate, or description", "cap-03.png")),
        (43.0, 55.7, frame_capture(CAPTURES / "04-asset-selected.png", "Step 4", "Select TRK-1042 · Freightliner Cascadia", "cap-04.png")),
        (55.7, 76.8, frame_capture(CAPTURES / "05-meters-context.png", "Step 5", "Odometer 214900 · driver · North Yard Island 2", "cap-05.png")),
        (76.8, 91.9, mapping),
        (91.9, 118.5, frame_capture(CAPTURES / "06-primary-diesel.png", "Step 6", "Primary product: Diesel 48.2 gal @ $3.41", "cap-06.png")),
        (118.5, 132.3, frame_capture(CAPTURES / "07-def-line.png", "Step 7", "Other product: DEF 2.5 gallons", "cap-07.png")),
        (132.3, 139.4, frame_capture(CAPTURES / "08-oil-and-products.png", "Step 8", "Other product: Engine oil 4 quarts", "cap-08.png")),
        (139.4, 152.3, codes),
        (152.3, 165.9, frame_capture(CAPTURES / "09-notes-ready.png", "Step 9", "Notes: Pump 3 · pre-trip top-off", "cap-09.png")),
        (165.9, 178.4, frame_capture(CAPTURES / "10-submit-ready.png", "Step 10", "Submit — Push fuel ticket to TMT", "cap-10.png")),
        (178.4, 189.2, frame_capture(CAPTURES / "11-queue-synced.png", "Step 11", "Queue shows synced ticket and TMT ID", "cap-11.png")),
        (189.2, 205.4, frame_capture(CAPTURES / "12-queue-detail.png", "Step 12", "Review captured lines: diesel, DEF, oil", "cap-12.png")),
        (205.4, duration, close),
    ]

    segs = []
    for idx, (start, end, img_path) in enumerate(frames):
        seg_dur = max(0.25, end - start)
        seg = OUT / f"dc_seg_{idx:02d}.mp4"
        fade_out_start = max(0.0, seg_dur - 0.3)
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
                f"fade=t=in:st=0:d=0.25,fade=t=out:st={fade_out_start:.3f}:d=0.25,format=yuv420p",
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
        segs.append(seg)

    concat = OUT / "dc_concat.txt"
    concat.write_text("".join(f"file '{s}'\n" for s in segs))
    silent = OUT / "dc_silent.mp4"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat),
            "-c",
            "copy",
            str(silent),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    final = OUT / "YardFuel-Data-Capture.mp4"
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

    DOWNLOADS.mkdir(exist_ok=True)
    for name in ["YardFuel-Data-Capture.mp4", "YardFuel-Data-Capture.mp3"]:
        src = OUT / name
        (DOWNLOADS / name).write_bytes(src.read_bytes())

    print(f"VIDEO={final}")
    print(f"MP3={audio}")
    print(f"DURATION={duration}")


if __name__ == "__main__":
    build()
