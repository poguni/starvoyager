"""Pretendard 가변 글꼴을 앱에 필요한 글자만 남긴 하위 집합으로 줄인다(docs/결정기록.md 2026-10-07).

남기는 글자
- KS X 1001 한글 완성형 2,350자(학생 이름 입력에도 대부분의 글자가 들어 있음)
- 한글 호환 자모(ㄱ~ㅣ, 입력 중 조합 글자)
- 영문·숫자·기본 기호, 화면에 쓰는 문장 부호와 기호(· … — → × ① 등)
그 밖의 글자는 tokens.css의 다음 글꼴(시스템 글꼴)로 보인다.

사용법(프로젝트 폴더에서):
    pip install fonttools brotli
    python scripts/subset-fonts.py
"""
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "fonts" / "PretendardVariable.woff2"
OUT = ROOT / "src" / "assets" / "fonts" / "PretendardVariable.subset.woff2"


def ks_x_1001_hangul():
    # EUC-KR의 한글 영역(첫 바이트 0xB0~0xC8, 둘째 바이트 0xA1~0xFE)이 KS X 1001 완성형 2,350자다.
    chars = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            chars.append(bytes([hi, lo]).decode("euc-kr"))
    return chars


def codepoints():
    cps = set(ord(c) for c in ks_x_1001_hangul())
    cps.update(range(0x3131, 0x318F))  # 한글 호환 자모
    cps.update(range(0x20, 0x7F))      # 영문·숫자·기본 기호
    cps.update(range(0xA0, 0x100))     # 라틴-1 기호(·, ×, ° 등)
    cps.update(range(0x2010, 0x2070))  # 문장 부호(– — ‘ ’ “ ” … ※ 등)
    cps.update(range(0x2190, 0x2200))  # 화살표
    cps.update(range(0x2460, 0x2500))  # 동그라미 숫자(①~⑳)
    cps.update(range(0x25A0, 0x2600))  # 도형(■ □ ▲ ▶ ◀ ○ ● 등)
    cps.update(range(0x3000, 0x3040))  # 한중일 기호(「 」 『 』 〈 〉 등)
    cps.update([0x2713, 0x2715, 0x2605, 0x2606])  # ✓ ✕ ★ ☆
    return sorted(cps)


def main():
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    font = subset.load_font(str(SRC), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints())
    subsetter.subset(font)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUT), options)
    print(f"{SRC.name} {SRC.stat().st_size // 1024} KB -> {OUT.name} {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
