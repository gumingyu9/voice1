import type { ParamDef } from '../params/schema'

/** step의 소수 자릿수에 맞춰 값을 문자열로 만든다. */
export function formatValue(p: ParamDef, value: number): string {
  const decimals = (String(p.step).split('.')[1] ?? '').length
  return value.toFixed(decimals)
}

export function formatWithUnit(p: ParamDef, value: number): string {
  const text = formatValue(p, value)
  return p.unit ? `${text} ${p.unit}` : text
}
