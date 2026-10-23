// 시각화 공용 보조 함수

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

export const fmtDb = (v: number): string => (v < 0 ? `−${Math.abs(v)}` : v > 0 ? `+${v}` : '0')

/** SVG path 용 숫자 (소수 1자리) */
export const n1 = (x: number): string => (Math.round(x * 10) / 10).toString()
