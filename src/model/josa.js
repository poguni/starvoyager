// 한국어 조사 '으로/로' 고르기. 받침이 없거나 받침이 ㄹ이면 '로', 그 밖의 받침이면 '으로'.
// 예: 화성으로, 지구로, 달로, 태양계 지도로
export function euro(word) {
  const last = word.trim().at(-1);
  const code = last ? last.charCodeAt(0) - 0xac00 : -1;
  if (code < 0 || code > 11171) return '로'; // 한글 완성형이 아니면 '로'
  const jong = code % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}

export function withEuro(word) {
  return word + euro(word);
}
