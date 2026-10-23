// 합성기 내부 파라미터 한 프레임 (Klatt 합성기 파라미터에 대응).
// 사용자 파라미터(schema.ts) → FrameParams 변환은 engine/mapping.ts 가 담당한다.

export const N_FORMANTS = 6

export interface FrameParams {
  f0: number // Hz, 떨림·프라이·흔들림 적용 전
  av: number // 유성음 진폭 (선형)
  ah: number // 기식음(성문 잡음) 진폭 (선형)
  rd: number // 발성 유형 (LF Rd)
  tilt: number // 0..0.95, 추가 고역 감쇠 (1차 저역통과 계수)
  jitter: number // 비율 (0.01 = 1%), local jitter
  shimmer: number // 비율, local shimmer
  creak: number // 0..1
  tremorRate: number // Hz
  tremorDepth: number // cent
  formants: number[] // F1..F6 Hz
  bandwidths: number[] // B1..B6 Hz
  fnp: number // 비강 극점 (Hz)
  bnp: number
  fnz: number // 비강 영점 (Hz). fnp 와 같으면 서로 상쇄 = 비음 없음
  bnz: number
  gain: number // 최종 출력 이득 (선형)
  // ── 자음용 마찰·파열 잡음 (성도 공명기를 거치지 않는 병렬 경로) ──
  af: number // 마찰 잡음 진폭 (ㅅ ㅈ 등, 좁은 틈에서 생기는 난류)
  fricF: number // 마찰 잡음의 중심 주파수 (Hz)
  fricBw: number // 마찰 잡음 대역폭 (Hz)
  ab: number // 파열(터짐) 잡음 진폭, 평탄한 스펙트럼
}

/** 선형 보간 (스무딩·궤적 보간용) */
export function lerpFrame(a: FrameParams, b: FrameParams, k: number, out: FrameParams): FrameParams {
  const l = (x: number, y: number) => x + (y - x) * k
  out.f0 = Math.exp(l(Math.log(a.f0), Math.log(b.f0)))
  out.av = l(a.av, b.av)
  out.ah = l(a.ah, b.ah)
  out.rd = l(a.rd, b.rd)
  out.tilt = l(a.tilt, b.tilt)
  out.jitter = l(a.jitter, b.jitter)
  out.shimmer = l(a.shimmer, b.shimmer)
  out.creak = l(a.creak, b.creak)
  out.tremorRate = l(a.tremorRate, b.tremorRate)
  out.tremorDepth = l(a.tremorDepth, b.tremorDepth)
  for (let i = 0; i < N_FORMANTS; i++) {
    out.formants[i] = l(a.formants[i], b.formants[i])
    out.bandwidths[i] = l(a.bandwidths[i], b.bandwidths[i])
  }
  out.fnp = l(a.fnp, b.fnp)
  out.bnp = l(a.bnp, b.bnp)
  out.fnz = l(a.fnz, b.fnz)
  out.bnz = l(a.bnz, b.bnz)
  out.gain = l(a.gain, b.gain)
  out.af = l(a.af, b.af)
  out.fricF = l(a.fricF, b.fricF)
  out.fricBw = l(a.fricBw, b.fricBw)
  out.ab = l(a.ab, b.ab)
  return out
}

export function cloneFrame(f: FrameParams): FrameParams {
  return { ...f, formants: [...f.formants], bandwidths: [...f.bandwidths] }
}
