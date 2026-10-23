// 파라미터 단일 정의 파일. 슬라이더 UI, 설명 카드, 해부도 연결, 엔진 매핑이 모두 여기서 파생된다.

export type GroupId = 'power' | 'source' | 'filter' | 'speech'

export type AnatomyPart =
  | 'lungs'
  | 'vocalFolds'
  | 'larynx'
  | 'pharynx'
  | 'epilarynx'
  | 'velum'
  | 'nasalCavity'
  | 'tongue'
  | 'jaw'
  | 'lips'
  | 'teeth'
  | 'vocalTract'

/** full: 직접 대응, approx: 근사, none: 미지원 */
export type EngineSupport = 'full' | 'approx' | 'none'

export interface ParamExplanation {
  body: string // 신체 요소
  acoustic: string // 음향 변화
  perception: string // 들리는 느낌
  example: string // 실생활 예시
}

export interface ParamDef {
  id: string
  group: GroupId
  label: string
  unit: string
  min: number
  max: number
  default: number
  step: number
  /** log: 슬라이더 위치를 로그 스케일로 (음높이처럼 비율로 지각되는 값) */
  scale: 'linear' | 'log'
  /** 양 끝 의미 (예: 눌린 소리 ↔ 숨 섞인 소리). 없으면 min/max 숫자만 표시 */
  ends?: [string, string]
  advanced?: boolean
  /** 지속 모음 모드에서는 효과가 없고 단어·문장 재생에서만 적용됨 */
  speechOnly?: boolean
  anatomy: AnatomyPart[]
  engines: { A: EngineSupport; B: EngineSupport }
  /** 설명 카드의 "비교 듣기" 버튼 값 */
  compare: number[]
  explain: ParamExplanation
}

export interface GroupDef {
  id: GroupId
  label: string
  organ: string
  summary: string
}

export const GROUPS: GroupDef[] = [
  { id: 'power', label: '① 동력', organ: '폐·횡격막', summary: '얼마나 세게, 얼마나 길게 공기를 내보내는가' },
  { id: 'source', label: '② 음원', organ: '후두·성대', summary: '성대가 어떻게 떨리며 버즈음을 만드는가 — 음높이와 음질' },
  { id: 'filter', label: '③ 필터', organ: '성도(목구멍·입·코)', summary: '버즈음이 관을 지나며 어떤 주파수가 울리는가 — 음색과 체격감' },
  { id: 'speech', label: '④ 말투', organ: '혀·입술·습관', summary: '조음 기관을 얼마나 빠르고 정확하게 움직이는가' },
]

