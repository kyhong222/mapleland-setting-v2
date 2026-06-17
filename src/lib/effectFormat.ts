import { EFFECTS } from '../domain/effects'
import type { EffectId, EffectMap } from '../domain/effects'

/** EffectMap을 "공격력 +5, 힘 +3" 형태 문자열로 */
export function formatEffects(effects: EffectMap): string {
  const ids = Object.keys(effects) as EffectId[]
  return ids
    .filter((id) => effects[id] !== 0)
    .map((id) => {
      const def = EFFECTS[id]
      const v = effects[id] as number
      // 공격속도(step)는 가산이 아니라 단계값 → 부호 없이 표기
      if (def.unit === 'step') return `${def.label} ${v}`
      // percent 단위는 값 뒤에 % (라벨에 이미 %가 있으면 제거 후 통일)
      const isPercent = def.unit === 'percent'
      const label = isPercent ? def.label.replace(/%$/, '') : def.label
      const suffix = isPercent ? '%' : ''
      return `${label} ${v > 0 ? '+' : ''}${v}${suffix}`
    })
    .join(', ')
}
