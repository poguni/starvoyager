"""예일 밝은 별 목록(Yale Bright Star Catalog 5판, CDS V/50)을 내려받아 밝은 별만 추린다.

실행: python -I scripts/fetch-stars.py
  - 원본은 stars-src/catalog.gz 로 내려받는다(저장소에 넣지 않음, .gitignore).
  - 결과는 src/data/stars.json: [별 번호(HR), 적경(도), 적위(도), 등급, 색 지수(B-V)] 목록.
  - 좌표는 J2000 그대로 쓴다(세차로 인한 차이는 화면에서 보이지 않을 만큼 작음).
"""
import gzip
import json
import pathlib
import urllib.request

URL = 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz'
MAG_LIMIT = 4.5
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'stars-src' / 'catalog.gz'
OUT = ROOT / 'src' / 'data' / 'stars.json'
# 별자리 선에 쓰는 별은 등급과 관계없이 넣는다(src/data/constellations.js와 같은 번호).
ALWAYS = {4301, 4295, 4554, 4660, 4905, 5054, 5191,   # 북두칠성
          21, 168, 264, 403, 542,                     # 카시오페이아자리
          424, 6789, 6322, 5903, 6116, 5735, 5563}    # 작은곰자리


def field(line, start, end):
    """ReadMe의 바이트 위치(1부터, 끝 포함)로 잘라 낸다."""
    return line[start - 1:end].strip()


def main():
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        print('내려받는 중:', URL)
        urllib.request.urlretrieve(URL, RAW)
    stars = []
    with gzip.open(RAW, 'rt', encoding='ascii', errors='replace') as f:
        for line in f:
            hr = field(line, 1, 4)
            ra_h, mag = field(line, 76, 77), field(line, 103, 107)
            if not hr or not ra_h or not mag:
                continue  # 좌표가 없는 항목(신성 등)
            hr, mag = int(hr), float(mag)
            if mag > MAG_LIMIT and hr not in ALWAYS:
                continue
            ra = (int(ra_h) + int(field(line, 78, 79)) / 60 + float(field(line, 80, 83)) / 3600) * 15
            dec = int(field(line, 85, 86)) + int(field(line, 87, 88)) / 60 + int(field(line, 89, 90)) / 3600
            if field(line, 84, 84) == '-':
                dec = -dec
            bv = field(line, 110, 114)
            stars.append([hr, round(ra, 4), round(dec, 4), mag, float(bv) if bv else 0.6])
    missing = ALWAYS - {s[0] for s in stars}
    if missing:
        raise SystemExit(f'별자리 별이 빠졌어요: {sorted(missing)}')
    OUT.write_text(json.dumps(stars, separators=(',', ':')), encoding='utf-8', newline='\n')
    print(f'{len(stars)}개 별 → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
