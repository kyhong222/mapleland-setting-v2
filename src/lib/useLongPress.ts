import { useRef } from 'react'

/**
 * 모바일 롱프레스(길게 누르기) = 우클릭 대체.
 *
 * 데스크톱의 onContextMenu(우클릭)와 함께 쓴다. 터치 디바이스에는 우클릭이 없어
 * 레벨 변경/컨텍스트 메뉴 같은 "우클릭 동작"에 도달할 수 없으므로, 일정 시간 이상
 * 누르고 있으면 같은 동작을 발동시킨다. 탭(짧게)은 기존 onClick(주동작)을 유지한다.
 *
 * 롱프레스 발동 직후 브라우저가 합성하는 click은 무시해야 하므로 `fired` 플래그를
 * 노출한다. onClick에서 `if (fired.current) { fired.current = false; return }`로 가드한다.
 */
export function useTouchLongPress(onLongPress: () => void, delay = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }
  const touchProps = {
    onTouchStart: (e: React.TouchEvent) => {
      fired.current = false
      const t = e.touches[0]
      start.current = t ? { x: t.clientX, y: t.clientY } : null
      clear()
      timer.current = setTimeout(() => {
        fired.current = true
        onLongPress()
      }, delay)
    },
    // 스크롤(>10px 이동)이면 취소, 미세 지터는 유지
    onTouchMove: (e: React.TouchEvent) => {
      const s = start.current
      const t = e.touches[0]
      if (s && t && Math.hypot(t.clientX - s.x, t.clientY - s.y) > 10) clear()
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
  }
  return { fired, touchProps }
}
