// 음성 세그먼트(소리 단위) → 화면용 한국어 설명·색·연결 파라미터

import type { Laryngeal, ObstruentPhases, Place, SegKind } from '../engine/ko/phonetics'
import type { TimedSegment } from '../engine/speech/plan'

export const KIND_LABEL: Record<SegKind, string> = {
  vowel: '모음',
  glide: '반모음',
  stop: '파열음',
  affricate: '파찰음',
  fricative: '마찰음',
  nasal: '비음',
  liquid: '유음',
  h: 'ㅎ',
  pause: '쉼',
}

/** 범례 순서 */
export const KIND_ORDER: SegKind[] = ['vowel', 'glide', 'stop', 'affricate', 'fricative', 'nasal', 'liquid', 'h', 'pause']

/** 소리 단위를 눌렀을 때 선택되는 파라미터 */
export const PARAM_FOR_KIND: Record<SegKind, string> = {
  stop: 'consonantForce',
  affricate: 'consonantForce',
  fricative: 'sibilance',
  h: 'consonantForce',
  nasal: 'nasality',
  vowel: 'articulation',
  glide: 'articulation',
  liquid: 'articulation',
  pause: 'breathGroup',
}

const LAR: Record<Laryngeal, string> = { lax: '예사소리', tense: '된소리', asp: '거센소리' }
const PLACE_NAME: Record<Place, string> = { lab: '입술소리', alv: '혀끝소리', pal: '입천장소리', vel: '연구개소리', glot: '목청소리' }
const PLACE_WHERE: Record<Place, string> = {
  lab: '두 입술',
  alv: '혀끝과 윗잇몸',
  pal: '혓바닥과 센입천장',
  vel: '혀뿌리와 여린입천장',
  glot: '목청',
}

const VOWEL_NOTE: Record<string, string> = {
  a: '입을 크게 벌리고 혀를 낮춤',
  e: '입을 중간쯤 벌리고 혀를 앞쪽에 둠',
  ʌ: '입을 중간쯤 벌리고 혀를 뒤쪽에 둠',
  o: '입술을 둥글게 오므리고 혀를 뒤쪽 중간 높이에 둠',
  u: '입술을 둥글게 내밀고 혀를 뒤쪽 높이 올림',
  ɯ: '입술을 편 채 혀를 뒤쪽 높이 올림',
  i: '입술을 펴고 혀를 앞쪽 높이 올림',
}
const GLIDE_NOTE: Record<string, string> = {
  j: 'ㅣ 자세에서 출발해 다음 모음으로 미끄러짐',
  w: 'ㅜ 자세(입술 둥글게)에서 출발해 다음 모음으로 미끄러짐',
  ɥ: '입술은 둥글게, 혀는 앞쪽 높이에서 출발해 ㅣ로 미끄러짐',
  ɰ: 'ㅡ 자세에서 출발해 ㅣ로 미끄러짐',
}
const PAUSE_NOTE: Record<string, string> = {
  comma: '쉼표 — 짧게 쉬며 소리를 이어 감',
  period: '문장 끝 — 소리를 멈추고 숨을 쉼',
  question: '물음표 — 문장 끝을 올리고 쉼',
  exclaim: '느낌표 — 문장 끝을 힘 있게 맺고 쉼',
  breath: '호흡 단위를 넘어 단어 사이에서 숨을 쉼',
}

export interface PhasePart {
  key: keyof ObstruentPhases
  label: string
  ms: number
}

export interface SegDescription {
  title: string
  tags: string[]
  note: string
  ms: number
  phases: PhasePart[]
}

const PHASE_LABEL: Record<keyof ObstruentPhases, string> = { closure: '막힘', burst: '터짐', fric: '마찰', asp: '숨(기식)' }

function phaseParts(s: TimedSegment): PhasePart[] {
  const p = s.phases
  if (!p) return []
  // 받침 파열음은 터뜨리지 않으므로 막힘만 보여 준다
  const keys = s.position === 'coda' ? (['closure'] as const) : (['closure', 'burst', 'fric', 'asp'] as const)
  return keys
    .filter((k) => p[k] > 0.4)
    .map((k) => ({ key: k, label: PHASE_LABEL[k], ms: Math.round(p[k]) }))
}

export function describeSegment(s: TimedSegment): SegDescription {
  const ms = Math.round(s.end - s.start)
  const lar = s.lar ? LAR[s.lar] : ''
  const place = s.place ? PLACE_NAME[s.place] : ''
  const where = s.place ? PLACE_WHERE[s.place] : ''
  const coda = s.position === 'coda'
  const base = { ms, phases: phaseParts(s) }
  const title = `${s.jamo} → [${s.ipa}]`
  switch (s.kind) {
    case 'pause':
      return { ...base, title: '쉼', tags: ['쉼'], note: PAUSE_NOTE[s.pause ?? 'period'] }
    case 'vowel':
      return { ...base, title, tags: ['모음', '목소리가 가장 크고 길게 나는 부분'], note: VOWEL_NOTE[s.vowel ?? 'a'] }
    case 'glide':
      return { ...base, title: `${s.jamo}의 앞부분 → [${s.ipa}]`, tags: ['반모음'], note: GLIDE_NOTE[s.ipa] ?? GLIDE_NOTE.j }
    case 'stop':
      if (coda) {
        return { ...base, title, tags: ['파열음', '받침', place], note: `받침 — ${where}을 막기만 하고 터뜨리지 않음` }
      }
      return {
        ...base,
        title,
        tags: ['파열음', lar, place],
        note: s.voiced
          ? '모음 사이라 성대가 울림(유성음화)'
          : s.lar === 'tense'
            ? `${where}을 꽉 막았다가 숨 없이 터뜨림 — 성대가 긴장`
            : s.lar === 'asp'
              ? `${where}을 막았다 터뜨린 뒤 센 숨이 길게 나옴`
              : `${where}을 막았다 터뜨린 뒤 약한 숨이 나옴`,
      }
    case 'affricate':
      return {
        ...base,
        title,
        tags: ['파찰음', lar, place],
        note: s.voiced ? '모음 사이라 성대가 울림(유성음화)' : `${where}을 막았다가 좁은 틈으로 천천히 터뜨림 (파열 + 마찰)`,
      }
    case 'fricative':
      return {
        ...base,
        title,
        tags: ['마찰음', lar, place],
        note:
          s.place === 'pal'
            ? 'ㅣ 앞이라 입천장 쪽에서 남'
            : s.lar === 'tense'
              ? `${where} 사이 좁은 틈으로 숨을 세고 길게 갈아냄`
              : `${where} 사이 좁은 틈으로 숨을 갈아냄`,
      }
    case 'h':
      return {
        ...base,
        title,
        tags: ['ㅎ', '목청소리'],
        note: s.voiced ? '모음 사이라 목소리가 섞여 [ɦ]로 약해짐' : '목청 사이로 숨만 흘러나옴',
      }
    case 'nasal':
      return {
        ...base,
        title,
        tags: coda ? ['비음', '받침', place] : ['비음', place],
        note: `${where}을 막고 코로 소리를 내보냄`,
      }
    case 'liquid':
      return {
        ...base,
        title,
        tags: coda ? ['유음', '받침'] : ['유음'],
        note: s.flap ? '[ɾ] 혀끝을 한 번 튕김' : coda ? '[l] 받침 — 혀끝을 붙인 채 혀 옆으로 흘림' : '[l] 혀 옆으로 흘림',
      }
  }
}
