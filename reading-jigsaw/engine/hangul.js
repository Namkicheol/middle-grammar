// engine/hangul.js — 한글 자음 추출 (`전략` → `ㅈㄹ`)

const CHO = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
  'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
];

export function toConsonants(text) {
  let out = '';
  for (const ch of String(text || '')) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const idx = Math.floor((code - 0xAC00) / 588);
      out += CHO[idx];
    } else if (ch === ' ' || /[a-zA-Z0-9]/.test(ch)) {
      out += ch;
    } else if (ch === ',' || ch === '·' || ch === '.') {
      out += ch;
    }
    // 그 외(괄호 등) 무시
  }
  return out;
}
