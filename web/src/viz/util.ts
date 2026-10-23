// 시각화 공용 보조 함수

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

export const fmtDb = (v: number): string => (v < 0 ? `−${Math.abs(v)}` : v > 0 ? `+${v}` : '0')

/** SVG path 용 숫자 (소수 1자리) */
export const n1 = (x: number): string => (Math.round(x * 10) / 10).toString()

/** magma 계열 색상표 (어두운 보라 → 주황 → 밝은 노랑) 256단계, RGB 순서로 256×3 바이트 */
const MAGMA_STOPS: [number, number, number, number][] = [
  [0.0, 0, 0, 4],
  [0.1, 20, 14, 54],
  [0.2, 59, 15, 112],
  [0.3, 100, 26, 128],
  [0.4, 140, 41, 129],
  [0.5, 183, 55, 121],
  [0.6, 222, 73, 104],
  [0.7, 247, 112, 92],
  [0.8, 254, 159, 109],
  [0.9, 254, 207, 146],
  [1.0, 252, 253, 191],
]
export const MAGMA_LUT: Uint8ClampedArray = (() => {
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let k = 1
    while (k < MAGMA_STOPS.length - 1 && MAGMA_STOPS[k][0] < t) k++
    const a = MAGMA_STOPS[k - 1]
    const b = MAGMA_STOPS[k]
    const u = (t - a[0]) / (b[0] - a[0])
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * u
  }
  return lut
})()
