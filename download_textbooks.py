"""
Download NCERT textbooks (English medium) for all subjects needed by Padhai Buddy.

Usage:
    python download_textbooks.py

Downloads into textbooks/ with folder structure matching ingest.py expectations:
    textbooks/class-x-science/jesc101.pdf ... jesc113.pdf
    textbooks/class-x-maths/jemh101.pdf ... jemh114.pdf
    etc.
"""

import os
import time
import requests
from pathlib import Path

BASE_URL = "https://ncert.nic.in/textbook/pdf"
OUTPUT_DIR = "textbooks"

# English-medium books only, extracted from NCERT site
# Format: (folder_name, book_code, first_chapter, last_chapter)
BOOKS = [
    # Class X
    ("class-x-maths", "jemh1", 1, 14),
    ("class-x-science", "jesc1", 1, 13),
    ("class-x-social-science", "jess1", 1, 7),    # Contemporary India (Geography)
    ("class-x-social-science", "jess2", 1, 5),    # Understanding Economic Development
    ("class-x-social-science", "jess3", 1, 5),    # India and the Contemporary World (History)
    ("class-x-social-science", "jess4", 1, 5),    # Democratic Politics
    ("class-x-english", "jeff1", 1, 9),            # First Flight
    ("class-x-english", "jefp1", 1, 9),            # Footprints Without Feet

    # Class XI
    ("class-xi-maths", "kemh1", 1, 14),
    ("class-xi-physics", "keph1", 1, 7),           # Part I
    ("class-xi-physics", "keph2", 1, 7),           # Part II
    ("class-xi-chemistry", "kech1", 1, 6),         # Part I
    ("class-xi-chemistry", "kech2", 1, 3),         # Part II
    ("class-xi-english", "kehb1", 1, 14),          # Hornbill
    ("class-xi-english", "kesp1", 1, 5),           # Snapshots
    ("class-xi-history", "kehs1", 1, 7),           # Themes in World History

    # Class XII
    ("class-xii-maths", "lemh1", 1, 6),            # Part I
    ("class-xii-maths", "lemh2", 1, 7),            # Part II
    ("class-xii-physics", "leph1", 1, 8),          # Part I
    ("class-xii-physics", "leph2", 1, 6),          # Part II
    ("class-xii-chemistry", "lech1", 1, 5),        # Part I
    ("class-xii-chemistry", "lech2", 1, 5),        # Part II
    ("class-xii-english", "lefl1", 1, 13),         # Flamingo
    ("class-xii-english", "levt1", 1, 6),          # Vistas
    ("class-xii-history", "lehs1", 1, 4),          # Themes in Indian History I
    ("class-xii-history", "lehs2", 1, 4),          # Themes in Indian History II
    ("class-xii-history", "lehs3", 1, 4),          # Themes in Indian History III
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def download_file(url, path):
    resp = requests.get(url, headers=HEADERS, timeout=30)
    if resp.status_code == 200 and len(resp.content) > 1000:
        path.write_bytes(resp.content)
        return True
    return False


def main():
    root = Path(OUTPUT_DIR)
    root.mkdir(exist_ok=True)

    total = sum(last - first + 1 for _, _, first, last in BOOKS)
    downloaded = 0
    skipped = 0
    failed = 0

    print(f"Downloading NCERT textbooks ({total} chapters across {len(BOOKS)} books)\n")

    for folder, code, first_ch, last_ch in BOOKS:
        folder_path = root / folder
        folder_path.mkdir(exist_ok=True)

        for ch in range(first_ch, last_ch + 1):
            ch_str = f"{ch:02d}"
            filename = f"{code}{ch_str}.pdf"
            filepath = folder_path / filename
            url = f"{BASE_URL}/{filename}"

            if filepath.exists():
                skipped += 1
                continue

            print(f"  [{downloaded + skipped + failed + 1}/{total}] {folder}/{filename}...", end=" ", flush=True)

            try:
                if download_file(url, filepath):
                    size_kb = filepath.stat().st_size // 1024
                    print(f"OK ({size_kb} KB)")
                    downloaded += 1
                else:
                    print("SKIP (not found)")
                    failed += 1
            except Exception as e:
                print(f"FAIL ({e})")
                failed += 1

            time.sleep(0.3)

    print(f"\nDone! Downloaded: {downloaded}, Already existed: {skipped}, Failed: {failed}")
    print(f"Total chapters on disk: {downloaded + skipped}")
    print(f"\nNext step: python ingest.py --pdf_dir textbooks/")


if __name__ == "__main__":
    main()
