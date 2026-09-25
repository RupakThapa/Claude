#!/usr/bin/env python3
"""
Download the site's stock photos from Unsplash and build every size the pages use.

    pip install pillow
    python3 _tools/fetch-images.py            # run from the site root

For each photo it writes, into assets/img/:
    <name>-1600.webp   1600x1067, used in srcset
    <name>-800.webp     800x533,  default src
and into assets/img/og/:
    <og>.jpg           1200x630 Open Graph / Twitter card image

It also rewrites assets/img/credits.txt. All photos are published under the
Unsplash License (free for commercial use, no permission needed). Look at each
photo after downloading: if one isn't candid, natural-light and on-brand, swap
its id below for another and re-run. Update the alt text in the HTML to match.

This folder (_tools) is not needed on the web host.
"""
import io
import os
import sys
import urllib.request

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required: pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
OG = os.path.join(IMG, "og")

# name, unsplash photo id, og file name, page, photographer, focal point (x, y) for cropping
PHOTOS = [
    ("home-remote-admin", "0dF7UzD2Yd8", "home", "index.html", "Elen Sher", (0.5, 0.45)),
    ("solutions-remote-admin", "0AVtGrvGIAE", "solutions", "solutions.html", "B Y G", (0.5, 0.45)),
    ("insurance-verification-desk", "eVXadjUva8Y", "insurance-verification", "insurance-verification.html", "B Y G", (0.5, 0.45)),
    ("prior-authorization-chart", "8WYkI3cEZm8", "prior-authorization", "prior-authorization.html", "Vitaly Gariev", (0.5, 0.5)),
    ("virtual-medical-assistant-headset", "-OaLxfTSIww", "virtual-medical-assistant", "virtual-medical-assistant.html", "Vitaly Gariev", (0.5, 0.4)),
    ("referral-coordination-consult", "TFJw-mTWw_U", "referral-management", "referral-management.html", "National Cancer Institute", (0.5, 0.45)),
    ("medical-billing-calculator", "xoU52jUVUXA", "medical-billing-support", "medical-billing-support.html", "Kelly Sikkema", (0.5, 0.5)),
    ("about-team-documents", "wR56AUlEsE4", "about", "about.html", "Andreea Avramescu", (0.5, 0.45)),
    ("insights-notebook-stethoscope", "u2EjDa_hYJI", "insights", "insights.html", "Abdulai Sayni", (0.5, 0.5)),
    ("contact-discovery-call", "egCFrNJ6Djw", "contact", "contact.html", "Vitaly Gariev", (0.5, 0.4)),
    ("article-clinic-reception", "27zLImvxwV0", "article-front-desk-denials", "claim-denials-start-at-the-front-desk.html", "Malcolm Choong", (0.5, 0.5)),
    ("article-clipboard-notes", "xDNwySMfR5I", "article-prior-auth-log", "prior-auth-tracking-log.html", "Vitaly Gariev", (0.5, 0.45)),
    ("article-practice-paperwork", "ZH4FUYiaczY", "article-outsourcing-checklist", "outsourcing-front-office-checklist.html", "Dimitri Karastelev", (0.5, 0.45)),
]

MAX_BYTES = 200 * 1024


def fetch(photo_id):
    url = f"https://unsplash.com/photos/{photo_id}/download?force=true"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (site asset script)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")


def save_webp(im, path):
    for q in range(82, 49, -4):
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= MAX_BYTES or q <= 50:
            with open(path, "wb") as f:
                f.write(buf.getvalue())
            return q, buf.tell()


def main():
    os.makedirs(OG, exist_ok=True)
    credits = [
        "Photo credits",
        "=============",
        "All photos: Unsplash License (https://unsplash.com/license). Free to use, attribution appreciated.",
        "",
    ]
    for name, pid, og, page, who, focus in PHOTOS:
        print(f"{name}: downloading {pid} ...", flush=True)
        src = fetch(pid)
        big = ImageOps.fit(src, (1600, 1067), Image.LANCZOS, centering=focus)
        q1, b1 = save_webp(big, os.path.join(IMG, f"{name}-1600.webp"))
        q2, b2 = save_webp(big.resize((800, 533), Image.LANCZOS), os.path.join(IMG, f"{name}-800.webp"))
        card = ImageOps.fit(src, (1200, 630), Image.LANCZOS, centering=focus)
        card.save(os.path.join(OG, f"{og}.jpg"), "JPEG", quality=82, optimize=True, progressive=True)
        print(f"  1600: {b1 // 1024} KB (q{q1})   800: {b2 // 1024} KB (q{q2})   og: {og}.jpg")
        credits += [
            f"{name}-1600.webp / {name}-800.webp / og/{og}.jpg",
            f"  Used on:      {page}",
            f"  Photographer: {who}",
            f"  Source:       https://unsplash.com/photos/{pid}",
            "",
        ]
    with open(os.path.join(IMG, "credits.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(credits))
    print("Done. credits.txt updated.")


if __name__ == "__main__":
    main()
