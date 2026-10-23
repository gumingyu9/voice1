// 표기 → 표준 발음 (표준 발음법의 음절 경계 규칙). 형태소 분석 없이 음절 단위로만 판단하므로
// 사이시옷·ㄴ첨가·한자어 경음화처럼 단어 구조를 알아야 하는 규칙은 다루지 않는다.
// 어떤 규칙이 어디에 적용됐는지 기록해 화면에서 "왜 이렇게 발음되는가"를 보여준다.

import { compose, decompose, isHangulSyllable, type Syllable } from './hangul.ts'

export type RuleId =
  | 'liaison'
  | 'coda_neutralization'
  | 'cluster_simplification'
  | 'nasalization'
  | 'liquid_nasalization'
  | 'lateralization'
  | 'tensification'
  | 'aspiration'
  | 'h_deletion'
  | 'palatalization'
  | 'ui'
  | 'glide_deletion'

export const RULE_INFO: Record<RuleId, { name: string; desc: string }> = {
  liaison: { name: '연음', desc: '받침 뒤에 모음이 오면 받침이 다음 음절의 첫소리로 넘어간다.' },
  coda_neutralization: { name: '받침 중화', desc: '받침 자리에서는 ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ 일곱 소리만 난다. 혀나 입술로 막기만 하고 터뜨리지 않기 때문.' },
  cluster_simplification: { name: '자음군 단순화', desc: '겹받침은 자음 앞이나 말끝에서 둘 중 하나만 소리 난다.' },
  nasalization: { name: '비음화', desc: '막히는 소리(ㄱ ㄷ ㅂ)가 콧소리(ㄴ ㅁ) 앞에서 같은 자리의 콧소리(ㅇ ㄴ ㅁ)로 바뀐다. 연구개가 미리 내려가기 때문.' },
  liquid_nasalization: { name: 'ㄹ의 비음화', desc: 'ㅁ ㅇ ㄱ ㅂ 받침 뒤의 ㄹ이 ㄴ으로 바뀐다.' },
  lateralization: { name: '유음화', desc: 'ㄴ과 ㄹ이 만나면 둘 다 ㄹ로 소리 난다. 혀끝을 붙인 채 옆으로 흘리는 소리로 통일.' },
  tensification: { name: '경음화', desc: '막히는 받침 뒤의 ㄱ ㄷ ㅂ ㅅ ㅈ이 된소리가 된다. 성대가 긴장된 채로 다음 소리를 시작하기 때문.' },
  aspiration: { name: '격음화', desc: 'ㅎ과 ㄱ ㄷ ㅂ ㅈ이 만나 거센소리(ㅋ ㅌ ㅍ ㅊ)로 합쳐진다.' },
  h_deletion: { name: 'ㅎ 탈락', desc: 'ㅎ 받침 뒤에 모음이 오면 ㅎ이 소리 나지 않는다.' },
  palatalization: { name: '구개음화', desc: 'ㄷ ㅌ 받침이 모음 ㅣ 앞에서 ㅈ ㅊ이 된다. 혀가 ㅣ를 위해 미리 입천장 쪽으로 올라가기 때문.' },
  ui: { name: 'ㅢ 발음', desc: '자음 뒤의 ㅢ는 [ㅣ]로 발음한다.' },
  glide_deletion: { name: '반모음 탈락', desc: 'ㅈ ㅉ ㅊ 뒤의 ㅕ는 [ㅓ]로 발음한다.' },
}

export interface RuleApplication {
  rule: RuleId
  word: number // 단어 번호
  at: number // 단어 안 음절 번호 (경계 규칙은 앞 음절)
  before: string
  after: string
}

export type Token = { type: 'word'; written: string; syllables: Syllable[] } | { type: 'punct'; ch: string }

export interface G2PResult {
  tokens: Token[]
  pronunciation: string
  rules: RuleApplication[]
}