export const PARAMS: ParamDef[] = [
  // ── ① 동력 ─────────────────────────────────────────────
  {
    id: 'loudness', group: 'power', label: '성량', unit: '', min: 0, max: 100, default: 50, step: 1, scale: 'linear',
    ends: ['작게', '크게'], anatomy: ['lungs'], engines: { A: 'full', B: 'full' }, compare: [15, 50, 90],
    explain: {
      body: '폐와 횡격막이 성대 아래로 밀어 올리는 공기 압력(성문하압).',
      acoustic: '압력이 높을수록 성대가 더 세게 닫히며 음량이 커지고, 고음역 배음이 늘어나 스펙트럼이 평평해진다.',
      perception: '작으면 부드럽고 어두우며, 크면 밝고 날카롭게 들린다. 단순히 볼륨만 키운 것과 다르다.',
      example: '멀리 있는 사람을 부를 때 목소리가 커질 뿐 아니라 "쨍"해지는 이유.',
    },
  },
  {
    id: 'breathGroup', group: 'power', label: '호흡 단위', unit: '음절', min: 4, max: 30, default: 14, step: 1, scale: 'linear',
    ends: ['자주 쉼', '길게 말함'], speechOnly: true, anatomy: ['lungs'], engines: { A: 'full', B: 'full' }, compare: [5, 14, 28],
    explain: {
      body: '한 번 숨을 들이쉬고 내쉬는 동안 말할 수 있는 길이. 폐활량과 호흡 습관.',
      acoustic: '문장 중간에 들어가는 쉼의 위치와 빈도가 달라진다.',
      perception: '짧으면 숨이 차거나 긴장한 느낌, 길면 여유 있고 유창한 느낌.',
      example: '달리기 직후 말할 때 끊어 말하게 되는 것.',
    },
  },

  // ── ② 음원 ─────────────────────────────────────────────
  {
    id: 'f0', group: 'source', label: '기본 음높이', unit: 'Hz', min: 50, max: 600, default: 120, step: 1, scale: 'log',
    anatomy: ['vocalFolds', 'larynx'], engines: { A: 'full', B: 'full' }, compare: [85, 120, 210, 300],
    explain: {
      body: '성대의 길이·두께·긴장도. 성인 남성 성대는 약 17–25mm, 여성은 약 12.5–17.5mm로 길고 두꺼울수록 느리게 떨린다.',
      acoustic: '성대가 1초에 몇 번 열리고 닫히는가(F0). 스펙트럼에서 배음 줄무늬 간격이 된다.',
      perception: '음높이. 평균적으로 성인 남성 약 85–155Hz, 여성 약 165–255Hz, 어린이 약 250–400Hz.',
      example: '기타 줄을 팽팽하게 조이면 음이 올라가는 것과 같은 원리.',
    },
  },
  {
    id: 'f0Range', group: 'source', label: '억양 폭', unit: '반음', min: 0, max: 12, default: 5, step: 0.5, scale: 'linear',
    ends: ['단조로움', '생동감'], speechOnly: true, anatomy: ['vocalFolds', 'larynx'], engines: { A: 'full', B: 'full' }, compare: [0, 5, 11],
    explain: {
      body: '말하는 동안 성대 긴장을 얼마나 크게 조절하는가 (윤상갑상근의 움직임 폭).',
      acoustic: '문장 안에서 F0가 오르내리는 범위.',
      perception: '좁으면 로봇처럼 단조롭고 지친 느낌, 넓으면 활발하고 감정이 풍부한 느낌.',
      example: '아이에게 동화책을 읽어줄 때 억양이 커지는 것.',
    },
  },
  {
    id: 'phonation', group: 'source', label: '발성 유형', unit: 'Rd', min: 0.3, max: 2.7, default: 1.0, step: 0.05, scale: 'linear',
    ends: ['눌린 소리', '숨 섞인 소리'], anatomy: ['vocalFolds'], engines: { A: 'full', B: 'approx' }, compare: [0.4, 1.0, 2.4],
    explain: {
      body: '성대 양쪽이 얼마나 세게 맞붙는가 (피열연골이 성대를 모으는 힘).',
      acoustic: '성대 펄스 모양이 바뀐다. 세게 붙으면 펄스가 날카로워 고음 배음이 많고, 약하게 붙으면 펄스가 둥글어 기본음만 강해진다.',
      perception: '눌린 소리는 긴장되고 딱딱하며, 숨 섞인 소리는 부드럽고 속삭이듯 들린다.',
      example: '무거운 짐을 들며 말할 때(눌림) vs 졸린 목소리(숨 섞임).',
    },
  },
  {
    id: 'breathiness', group: 'source', label: '숨소리', unit: '%', min: 0, max: 100, default: 10, step: 1, scale: 'linear',
    anatomy: ['vocalFolds'], engines: { A: 'full', B: 'full' }, compare: [0, 10, 40, 90],
    explain: {
      body: '성대가 닫혀야 할 때도 완전히 닫히지 않고 남는 틈(주로 성대 뒤쪽).',
      acoustic: '틈으로 새는 공기가 난류 잡음을 만들어 배음 사이를 채운다.',
      perception: '조금이면 부드럽고 친근하게, 많으면 속삭임처럼 들린다. 100%에 가까우면 성대 진동 없는 귓속말.',
      example: '귓속말, ASMR 목소리.',
    },
  },
  {
    id: 'jitter', group: 'source', label: '주기 흔들림', unit: '%', min: 0, max: 5, default: 0.5, step: 0.1, scale: 'linear',
    anatomy: ['vocalFolds'], engines: { A: 'full', B: 'full' }, compare: [0, 0.5, 2, 4.5],
    explain: {
      body: '성대 점막의 상태와 좌우 성대의 대칭성. 붓거나 결절이 있으면 진동 주기가 매번 달라진다.',
      acoustic: '한 주기와 다음 주기의 길이 차이. 건강한 목소리는 대략 1% 미만.',
      perception: '커질수록 거칠고 쉰 목소리.',
      example: '노래방에서 오래 노래한 다음 날의 목소리.',
    },
  },
  {
    id: 'shimmer', group: 'source', label: '세기 흔들림', unit: '%', min: 0, max: 20, default: 2, step: 0.5, scale: 'linear',
    anatomy: ['vocalFolds'], engines: { A: 'full', B: 'full' }, compare: [0, 2, 8, 18],
    explain: {
      body: '성대 진동의 진폭이 매 주기 일정하지 않음. 점막 질량 변화, 근육 피로.',
      acoustic: '한 주기와 다음 주기의 크기 차이. 건강한 목소리는 대략 4% 미만.',
      perception: '커질수록 갈라지고 불안정한 소리.',
      example: '심한 감기나 후두염에 걸렸을 때.',
    },
  },
  {
    id: 'creak', group: 'source', label: '보컬 프라이', unit: '%', min: 0, max: 100, default: 0, step: 1, scale: 'linear',
    anatomy: ['vocalFolds'], engines: { A: 'full', B: 'approx' }, compare: [0, 40, 90],
    explain: {
      body: '성대가 매우 이완되고 두껍게 뭉친 상태에서 느리고 불규칙하게 떨림.',
      acoustic: 'F0가 매우 낮아지고(수십 Hz) 펄스가 하나씩 들릴 정도로 불규칙해짐. 주로 문장 끝, 숨이 다할 때.',
      perception: '"드르륵" 긁는 듯한 소리.',
      example: '아침에 막 일어나 낮게 말할 때, 문장 끝을 흐리는 말투.',
    },
  },
  {
    id: 'tremorRate', group: 'source', label: '떨림 속도', unit: 'Hz', min: 0, max: 8, default: 0, step: 0.1, scale: 'linear',
    anatomy: ['larynx'], engines: { A: 'full', B: 'full' }, compare: [0, 5, 7],
    explain: {
      body: '후두 주변 근육이 주기적으로 수축·이완하는 속도.',
      acoustic: '음높이가 1초에 몇 번 출렁이는가. 비브라토는 보통 5–7Hz.',
      perception: '떨림 깊이와 함께 노래의 비브라토나 노인 목소리의 떨림을 만든다.',
      example: '성악가의 비브라토, 긴장하거나 나이 들어 떨리는 목소리.',
    },
  },
  {
    id: 'tremorDepth', group: 'source', label: '떨림 깊이', unit: 'cent', min: 0, max: 100, default: 0, step: 1, scale: 'linear',
    anatomy: ['larynx'], engines: { A: 'full', B: 'full' }, compare: [0, 30, 90],
    explain: {
      body: '떨릴 때 근육이 얼마나 크게 움직이는가.',
      acoustic: '음높이가 출렁이는 폭 (100cent = 반음).',
      perception: '작으면 은은한 울림, 크면 눈에 띄는 떨림.',
      example: '트로트의 꺾기와 깊은 비브라토.',
    },
  },

  // ── ③ 필터 ─────────────────────────────────────────────
  {
    id: 'vtl', group: 'filter', label: '성도 길이', unit: 'cm', min: 8, max: 20, default: 17, step: 0.1, scale: 'linear',
    anatomy: ['vocalTract'], engines: { A: 'full', B: 'full' }, compare: [11, 14.5, 17, 20],
    explain: {
      body: '성대부터 입술까지 소리가 지나는 관의 길이. 성인 남성 약 17cm, 여성 약 14.5cm, 어린이 약 11cm. 사춘기 남성은 후두가 내려가며 길어진다.',
      acoustic: '관이 길수록 공명 주파수(포먼트)가 모두 같은 비율로 낮아진다. 대략 F1 ≈ 음속 / (4 × 길이).',
      perception: '길면 크고 굵은 사람, 짧으면 작고 어린 사람처럼 들린다. 음높이와 함께 성별·체격 인상의 핵심.',
      example: '헬륨 가스를 마시면 관 길이는 같지만 음속이 빨라져 관이 짧아진 것과 같은 효과가 난다.',
    },
  },
  {
    id: 'larynxHeight', group: 'filter', label: '후두 높이', unit: '', min: -1, max: 1, default: 0, step: 0.05, scale: 'linear',
    ends: ['낮춤', '올림'], anatomy: ['larynx', 'pharynx'], engines: { A: 'full', B: 'full' }, compare: [-0.9, 0, 0.9],
    explain: {
      body: '목젖(후두)이 목 안에서 위아래로 움직이는 위치. 인두 공간의 길이와 넓이가 함께 바뀐다.',
      acoustic: '내리면 관이 길고 넓어져 포먼트가 낮아지고, 올리면 짧고 좁아져 높아진다.',
      perception: '내리면 어둡고 굵은 "울리는" 소리, 올리면 가볍고 얇은 소리.',
      example: '오페라 가수의 둥근 소리(내림) vs 만화 캐릭터 흉내(올림).',
    },
  },
  {
    id: 'lipShape', group: 'filter', label: '입술 모양', unit: '', min: -1, max: 1, default: 0, step: 0.05, scale: 'linear',
    ends: ['옆으로 폄', '둥글게 오므림'], anatomy: ['lips'], engines: { A: 'full', B: 'full' }, compare: [-0.9, 0, 0.9],
    explain: {
      body: '입술을 옆으로 펴는가(웃는 입) 앞으로 내밀어 오므리는가.',
      acoustic: '펴면 관 끝이 짧고 넓어져 포먼트가 올라가고, 오므리면 관이 길어지고 좁아져 내려간다.',
      perception: '펴면 밝고 상냥하게, 오므리면 어둡고 둥글게 들린다.',
      example: '웃으면서 말하면 전화로도 웃는 게 들리는 이유.',
    },
  },
  {
    id: 'nasality', group: 'filter', label: '비음성', unit: '', min: -1, max: 1, default: 0, step: 0.05, scale: 'linear',
    ends: ['코 막힘', '콧소리'], anatomy: ['velum', 'nasalCavity'], engines: { A: 'full', B: 'approx' }, compare: [-0.9, 0, 0.6],
    explain: {
      body: '연구개(입천장 뒤쪽 말랑한 부분)가 코로 가는 통로를 얼마나 여는가.',
      acoustic: '코 통로가 열리면 약 250Hz 부근에 공명이, 그 위에 소리를 흡수하는 반공명(영점)이 생기고 첫 포먼트가 뭉개진다.',
      perception: '열리면 "앵앵"거리는 콧소리, 막히면 ㅁ·ㄴ·ㅇ이 ㅂ·ㄷ·ㄱ처럼 들리는 코맹맹이 소리.',
      example: '코감기에 걸렸을 때(막힘), 일부러 귀여운 척하는 콧소리(열림).',
    },
  },
  {
    id: 'articulation', group: 'filter', label: '조음 명확도', unit: '%', min: 50, max: 130, default: 100, step: 1, scale: 'linear',
    ends: ['웅얼거림', '또박또박'], anatomy: ['tongue', 'jaw'], engines: { A: 'full', B: 'approx' }, compare: [55, 100, 125],
    explain: {
      body: '모음을 낼 때 혀와 턱을 얼마나 크게 움직이는가.',
      acoustic: '모음들의 포먼트 위치가 서로 멀어지거나(명확) 가운데로 모인다(웅얼). 모음 사각도의 크기가 바뀐다.',
      perception: '작으면 졸리거나 무심하게 웅얼거리고, 크면 아나운서처럼 또렷하다.',
      example: '혼잣말 vs 강연.',
    },
  },
  {
    id: 'ring', group: 'filter', label: '공명 링', unit: '%', min: 0, max: 100, default: 0, step: 1, scale: 'linear',
    anatomy: ['epilarynx'], engines: { A: 'full', B: 'full' }, compare: [0, 50, 100],
    explain: {
      body: '성대 바로 위의 좁은 공간(후두개 위 공명관)을 좁혀 별도의 작은 공명관처럼 쓰는 것.',
      acoustic: '3, 4, 5번째 포먼트가 2.5–3.5kHz 부근에 모여 큰 봉우리(가수 포먼트)를 만든다.',
      perception: '멀리까지 뻗고 쨍하게 "꽂히는" 소리. 오케스트라 위로도 들린다.',
      example: '성악가, 뮤지컬 배우, 일부 아나운서.',
    },
  },
  {
    id: 'damping', group: 'filter', label: '공명 감쇠', unit: '%', min: 50, max: 200, default: 100, step: 1, scale: 'linear',
    ends: ['울림 많음', '먹먹함'], advanced: true, anatomy: ['vocalTract'], engines: { A: 'full', B: 'approx' }, compare: [60, 100, 180],
    explain: {
      body: '성도 벽(목·입 안 점막과 근육)이 소리 에너지를 얼마나 흡수하는가.',
      acoustic: '포먼트 봉우리의 폭(대역폭). 넓으면 봉우리가 뭉툭해진다.',
      perception: '감쇠가 적으면 쨍하고 울리며, 많으면 먹먹하고 흐릿하다.',
      example: '입 안에 음식을 물고 말할 때의 먹먹한 소리.',
    },
  },
  ...([1, 2, 3, 4] as const).map((n): ParamDef => ({
    id: `f${n}Offset`, group: 'filter', label: `F${n} 미세 조정`, unit: '%', min: -20, max: 20, default: 0, step: 1, scale: 'linear',
    advanced: true, anatomy: n <= 2 ? ['tongue', 'pharynx'] : ['pharynx', 'epilarynx'], engines: { A: 'full', B: 'approx' }, compare: [-15, 0, 15],
    explain: {
      body: '사람마다 조금씩 다른 성도 모양(입천장 높이, 인두 굵기, 혀 크기 등).',
      acoustic: `${n}번째 포먼트만 따로 올리거나 내린다.`,
      perception: n <= 2 ? '모음의 색깔이 미묘하게 달라진다.' : '모음은 그대로인데 "누구 목소리인지"가 달라진다. 개인 고유 음색에 크게 기여.',
      example: '같은 키, 같은 성별이라도 목소리가 서로 구별되는 이유 중 하나.',
    },
  })),

  // ── ④ 말투 ─────────────────────────────────────────────
  {
    id: 'rate', group: 'speech', label: '말 속도', unit: '음절/초', min: 2, max: 9, default: 5, step: 0.1, scale: 'linear',
    speechOnly: true, anatomy: ['tongue', 'lips', 'jaw'], engines: { A: 'full', B: 'full' }, compare: [3, 5, 8],
    explain: {
      body: '혀·입술·턱을 움직이는 속도와 말하는 습관.',
      acoustic: '음절 길이가 짧아지고, 빠를수록 모음이 덜 도달해 흐려진다.',
      perception: '느리면 신중하거나 지친 느낌, 빠르면 급하거나 신난 느낌.',
      example: '뉴스 앵커는 대략 초당 5–6음절, 경매사는 훨씬 빠르다.',
    },
  },
  {
    id: 'intonation', group: 'speech', label: '문장 끝 억양', unit: '', min: -1, max: 1, default: -0.3, step: 0.05, scale: 'linear',
    ends: ['내림(평서)', '올림(의문)'], speechOnly: true, anatomy: ['larynx'], engines: { A: 'full', B: 'approx' }, compare: [-0.8, -0.3, 0.8],
    explain: {
      body: '문장 끝에서 성대 긴장을 풀거나 조이는 습관.',
      acoustic: '마지막 음절의 F0 궤적이 내려가거나 올라간다.',
      perception: '내리면 단정적, 올리면 질문하거나 확인을 구하는 느낌.',
      example: '"밥 먹었어." vs "밥 먹었어?"',
    },
  },
  {
    id: 'consonantForce', group: 'speech', label: '자음 세기', unit: '%', min: 0, max: 150, default: 100, step: 1, scale: 'linear',
    speechOnly: true, anatomy: ['tongue', 'lips'], engines: { A: 'full', B: 'none' }, compare: [30, 100, 145],
    explain: {
      body: '혀·입술로 통로를 막는 압력과, 막았다 뗀 뒤 성대가 다시 떨기 시작하는 시점(VOT).',
      acoustic: '파열 잡음의 크기와 기식 구간의 길이. 한국어 평음(ㄱ)·경음(ㄲ)·격음(ㅋ)은 이 시점과 기식음 차이로 구별된다.',
      perception: '약하면 부드럽고 흐릿하게, 강하면 또렷하고 단호하게 들린다.',
      example: '화가 났을 때 자음이 세게 튀어나오는 것.',
    },
  },
  {
    id: 'sibilance', group: 'speech', label: '치찰음 위치', unit: 'kHz', min: 3, max: 9, default: 6, step: 0.1, scale: 'linear',
    ends: ['둔탁한 ㅅ', '날카로운 ㅅ'], advanced: true, speechOnly: true, anatomy: ['tongue', 'teeth'], engines: { A: 'full', B: 'approx' }, compare: [3.5, 6, 8.5],
    explain: {
      body: 'ㅅ·ㅆ를 낼 때 혀끝과 앞니 사이에 만드는 좁은 틈의 위치와 크기.',
      acoustic: '마찰 잡음이 가장 강한 주파수. 틈이 앞쪽이고 작을수록 높다.',
      perception: '낮으면 "쉬"에 가까운 둔한 소리, 높으면 "쓰"처럼 날카로운 소리.',
      example: '혀 짧은 소리, 앞니가 빠진 아이의 ㅅ 발음.',
    },
  },
]

