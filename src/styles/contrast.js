// 색 대비 계산(WCAG 2.x 상대 휘도 공식). 강조 색 위 글씨가 읽히는지 테스트에서 확인하는 데 쓴다.

// '#RRGGBB' → 상대 휘도(0~1)
export function relativeLuminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`#RRGGBB 형식이 아니에요: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// 두 색의 대비(1~21). 순서는 상관없다.
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// tokens.css 글에서 [data-accent="…"] 묶음 11개를 읽어 { id: { accent, onAccent, accentStrong } }로 돌려준다.
export function parseAccents(css) {
  const accents = {};
  for (const m of css.matchAll(/\[data-accent="([\w-]+)"\]\s*\{([^}]*)\}/g)) {
    const pick = (name) => new RegExp(`--sv-${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(m[2])?.[1];
    accents[m[1]] = { accent: pick('accent'), onAccent: pick('on-accent'), accentStrong: pick('accent-strong') };
  }
  return accents;
}

// :root에 정의된 '#RRGGBB' 값 하나를 읽는다(예: 'paper' → --sv-paper).
export function rootColor(css, name) {
  return new RegExp(`--sv-${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css)?.[1];
}