const LAX_OBSTRUENT: Record<string, string> = { ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' }
const NEUTRAL: Record<string, string> = { ㄲ: 'ㄱ', ㅋ: 'ㄱ', ㅅ: 'ㄷ', ㅆ: 'ㄷ', ㅈ: 'ㄷ', ㅊ: 'ㄷ', ㅌ: 'ㄷ', ㅎ: 'ㄷ', ㅍ: 'ㅂ' }
/** 겹받침: [자음 앞·말끝에서 남는 것, 모음 앞에서 남는 것, 다음 음절로 넘어가는 것] */
const CLUSTERS: Record<string, [string, string, string]> = {
  ㄳ: ['ㄱ', 'ㄱ', 'ㅆ'],
  ㄵ: ['ㄴ', 'ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㄴ', 'ㅎ'],
  ㄺ: ['ㄱ', 'ㄹ', 'ㄱ'],
  ㄻ: ['ㅁ', 'ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㄹ', 'ㅆ'],
  ㄾ: ['ㄹ', 'ㄹ', 'ㅌ'],
  ㄿ: ['ㅂ', 'ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅂ', 'ㅆ'],
}
const NASAL_OF: Record<string, string> = { ㄱ: 'ㅇ', ㄷ: 'ㄴ', ㅂ: 'ㅁ' }
const ASPIRATED_OF: Record<string, string> = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅂ: 'ㅍ', ㅈ: 'ㅊ' }

const show = (...s: Syllable[]) => s.map(compose).join('')

/** 겹받침의 자음 앞·말끝 형태 ('밟-' 은 예외로 ㅂ) */
function simplifyCluster(s: Syllable, next: Syllable | null): string {
  if (s.coda === 'ㄼ' && s.onset === 'ㅂ' && s.nucleus === 'ㅏ') return 'ㅂ'
  if (s.coda === 'ㄺ' && next?.onset === 'ㄱ') return 'ㄹ' // 맑게 → [말께]
  return CLUSTERS[s.coda][0]
}

class WordProcessor {
  rules: RuleApplication[] = []
  private s: Syllable[]
  private wordIndex: number

  constructor(s: Syllable[], wordIndex: number) {
    this.s = s
    this.wordIndex = wordIndex
  }

  /** 한 단계 실행 후 바뀌었으면 기록 */
  private step(rule: RuleId, i: number, fn: () => void): void {
    const span = this.s.slice(i, i + 2)
    const before = show(...span)
    fn()
    const after = show(...span)
    if (before !== after) this.rules.push({ rule, word: this.wordIndex, at: i, before, after })
  }

  run(): Syllable[] {
    const s = this.s
    for (let i = 0; i < s.length; i++) {
      const a = s[i]
      const b = i + 1 < s.length ? s[i + 1] : null
      if (b) this.boundary(i, a, b)
      else this.wordFinal(i, a)
    }
    for (let i = 0; i < s.length; i++) {
      const x = s[i]
      if (x.nucleus === 'ㅢ' && x.onset !== '') this.step('ui', i, () => (x.nucleus = 'ㅣ'))
      if (x.nucleus === 'ㅕ' && (x.onset === 'ㅈ' || x.onset === 'ㅉ' || x.onset === 'ㅊ')) this.step('glide_deletion', i, () => (x.nucleus = 'ㅓ'))
    }
    return s
  }

  private wordFinal(i: number, a: Syllable): void {
    if (CLUSTERS[a.coda]) this.step('cluster_simplification', i, () => (a.coda = simplifyCluster(a, null)))
    if (NEUTRAL[a.coda]) this.step('coda_neutralization', i, () => (a.coda = NEUTRAL[a.coda]))
  }