export type ParamValues = Record<string, number>

export const PARAM_BY_ID: Record<string, ParamDef> = Object.fromEntries(PARAMS.map((p) => [p.id, p]))

export const DEFAULT_VALUES: ParamValues = Object.fromEntries(PARAMS.map((p) => [p.id, p.default]))

export const ANATOMY_LABELS: Record<AnatomyPart, string> = {
  lungs: '폐·횡격막',
  vocalFolds: '성대',
  larynx: '후두',
  pharynx: '인두(목구멍)',
  epilarynx: '후두개 위 공간',
  velum: '연구개',
  nasalCavity: '비강(코 안)',
  tongue: '혀',
  jaw: '턱',
  lips: '입술',
  teeth: '앞니',
  vocalTract: '성도 전체',
}

/** 로그 스케일 슬라이더용: 0..1 위치 ↔ 값 */
export function toPosition(p: ParamDef, value: number): number {
  if (p.scale === 'log') return Math.log(value / p.min) / Math.log(p.max / p.min)
  return (value - p.min) / (p.max - p.min)
}

export function fromPosition(p: ParamDef, pos: number): number {
  const raw = p.scale === 'log' ? p.min * Math.pow(p.max / p.min, pos) : p.min + pos * (p.max - p.min)
  return Math.min(p.max, Math.max(p.min, Number((Math.round(raw / p.step) * p.step).toFixed(6))))
}
