// 한글 음절 ↔ 자모 분해/조합. 유니코드 음절 = 0xAC00 + (초성×21 + 중성)×28 + 종성

export const ONSETS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
export const NUCLEI = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
export const CODAS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

/** 초성이 없는 음절(ㅇ)은 onset = '' 로 표현한다 */
export interface Syllable {
  onset: string
  nucleus: string
  coda: string
}

const BASE = 0xac00
const LAST = 0xd7a3

export function isHangulSyllable(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return c >= BASE && c <= LAST
}

export function decompose(ch: string): Syllable {
  const i = ch.charCodeAt(0) - BASE
  const onset = ONSETS[Math.floor(i / 588)]
  return {
    onset: onset === 'ㅇ' ? '' : onset,
    nucleus: NUCLEI[Math.floor((i % 588) / 28)],
    coda: CODAS[i % 28],
  }
}

export function compose(s: Syllable): string {
  const o = ONSETS.indexOf(s.onset === '' ? 'ㅇ' : s.onset)
  const n = NUCLEI.indexOf(s.nucleus)
  const c = CODAS.indexOf(s.coda)
  if (o < 0 || n < 0 || c < 0) throw new Error(`조합 불가: ${JSON.stringify(s)}`)
  return String.fromCharCode(BASE + (o * 21 + n) * 28 + c)
}
