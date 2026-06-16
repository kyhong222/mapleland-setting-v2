import { EFFECTS } from '../domain/effects'
import type { EffectId, EffectMap } from '../domain/effects'

/** EffectMap을 "공격력 +5, 힘 +3" 형태 문자열로 */
export function formatEffects(effects: EffectMap): string {
  const ids = Object.keys(effects) as EffectId[]
  return ids
    .filter((id) => effects[id] !== 0)
    .map((id) => {
      const v = effects[id] as number
      // 공격속도(step)는 가산이 아니라 단계값 → 부호 없이 표기
      if (EFFECTS[id].unit === 'step') return `${EFFECTS[id].label} ${v}`
      return `${EFFECTS[id].label} ${v > 0 ? '+' : ''}${v}`
    })
    .join(', ')
}
