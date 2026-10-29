/**
 * 시작 시 공지 자동 노출 — App에 한 번 마운트한다.
 *
 * 대상은 '다시 열지 않음'을 누르지 않은 자동 노출 공지 중 최신 1건. 판정은 마운트 때 한 번만 한다
 * (닫기만 누르면 다음 접속에 다시 뜬다). 계정 이관 다이얼로그가 떠 있으면 그게 끝난 뒤에 띄운다.
 */

import { useState } from 'react'
import { autoOpenNotice } from '../../data/notices'
import { useCloudSyncStore } from '../../store/cloudSync'
import { useUiStore } from '../../store/uiStore'
import NoticeDialog from './NoticeDialog'

export default function NoticeAutoOpen() {
  const [notice] = useState(() => autoOpenNotice(useUiStore.getState().dismissedNotices))
  const [closed, setClosed] = useState(false)
  const syncPrompt = useCloudSyncStore((s) => s.prompt)

  if (!notice) return null
  return <NoticeDialog open={!closed && syncPrompt === null} initialId={notice.id} onClose={() => setClosed(true)} />
}
