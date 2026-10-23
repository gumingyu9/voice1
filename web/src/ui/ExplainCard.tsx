import { ANATOMY_LABELS, PARAM_BY_ID, type EngineSupport } from '../params/schema'
import { formatValue, formatWithUnit } from './format'

interface Props {
  selectedId: string
  values: Record<string, number>
  onCompare: (id: string, v: number) => void
}

const SUPPORT_LABEL: Record<EngineSupport, string> = { full: '지원', approx: '근사', none: '미지원' }

export function ExplainCard({ selectedId, values, onCompare }: Props) {
  const p = PARAM_BY_ID[selectedId]
  if (!p) return null
  const rows = [
    { icon: '🫁', label: '신체', text: p.explain.body },
    { icon: '🔊', label: '음향', text: p.explain.acoustic },
    { icon: '👂', label: '느낌', text: p.explain.perception },
    { icon: '💡', label: '예시', text: p.explain.example },
  ]

  return (
    <article className={`explain-card group-${p.group}`}>
      <header className="explain-head">
        <h2>{p.label}</h2>
        <span className="explain-value">{formatWithUnit(p, values[p.id])}</span>
      </header>

      <dl className="explain-rows">
        {rows.map((r) => (
          <div key={r.label} className="explain-row">
            <dt>
              <span aria-hidden="true">{r.icon}</span> {r.label}
            </dt>
            <dd>{r.text}</dd>
          </div>
        ))}
      </dl>

      <h3>관련 신체 부위</h3>
      <ul className="chips">
        {p.anatomy.map((a) => (
          <li key={a} className="chip related">
            {ANATOMY_LABELS[a]}
          </li>
        ))}
      </ul>

      <h3>엔진 지원</h3>
      <ul className="badges">
        {(['A', 'B'] as const).map((e) => (
          <li key={e} className={`badge support-${p.engines[e]}`}>
            {e === 'A' ? 'A: 해부학 엔진' : 'B: 자연음 엔진'} · {SUPPORT_LABEL[p.engines[e]]}
          </li>
        ))}
      </ul>

      <h3>비교 듣기</h3>
      <div className="compare">
        {p.compare.map((v) => (
          <button
            key={v}
            type="button"
            className={values[p.id] === v ? 'active' : undefined}
            onClick={() => onCompare(p.id, v)}
            title="이 값으로 바꿔서 들어보기"
          >
            {formatWithUnit(p, v)}
          </button>
        ))}
      </div>
      {p.speechOnly && <p className="hint speech-only">지속 모음에서는 효과가 없고, 문장 재생에서 들을 수 있습니다. 비교 듣기는 입력한 문장으로 재생합니다.</p>}
      <p className="hint">
        기본값 {formatValue(p, p.default)}
        {p.unit && ` ${p.unit}`}
      </p>
    </article>
  )
}
