/** 한글 조사 선택 — 이름을 문장에 끼워 넣을 때 받침에 맞춰 조사를 고른다. */

/** 마지막 한글 음절의 종성 코드 (한글이 없으면 null) */
function lastJongseong(word: string): number | null {
  for (let i = word.length - 1; i >= 0; i--) {
    const code = word.charCodeAt(i)
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28
  }
  return null
}

/**
 * 목적격 조사 — 받침이 있으면 '을', 없으면 '를'.
 *
 * 스킬명이 '피스트 (스턴)'처럼 괄호로 끝날 수 있어 **뒤에서부터 첫 한글 음절**로 판정한다.
 * 한글이 전혀 없으면(스킬명을 못 찾아 id를 쓰는 경우 등) '를'로 둔다.
 */
export function objectJosa(word: string): '을' | '를' {
  const j = lastJongseong(word)
  return j === null || j === 0 ? '를' : '을'
}
