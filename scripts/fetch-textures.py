"""행성·태양 질감을 원본에서 내려받아 앱에서 쓰는 크기로 만든다(CREDITS.md, docs/결정기록.md 2026-10-07).

- 원본은 textures-src/에 내려받아 두고(git에 올리지 않음), public/textures/<크기>/에 결과만 만든다.
- Solar System Scope 질감(CC BY 4.0)은 Wikimedia Commons에 올라온 같은 파일에서 받는다.
- 지구·달은 달빛 관측소(../MoonLab/public/textures)의 NASA 질감을 쓴다.

사용법(프로젝트 폴더에서):
    pip install pillow
    python scripts/fetch-textures.py            # 1k 만들기
    python scripts/fetch-textures.py 1k 2k 4k   # 여러 크기
"""
import json
import shutil
import sys
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "textures-src"
OUT_DIR = ROOT / "public" / "textures"
MOONLAB = ROOT.parent / "MoonLab" / "public" / "textures"
UA = {"User-Agent": "StarVoyager-edu/0.1 (elementary school science web app)"}

# 앱 파일 이름 → 원본(Commons 파일 이름 또는 MoonLab 파일)
COMMONS = {
    "sun.jpg": "Solarsystemscope texture 8k sun.jpg",
    "mercury.jpg": "Solarsystemscope texture 8k mercury.jpg",
    "venus.jpg": "Solarsystemscope texture 4k venus atmosphere.jpg",
    "mars.jpg": "Solarsystemscope texture 8k mars.jpg",
    "jupiter.jpg": "Solarsystemscope texture 8k jupiter.jpg",
    "saturn.jpg": "Solarsystemscope texture 8k saturn.jpg",
    "saturn_ring.png": "Solarsystemscope texture 8k saturn ring alpha.png",
    "uranus.jpg": "Solarsystemscope texture 2k uranus.jpg",
    "neptune.jpg": "Solarsystemscope texture 2k neptune.jpg",
}
LOCAL = {
    "earth.jpg": MOONLAB / "earth_day.jpg",
    "moon.jpg": MOONLAB / "moon_color.jpg",
}
WIDTHS = {"1k": 1024, "2k": 2048, "4k": 4096}


def commons_url(title):
    q = urllib.parse.urlencode({"action": "query", "titles": f"File:{title}", "prop": "imageinfo",
                                "iiprop": "url", "format": "json"})
    with urllib.request.urlopen(urllib.request.Request(f"https://commons.wikimedia.org/w/api.php?{q}", headers=UA)) as r:
        page = next(iter(json.load(r)["query"]["pages"].values()))
    return page["imageinfo"][0]["url"]


def download(url, path):
    # Commons는 요청이 몰리면 429를 돌려주므로, 기다렸다가 몇 번 다시 시도한다.
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r, open(path, "wb") as f:
                shutil.copyfileobj(r, f)
            return
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 15 * (attempt + 1)
            print(f"  요청이 많아 {wait}초 기다려요")
            time.sleep(wait)


def source_path(name):
    if name in LOCAL:
        return LOCAL[name]
    title = COMMONS[name]
    path = SRC_DIR / title.replace(" ", "_")
    if not path.exists():
        SRC_DIR.mkdir(exist_ok=True)
        print(f"내려받는 중: {title}")
        tmp = path.with_suffix(path.suffix + ".part")
        download(commons_url(title), tmp)
        tmp.rename(path)
        time.sleep(3)
    return path


def make(name, size):
    width = WIDTHS[size]
    src = Image.open(source_path(name))
    out = OUT_DIR / size / name
    out.parent.mkdir(parents=True, exist_ok=True)
    if name == "saturn_ring.png":
        # 고리 질감은 가로(안쪽→바깥쪽)만 의미가 있어 세로는 64px로 줄인다.
        img = src.convert("RGBA").resize((width, 64), Image.LANCZOS)
        img.save(out, optimize=True)
    else:
        w = min(width, src.width)  # 원본보다 크게 늘리지 않는다(천왕성·해왕성은 2K가 최대).
        img = src.convert("RGB").resize((w, w // 2), Image.LANCZOS)
        img.save(out, quality=88, optimize=True, progressive=True)
    print(f"{out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB")


def main():
    sizes = sys.argv[1:] or ["1k"]
    for size in sizes:
        for name in [*COMMONS, *LOCAL]:
            make(name, size)


if __name__ == "__main__":
    main()
