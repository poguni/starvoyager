// '학생용 QR 코드'가 가리킬 주소: 지금 열린 주소에서 `?` 설정(시연 모드·탐사 번호 등)과 `#`을 뺀 기본 주소.
// 학생이 스캔하면 항상 일반 등록 화면이 열린다.
export function entryUrl(href) {
  const url = new URL(href);
  return `${url.origin}${url.pathname}`;
}
