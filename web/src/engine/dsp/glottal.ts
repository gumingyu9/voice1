// 성대 펄스: LF(Liljencrants–Fant) 모델을 Rd 하나로 조절 (Fant 1995).
// 한 주기를 T0=1 로 정규화한 "성문 유량 미분" 파형을 웨이브테이블로 만들어 둔다.
// 유량 미분은 입술 방사 특성(고역 +6dB/oct)까지 포함한 셈이라 그대로 성도 필터에 넣는다.

export const TABLE_SIZE = 2048

export interface LfTiming {
  tp: number // 유량 최대 시점
  te: number // 급격한 닫힘(최대 음의 기울기) 시점
  ta: number // 닫힘 후 잔여 시간 상수 (return phase)
  oq: number // 열림 비율 ≈ te
}

/** Rd → LF 타이밍 (Fant 1995 의 Rd 예측식). Rd 0.3(눌림) ~ 2.7(숨 섞임) */
export function lfTiming(rd: number): LfTiming {
  const ra = (-1 + 4.8 * rd) / 100
  const rk = (22.4 + 11.8 * rd) / 100
  const rg = rk / (4 * ((0.11 * rd) / (0.5 + 1.2 * rk) - ra))
  const tp = 1 / (2 * rg)
  const te = tp * (1 + rk)
  return { tp, te, ta: ra, oq: te }
}

/** 닫힘 단계 지수 ε:  ε·ta = 1 − exp(−ε(1 − te)) */
function solveEpsilon(te: number, ta: number): number {
  let eps = 1 / ta
  for (let i = 0; i < 40; i++) eps = (1 - Math.exp(-eps * (1 - te))) / ta
  return eps
}

/** 한 주기 유량 미분의 면적(=주기 전후 유량 차). 0 이 되도록 α 를 찾는다. Ee=1 기준 */
function netFlow(alpha: number, tp: number, te: number, ta: number, eps: number): number {
  const w = Math.PI / tp
  const e0 = -1 / (Math.exp(alpha * te) * Math.sin(w * te))
  const open = (e0 * (Math.exp(alpha * te) * (alpha * Math.sin(w * te) - w * Math.cos(w * te)) + w)) / (alpha * alpha + w * w)
  const d = 1 - te
  const ret = -(1 / (eps * ta)) * ((1 - Math.exp(-eps * d)) / eps - d * Math.exp(-eps * d))
  return open + ret
}

function solveAlpha(tp: number, te: number, ta: number, eps: number): number {
  // netFlow 는 α 에 대해 감소 함수: α 가 작으면 열림 초반(+)이, 크면 닫힘 직전(−)이 우세
  let lo = -200
  let hi = 400
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (netFlow(mid, tp, te, ta, eps) > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** 유량 미분 웨이브테이블 (최소값 −1 = Ee) */
export function buildLfTable(rd: number, size = TABLE_SIZE): Float32Array {
  const { tp, te, ta } = lfTiming(rd)
  const eps = solveEpsilon(te, ta)
  const alpha = solveAlpha(tp, te, ta, eps)
  const w = Math.PI / tp
  const e0 = -1 / (Math.exp(alpha * te) * Math.sin(w * te))
  const out = new Float32Array(size)
  const tail = Math.exp(-eps * (1 - te))
  for (let i = 0; i < size; i++) {
    const t = i / size
    out[i] = t < te ? e0 * Math.exp(alpha * t) * Math.sin(w * t) : -(1 / (eps * ta)) * (Math.exp(-eps * (t - te)) - tail)
  }
  // 수치 오차로 남는 직류 성분 제거
  let mean = 0
  for (let i = 0; i < size; i++) mean += out[i]
  mean /= size
  for (let i = 0; i < size; i++) out[i] -= mean
  return out
}

/** Rd 를 0.05 단위로 양자화해 테이블을 캐시 */
export class LfTableCache {
  private tables = new Map<number, Float32Array>()

  get(rd: number): Float32Array {
    const key = Math.round(Math.min(2.7, Math.max(0.3, rd)) * 20)
    let t = this.tables.get(key)
    if (!t) {
      t = buildLfTable(key / 20)
      this.tables.set(key, t)
    }
    return t
  }
}

/** 시각화용: 유량(적분)과 유량 미분, 각각 최대 절대값 1 로 정규화 */
export function glottalPulse(rd: number, size = 256): { flow: Float32Array; derivative: Float32Array; timing: LfTiming } {
  const table = buildLfTable(rd, size)
  const flow = new Float32Array(size)
  let acc = 0
  for (let i = 0; i < size; i++) {
    acc += table[i]
    flow[i] = acc
  }
  const min = Math.min(...flow)
  for (let i = 0; i < size; i++) flow[i] -= min
  const norm = (a: Float32Array) => {
    const m = Math.max(...a.map(Math.abs)) || 1
    for (let i = 0; i < a.length; i++) a[i] /= m
  }
  norm(flow)
  norm(table)
  return { flow, derivative: table, timing: lfTiming(rd) }
}
