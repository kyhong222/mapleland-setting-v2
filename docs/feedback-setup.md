# 문의하기(피드백) 설정 가이드

앱 우상단 **문의하기** 버튼 → 모달에서 제목/내용 입력 → 서버리스 함수가 숨긴 토큰으로
GitHub 이슈를 생성합니다. 사용자는 GitHub 계정이 없어도 됩니다.

```
[브라우저 모달]  --POST /api/feedback-->  [서버리스 함수 + 토큰]  --REST-->  [GitHub 이슈]
```

함수가 없거나 실패하면 모달이 자동으로 **GitHub 새 이슈 페이지 프리필** 링크로 폴백합니다.

---

## 1. GitHub 토큰 발급 (Fine-grained PAT 권장)

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
2. **Repository access**: Only select repositories → `mapleland-setting-v2` 만 선택
3. **Permissions** → Repository permissions → **Issues: Read and write**
4. 생성된 토큰(`github_pat_...`) 복사 — 한 번만 보이므로 잘 보관

> 토큰은 **절대** 프론트 코드나 저장소에 넣지 마세요. 배포 플랫폼 환경변수에만 저장합니다.

## 2. 배포 (Vercel 예시)

`api/feedback.js` 가 Vercel Node Function으로 자동 인식됩니다.

Project Settings → **Environment Variables**:

| 이름 | 필수 | 값 |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | 1단계에서 발급한 PAT |
| `GITHUB_OWNER` | | `kyhong222` (기본값) |
| `GITHUB_REPO` | | `mapleland-setting-v2` (기본값) |
| `ALLOWED_ORIGIN` | | CORS 허용 출처. 전체 허용은 미설정(`*`) |

프론트와 함수가 같은 Vercel 도메인이면 `VITE_FEEDBACK_ENDPOINT`는 비워두면 됩니다(기본 `/api/feedback`).

## 3. GitHub Pages를 유지하는 경우

Pages는 정적 호스팅이라 함수를 못 돌립니다. 함수만 Vercel(또는 Cloudflare Worker)에 올리고
프론트 빌드에 엔드포인트 URL을 주입하세요:

```
VITE_FEEDBACK_ENDPOINT=https://<your-app>.vercel.app/api/feedback
```

이때 함수의 `ALLOWED_ORIGIN`을 Pages 주소(`https://kyhong222.github.io`)로 제한하는 걸 권장합니다.

## 4. 스팸 방지

- **허니팟**: 모달의 숨김 필드를 봇이 채우면 서버가 조용히 무시합니다.
- **길이 제한**: 제목 120자 / 내용 5000자.
- 필요 시 Vercel의 IP 레이트리밋이나 캡차(hCaptcha 등)를 추가로 붙일 수 있습니다.

## 5. 로컬 개발

`vite dev`는 `api/`를 실행하지 않으므로, 로컬에서 실제 이슈 생성까지 확인하려면
`vercel dev`를 쓰거나 배포본으로 테스트하세요. 미설정 상태에서는 전송 실패 시
자동으로 GitHub 프리필 폴백이 동작합니다.
