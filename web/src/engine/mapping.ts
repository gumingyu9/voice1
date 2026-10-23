// 사용자 파라미터(사람이 이해하는 단위) → 합성기 프레임(FrameParams) 변환.
// 각 변환식 옆의 주석이 "왜 이 신체 변화가 이 음향 변화가 되는가"의 근거다.

import type { ParamValues } from '../params/schema.ts'
import { N_FORMANTS, type FrameParams } from './dsp/frame.ts'

export const VOWELS = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ', 'ㅔ'] as const
export type Vowel = (typeof VOWELS)[number]

/** 기준 성도 길이 (성인 남성) */
export const REF_VTL = 17

/**
 * 성인 남성(성도 ~17cm) 서울말 단모음 F1–F3 근사값 (Hz).
 * 한국어 모음 음향 연구들의 대략적인 평균을 반올림한 값으로, 교육용 기준점이다.
 */
export const VOWEL_FORMANTS: Record<Vowel, [number, number, number]> = {
  ㅏ: [740, 1300, 2550],
  ㅓ: [580, 1000, 2550],
  ㅗ: [390, 760, 2500],
  ㅜ: [340, 900, 2400],
  ㅡ: [360, 1450, 2450],
  ㅣ: [280, 2250, 2950],
  ㅔ: [470, 1900, 2600],
}

/** 혀가 중립 위치일 때(균일한 관, 'ㅓ'와 'ㅡ' 사이의 어중간한 모음)의 포먼트: Fn = (2n−1)·c / 4L */
const NEUTRAL = [500, 1500, 2500]
const UPPER = [3500, 4500, 5500] // F4..F6
const BASE_BW = [70, 90, 150, 220, 300, 400]

export interface VowelFormants {
  formants: number[]
  bandwidths: number[]
  /** 후두 높이까지 반영한 실효 성도 길이 (cm) */
  effectiveVtl: number
}

/** 모음 + 성도 관련 파라미터 → 포먼트·대역폭 */
export function vowelFormants(v: ParamValues, vowel: Vowel): VowelFormants {
  const F = [...VOWEL_FORMANTS[vowel], ...UPPER]
  const B = [...BASE_BW]

  // 조음 명확도: 혀·턱 움직임이 작으면 모든 모음이 중립 모음 쪽으로 모인다 (로그 주파수에서 보간)
  const a = v.articulation / 100
  for (let i = 0; i < 3; i++) {
    const w = i < 2 ? a : 1 + (a - 1) * 0.5
    F[i] = NEUTRAL[i] * Math.pow(F[i] / NEUTRAL[i], w)
  }

  // 입술: 오므리면 관 끝이 길고 좁아져 포먼트(특히 F2)가 내려가고, 펴면 올라간다
  const s = v.lipShape
  const lip = [0.05, 0.12, 0.07, 0.03, 0, 0]
  for (let i = 0; i < N_FORMANTS; i++) F[i] *= 1 - lip[i] * s

  // 성도 길이: 관이 길수록 모든 공명이 같은 비율로 낮아진다. 후두를 올리면 관이 짧아진다(±1.2cm)
  const effectiveVtl = Math.max(6, v.vtl - 1.2 * v.larynxHeight)
  const scale = REF_VTL / effectiveVtl
  for (let i = 0; i < N_FORMANTS; i++) F[i] *= scale

  // 개인차: 성도 모양의 미세한 차이
  for (let i = 0; i < 4; i++) F[i] *= 1 + (v[`f${i + 1}Offset`] ?? 0) / 100

  // 공명 링(가수 포먼트): 후두개 위 공간을 좁히면 F3–F5 가 ~2.9kHz 부근으로 모여 큰 봉우리가 된다
  const r = v.ring / 100
  if (r > 0) {
    const center = 2900 * scale
    const targets = [center - 280 * scale, center, center + 300 * scale]
    for (let i = 0; i < 3; i++) {
      F[i + 2] += (targets[i] - F[i + 2]) * 0.75 * r
      B[i + 2] *= 1 - 0.4 * r
    }
  }

  // 공명 감쇠: 벽이 무를수록 대역폭↑. 작은 성도일수록 상대적으로 대역폭이 넓다
  const d = (v.damping / 100) * Math.sqrt(scale)
  for (let i = 0; i < N_FORMANTS; i++) B[i] *= d

  // 비음성(+): 연구개가 열리면 F1 이 약간 오르고 대역폭이 넓어진다 (영점·극점은 frameFor 에서)
  const nas = Math.max(0, v.nasality)
  F[0] += 60 * nas
  B[0] *= 1 + 1.5 * nas

  // 포먼트 순서 유지
  for (let i = 1; i < N_FORMANTS; i++) F[i] = Math.max(F[i], F[i - 1] + 150)

  return { formants: F, bandwidths: B, effectiveVtl }
}

/** 지속 모음 한 프레임 */
export function frameFor(v: ParamValues, vowel: Vowel): FrameParams {
  const { formants, bandwidths } = vowelFormants(v, vowel)
  const loud = v.loudness / 100
  const breath = v.breathiness / 100

  // 성량: 성문하압↑ → 음량↑, 음높이 약간↑(±2반음), 고역 감쇠↓
  const f0 = v.f0 * Math.pow(2, ((loud - 0.5) * 4) / 12)
  const gainDb = (loud - 0.5) * 30

  // 숨소리: 잡음↑. 90% 이상에서는 성대 진동이 사라지며 속삭임이 된다
  const whisper = Math.min(1, Math.max(0, (breath - 0.85) / 0.15))
  const av = 1 - whisper
  const ah = 0.6 * Math.pow(breath, 1.3) + 0.2 * whisper

  const softness = Math.max(0, 0.5 - loud) * 2 // 0..1
  const tilt = Math.min(0.9, 0.55 * softness + 0.3 * breath + 0.1 * Math.max(0, v.phonation - 1))

  // 비음성(+): 비강 극점 ~270Hz 와 위로 이동하는 영점. (−, 코 막힘) 은 비음 자음에만 영향 → P2
  const nas = Math.max(0, v.nasality)

  return {
    f0,
    av,
    ah,
    rd: v.phonation,
    tilt,
    jitter: v.jitter / 100,
    shimmer: v.shimmer / 100,
    creak: v.creak / 100,
    tremorRate: v.tremorRate,
    tremorDepth: v.tremorDepth,
    formants,
    bandwidths,
    fnp: 270,
    bnp: 100,
    fnz: 270 + 380 * nas,
    bnz: 100,
    gain: OUTPUT_GAIN * Math.pow(10, gainDb / 20),
  }
}

/** 성량 50 일 때 평균 출력이 −18dBFS 근처가 되도록 맞춘 보정값 (scripts/check-synth 로 측정) */
export const OUTPUT_GAIN = 0.16
