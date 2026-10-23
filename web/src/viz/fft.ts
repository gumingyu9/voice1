// 작은 radix-2 FFT 와 정적 스펙트로그램(STFT) 계산. 외부 라이브러리 없이 화면용으로만 쓴다.

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>()

function plan(n: number) {
  let p = twiddles.get(n)
  if (!p) {
    const cos = new Float64Array(n / 2)
    const sin = new Float64Array(n / 2)
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((2 * Math.PI * i) / n)
      sin[i] = -Math.sin((2 * Math.PI * i) / n)
    }
    const rev = new Uint32Array(n)
    const bits = Math.log2(n)
    for (let i = 0; i < n; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b)
      rev[i] = r
    }
    p = { cos, sin, rev }
    twiddles.set(n, p)
  }
  return p
}

/** 제자리 FFT (길이는 2의 거듭제곱) */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  const { cos, sin, rev } = plan(n)
  for (let i = 0; i < n; i++) {
    const j = rev[i]
    if (j > i) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = n / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const a = start + k
        const b = a + half
        const xr = re[b] * cos[t] - im[b] * sin[t]
        const xi = re[b] * sin[t] + im[b] * cos[t]
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
      }
    }
  }
}

export interface StftImage {
  cols: number
  bins: number // 0..maxHz 까지의 행 수. 0번 행이 가장 높은 주파수(그림 위쪽)
  data: Uint8Array // 0..255 밝기, 행 우선 (cols × bins)
}

export interface StftOptions {
  hopMs: number
  cols: number
  maxHz: number
  /** 분석 창 길이(ms). 짧으면 성대 펄스 줄무늬가 보이는 광대역, 길면 하모닉이 분리되는 협대역 */
  winMs?: number
  /** 표시할 다이내믹 레인지 (dB) */
  rangeDb?: number
}

/** 오디오 → 열마다 Hann 창 FFT 크기를 구해 0..255 로 정규화한 스펙트로그램 */
export function stftImage(audio: Float32Array, fs: number, o: StftOptions): StftImage {
  const winMs = o.winMs ?? 20
  const range = o.rangeDb ?? 70
  // 5kHz 까지만 필요하므로 대략 12kHz 로 줄여서(상자 평균) 계산량을 줄인다
  const D = Math.max(1, Math.floor(fs / 12000))
  const fs2 = fs / D
  const m = Math.floor(audio.length / D)
  const x = new Float64Array(m)
  for (let i = 0; i < m; i++) {
    let a = 0
    for (let j = 0; j < D; j++) a += audio[i * D + j]
    x[i] = a / D
  }
  // 고역 보강(프리엠퍼시스): 스펙트럼 기울기를 펴서 높은 포먼트도 보이게
  for (let i = m - 1; i > 0; i--) x[i] -= 0.97 * x[i - 1]

  const win = Math.max(16, Math.round((fs2 * winMs) / 1000))
  const nfft = 1024
  const hann = new Float64Array(win)
  for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / win)
  const binHz = fs2 / nfft
  const bins = Math.max(2, Math.min(nfft / 2, Math.floor(o.maxHz / binHz)))

  const db = new Float32Array(o.cols * bins)
  const re = new Float64Array(nfft)
  const im = new Float64Array(nfft)
  let peak = -Infinity
  for (let c = 0; c < o.cols; c++) {
    const center = Math.round(((c + 0.5) * o.hopMs * fs2) / 1000)
    re.fill(0)
    im.fill(0)
    const s0 = center - (win >> 1)
    for (let i = 0; i < win; i++) {
      const idx = s0 + i
      if (idx >= 0 && idx < m) re[i] = x[idx] * hann[i]
    }
    fft(re, im)
    for (let b = 0; b < bins; b++) {
      const v = 10 * Math.log10(re[b] * re[b] + im[b] * im[b] + 1e-12)
      db[c * bins + b] = v
      if (v > peak) peak = v
    }
  }
  const data = new Uint8Array(o.cols * bins)
  const lo = peak - range
  for (let c = 0; c < o.cols; c++) {
    for (let b = 0; b < bins; b++) {
      const t = Math.min(1, Math.max(0, (db[c * bins + b] - lo) / range))
      data[(bins - 1 - b) * o.cols + c] = Math.round(t * 255)
    }
  }
  return { cols: o.cols, bins, data }
}