  private boundary(i: number, a: Syllable, b: Syllable): void {
    if (!a.coda) return
    const hasH = a.coda === 'ㅎ' || a.coda === 'ㄶ' || a.coda === 'ㅀ'
    const withoutH = a.coda === 'ㄶ' ? 'ㄴ' : a.coda === 'ㅀ' ? 'ㄹ' : ''

    // ── ㅎ 받침 ──
    if (hasH) {
      if (ASPIRATED_OF[b.onset] && b.onset !== 'ㅂ') {
        this.step('aspiration', i, () => {
          b.onset = ASPIRATED_OF[b.onset]
          a.coda = withoutH
        })
      } else if (b.onset === 'ㅅ') {
        this.step('tensification', i, () => {
          b.onset = 'ㅆ'
          a.coda = withoutH
        })
      } else if (b.onset === '') {
        this.step('h_deletion', i, () => (a.coda = withoutH))
      } else if (b.onset === 'ㄴ') {
        this.step(a.coda === 'ㅎ' ? 'nasalization' : 'h_deletion', i, () => (a.coda = withoutH || 'ㄴ'))
      }
      if (!a.coda) return
    }

    // ── 뒤 음절이 ㅎ 으로 시작: 앞 받침의 막힘소리와 합쳐 거센소리 ──
    if (b.onset === 'ㅎ') {
      const cluster = CLUSTERS[a.coda]
      const obstruent = cluster ? cluster[2] : a.coda
      const stays = cluster ? cluster[1] : ''
      const base = obstruent === 'ㅈ' ? 'ㅈ' : NEUTRAL[obstruent] ?? obstruent
      if (ASPIRATED_OF[base] && (!cluster || ['ㄺ', 'ㄼ', 'ㄵ'].includes(a.coda))) {
        this.step('aspiration', i, () => {
          b.onset = ASPIRATED_OF[base]
          a.coda = stays
        })
        if ((b.onset as string) === 'ㅌ' && b.nucleus === 'ㅣ') this.step('palatalization', i, () => (b.onset = 'ㅊ'))
        return
      }
    }

    // ── 모음 앞: 연음 (구개음화 포함) ──
    if (b.onset === '') {
      if (a.coda === 'ㅇ') return
      const cluster = CLUSTERS[a.coda]
      const moving = cluster ? cluster[2] : a.coda
      const stays = cluster ? cluster[1] : ''
      if ((moving === 'ㄷ' || moving === 'ㅌ') && b.nucleus === 'ㅣ') {
        this.step('palatalization', i, () => {
          b.onset = moving === 'ㄷ' ? 'ㅈ' : 'ㅊ'
          a.coda = stays
        })
      } else {
        this.step('liaison', i, () => {
          b.onset = moving
          a.coda = stays
        })
      }
      return
    }

    // ── 자음 앞 ──
    const wasCluster = !!CLUSTERS[a.coda]
    if (wasCluster) this.step('cluster_simplification', i, () => (a.coda = simplifyCluster(a, b)))
    if (NEUTRAL[a.coda]) this.step('coda_neutralization', i, () => (a.coda = NEUTRAL[a.coda]))

    // 막힘 받침(또는 겹받침) 뒤 예사소리 → 된소리
    if (LAX_OBSTRUENT[b.onset] && (wasCluster || NASAL_OF[a.coda])) {
      this.step('tensification', i, () => (b.onset = LAX_OBSTRUENT[b.onset]))
    }

    if (b.onset === 'ㄹ') {
      if (a.coda === 'ㄴ') this.step('lateralization', i, () => (a.coda = 'ㄹ'))
      else if (a.coda !== 'ㄹ') this.step('liquid_nasalization', i, () => (b.onset = 'ㄴ'))
    } else if (a.coda === 'ㄹ' && b.onset === 'ㄴ') {
      this.step('lateralization', i, () => (b.onset = 'ㄹ'))
    }

    if (NASAL_OF[a.coda] && (b.onset === 'ㄴ' || b.onset === 'ㅁ')) {
      this.step('nasalization', i, () => (a.coda = NASAL_OF[a.coda]))
    }
  }
}

/** 정규화된 텍스트(한글·공백·문장부호) → 발음 */
export function g2p(text: string): G2PResult {
  const tokens: Token[] = []
  let cur: string[] = []
  const flush = () => {
    if (cur.length) tokens.push({ type: 'word', written: cur.join(''), syllables: cur.map(decompose) })
    cur = []
  }
  for (const ch of text) {
    if (isHangulSyllable(ch)) cur.push(ch)
    else {
      flush()
      if ('.,?!'.includes(ch)) tokens.push({ type: 'punct', ch })
    }
  }
  flush()

  const rules: RuleApplication[] = []
  let w = 0
  for (const t of tokens) {
    if (t.type !== 'word') continue
    const p = new WordProcessor(t.syllables, w++)
    p.run()
    rules.push(...p.rules)
  }
  const pronunciation = tokens
    .filter((t): t is Extract<Token, { type: 'word' }> => t.type === 'word')
    .map((t) => show(...t.syllables))
    .join(' ')
  return { tokens, pronunciation, rules }
}

export function pronounce(text: string): string {
  return g2p(text).pronunciation
}
