// 프리셋: 기본값(성인 남성)에서 바꿀 값만 적는다.

import { DEFAULT_VALUES, type ParamValues } from './schema.ts'

export interface PresetDef {
  id: string
  label: string
  description: string
  values: Partial<ParamValues>
}

export const PRESETS: PresetDef[] = [
  { id: 'man', label: '성인 남성', description: '기준 목소리. 음높이 약 120Hz, 성도 약 17cm.', values: {} },
  {
    id: 'woman', label: '성인 여성', description: '음높이 약 210Hz, 성도 약 14.5cm, 약간의 숨소리.',
    values: { f0: 210, vtl: 14.5, breathiness: 18, f0Range: 6.5, phonation: 1.2, larynxHeight: 0.1 },
  },
  {
    id: 'child', label: '어린이', description: '짧은 성대와 성도. 음높이 약 280Hz, 성도 약 11.5cm.',
    values: { f0: 280, vtl: 11.5, f0Range: 7, rate: 4.5, articulation: 92, breathiness: 15 },
  },
  {
    id: 'grandpa', label: '할아버지', description: '흔들림·떨림·숨소리가 늘고 말이 느리다.',
    values: { f0: 125, vtl: 17.5, jitter: 2, shimmer: 7, tremorRate: 5, tremorDepth: 25, breathiness: 25, rate: 3.8, creak: 15, loudness: 40 },
  },
  {
    id: 'grandma', label: '할머니', description: '여성 노년. 폐경 후 음높이가 다소 내려가고 떨림이 생긴다.',
    values: { f0: 185, vtl: 14.8, jitter: 2.2, shimmer: 7, tremorRate: 5.5, tremorDepth: 30, breathiness: 30, rate: 3.8, loudness: 38 },
  },
  {
    id: 'announcer', label: '아나운서', description: '또렷한 조음, 공명 링, 안정된 발성.',
    values: { f0: 115, articulation: 120, ring: 45, rate: 5.5, loudness: 60, phonation: 0.9, consonantForce: 115, jitter: 0.3, shimmer: 1.5 },
  },
  { id: 'whisper', label: '속삭임', description: '성대가 떨지 않고 숨소리만으로 말한다.', values: { breathiness: 100, loudness: 30, rate: 4.2 } },
  {
    id: 'husky', label: '허스키', description: '거칠고 숨 섞인 쉰 목소리.',
    values: { f0: 105, jitter: 3, shimmer: 10, breathiness: 40, creak: 20, phonation: 1.6 },
  },
  { id: 'cold', label: '코감기', description: '코가 막혀 ㅁ·ㄴ·ㅇ이 ㅂ·ㄷ·ㄱ처럼 들린다.', values: { nasality: -0.9, damping: 130, breathiness: 15 } },
  { id: 'nasal', label: '콧소리', description: '연구개가 열려 모음까지 코로 울린다.', values: { nasality: 0.7, larynxHeight: 0.3 } },
  {
    id: 'deep', label: '저음 성우', description: '낮은 음높이, 긴 성도, 내린 후두.',
    values: { f0: 85, vtl: 18.5, larynxHeight: -0.6, ring: 30, rate: 4.5, phonation: 0.8, creak: 10 },
  },
  {
    id: 'cartoon', label: '만화 캐릭터', description: '아주 짧은 성도와 높은 음, 큰 억양.',
    values: { f0: 380, vtl: 10, larynxHeight: 0.8, f0Range: 10, rate: 6.5, lipShape: -0.5 },
  },
  {
    id: 'opera', label: '성악가', description: '강한 공명 링(가수 포먼트)과 비브라토.',
    values: { f0: 220, vtl: 15, ring: 90, tremorRate: 5.8, tremorDepth: 70, larynxHeight: -0.5, loudness: 75, articulation: 110 },
  },
]

export function presetValues(p: PresetDef): ParamValues {
  return { ...DEFAULT_VALUES, ...p.values } as ParamValues
}
