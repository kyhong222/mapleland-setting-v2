# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

메이플랜드(메랜) 세팅 시뮬레이터. 장비·주문서·보석·버프를 조합해 스탯/공격력/데미지/피격데미지/N방컷을
계산하는 클라이언트 전용 SPA다. 서버 상태는 없고, 모든 세팅은 브라우저 localStorage에 저장된다.
(유일한 서버 코드는 문의하기 프록시 `api/feedback.js`.)

코드 주석·커밋 메시지·UI는 모두 한국어다. 새 코드도 같은 톤을 유지할 것.

## 명령어

```bash
npm run dev         # Vite 개발 서버
npm run typecheck   # tsc --noEmit (유일한 상시 검증 수단)
npm run build       # tsc --noEmit && vite build
npm run preview     # 빌드 결과 미리보기
```

**테스트 프레임워크가 없다.** 검증은 `npm run typecheck` + `scripts/*Smoke.ts` 수동 스모크뿐이다.

```bash
npx tsx scripts/smoke.ts         # itemRepository(로컬 카탈로그/API 폴백) 확인
npx tsx scripts/scrollSmoke.ts   # 아이템별 주문서 매칭 확인
npx tsx scripts/tucSmoke.ts      # postItem 오버라이드(tuc) 확인
npx tsx scripts/weaponGateSmoke.ts # 무기 마스터리/부스터의 무기 게이팅 확인
npx tsx scripts/resourceSmoke.ts   # HP/MP 수식·역산을 인게임 실측 4건과 대조
```

변경 후에는 최소한 `npm run typecheck`를 돌린다.

### 실행 환경

위 명령어가 그대로 듣지 않는 머신이 있다(툴체인 위치, 경로 표기, WSL 경유 여부 등).
**레포 루트에 `LOCAL.md`가 있으면 먼저 읽을 것** — 그 PC에서만 통하는 호출 방법이 적혀 있다.
`LOCAL.md`는 머신마다 다르므로 gitignore 대상이고, 여기(CLAUDE.md)에는 전 환경 공통 사항만 둔다.

## 아키텍처

레이어는 아래로만 의존한다: `components → store → data → domain`.

- **`src/domain/`** — 순수 계산. React·스토어·fetch를 절대 import하지 않는다. 공식은 주석에 출처를 남긴다.
- **`src/data/`** — 번들 JSON + maplestory.io API 접근. 도메인 타입으로 정규화해 노출한다.
- **`src/store/`** — Zustand + `persist`. **스토어끼리 서로 import하지 않는다** — 여러 스토어를 묶는 조립은
  `store/snapshot.ts`에서만 한다(`captureSnapshot`/`applySnapshot`/`resetAll`).
- **`src/components/`** — MUI. `PanelGrid`가 3열 세로 스택으로 패널을 배치하고, 각 패널은
  `common/CollapsiblePanel`로 감싸 접힘 상태를 `uiStore`에 영속화한다.

`domain/index.ts`, `data/index.ts`는 공개 API 배럴이다.

### EffectMap — 전 시스템 공통 화폐

`domain/effects.ts`의 `EffectMap`(= `Partial<Record<EffectId, number>>`) 하나로 장비 옵션·주문서·보석·
버프·패시브를 전부 표현한다. 합치는 방법이 두 가지이고, 이 구분이 버프 규칙의 핵심이다.

- `sumEffects(...)` — 단순 덧셈 (장비, 토글 패시브, 무기 마스터리)
- `maxEffects(...)` — 능력치별 최댓값 (도핑/개인/파티 버프: 같은 종류는 중첩되지 않고 높은 쪽만)

**독립 채널**: 접미사가 붙은 효과 id(`pad_botf`·`pad_burning`·`pad_weather`·`pad_energyCharge`,
`acc_botf`, `speed_burning` 등)는 "무조건 중첩되는" 보너스를 분리하기 위한 별도 채널이다. 이 값들은
자동으로 합산되지 않고 **소비처에서 명시적으로 더해진다**:

- `domain/attackPower.ts`의 `totalAttack()` / `totalMagic()`
- `domain/detailStats.ts`의 `computeDetailStats()`
- `domain/resource.ts`의 `resourceParts()` (HP/MP의 `hpP_botf`·`mpP_botf`)

→ 새 독립 채널을 추가하면 위 두 곳을 반드시 함께 고쳐야 한다. 안 그러면 조용히 무시된다.

### 아이템 파이프라인

```
catalog/<slot>.json ─┐
                     ├→ itemRepository.getItem(id) → postItems 오버라이드 → ItemData
maplestory.io API ───┘   (로컬 카탈로그 우선 → GMS 62 → GMS 200 폴백 + KMS 300 한글명)
                                    ↓
               ItemMakerDialog: 수치조정 + 주문서 + 보석 + 성장 → BuiltItem
                                    ↓
               resolveBuiltItem() → finalEffects + 정옵 대비 delta + 등급(grade.ts)
                                    ↓
               inventoryStore에 인스턴스(id)로 보관 → buildStore.equipped가 그 id를 참조
```

- `postItems.ts`는 **얕은 부분 병합**이다. `tuc`만 교정하는 식으로 쓴다. `effects`를 지정하면 전체 교체.
- 합성 id `9xxxxxx`: 원작에 없는 메랜 오리지널 아이템. `9` + 아이콘을 빌려온 원작 id 뒤 6자리.
- `iconUrl`을 id에서 유도하지 말 것 — 메랜은 아이콘을 엇갈려 재사용한다(퀘스트 훈장 2종).

### 버프 파이프라인

`data/buff/` JSON(`common`/`enhancement`/`jobSpecific`) → `getBuff(id)` → `store/aggregate.ts`의
`activeBuffEffects()` → `useBuffEffects()` 훅.

- `activeBuffs` (토글: 공용 버프·직업 패시브) → sum
- `appliedBuffs` (도핑/개인/파티) → max 풀
- `nonStacking` 토글 버프는 특화 섹션에 있어도 max 풀로 들어간다
- 무기 마스터리/엑스퍼트는 **장착 주무기 타입이 일치할 때만** 자동 적용 (`masteryOff`로 개별 해제)
- `weaponTypes`가 붙은 버프(마스터리/엑스퍼트 + 무기 부스터)는 `weaponGateOk()`로 게이팅된다.
  인게임 스킬 설명이 근거이고, 검/도끼/둔기 계열은 한손·두손 양쪽을 모두 넣어야 한다.
  무기를 가리지 않는 윈드 부스터만 `weaponTypes`를 비워 둔다.
- `requiresShield` 버프(블로킹)는 보조무기에 방패가 있어야 적용

주의점 두 가지가 실제로 버그를 낸 적 있다:

1. **id 중복** — `ALL_BUFFS` 순서상 `PERSONAL_BUFFS`가 `JOB_BUFFS`보다 앞이라, 같은 id가 양쪽에 있으면
   `getBuff()`가 personal 쪽을 돌려주고 `exclusiveGroup`(변신류 배타)이 조용히 무력화된다.
   변신류는 `jobSpecific/skills.json`에 passive로 둘 것.
2. **종료된 이벤트 버프**는 JSON에서 지우지 말고 `data/buff/index.ts`의 `DISABLED_BUFF_IDS`로 가린다
   (JSON에 주석을 달 수 없어서 쓰는 방식). 저장된 빌드에 id가 남아 있어도 조용히 건너뛴다.

### 활성화(activation) 판정

`store/activation.ts` — 장착 **후** 각 장비가 요구조건(레벨/직업/요구스탯)을 만족하는지 fixpoint로 판정한다.
요구스탯은 "자기 자신을 제외한 다른 활성 장비 + 버프"만 반영한다(인게임과 동일). 비활성 장비는 스탯
계산에서 빠지고, 그 결과 다른 장비가 연쇄 비활성될 수 있어 변화가 없을 때까지 반복한다.
스탯 계산에는 `useActiveEquippedBuilts()`를 쓸 것 — 단순 장착 목록을 쓰면 비활성 장비가 섞인다.

### 영속화 / 저장 슬롯

localStorage 키는 전부 `mlsv2:` 접두사(`build`/`inventory`/`slots`/`ui`/`monster`/`nhit`).
`buildStore`·`inventoryStore`는 `version` + `migrate`를 쓰므로, 영속 상태 구조를 바꾸면 버전을 올리고
마이그레이션을 추가해야 한다(기존 사용자 데이터가 날아간다).

인벤토리는 두 종류다:
- `shared`(공용) — 전 저장슬롯이 함께 쓰는 창고. 슬롯 불러오기/초기화에도 남는다.
- `personal`(개인) — 저장슬롯을 따라다닌다. 슬롯을 불러오면 통째로 교체된다.

저장 슬롯(24칸 = 6칸 × 4묶음, 한 계정당 캐릭터 6개 기준)에 실리는 것: 빌드 + 대상 몬스터 + n타 선택 +
개인 인벤토리. `applySnapshot`은 **개인 인벤토리를 장비 복원보다 먼저** 넣는다 — `equipped`가 참조하는
id가 먼저 존재해야 하기 때문.

### 데이터 생성 스크립트 (`scripts/`)

전부 일회성/수동 실행이며 CI에 없다. 일부(`buildBuffs`·`fetchBalrogItems`·`patchMissingTuc`)는
`--write` 없이는 드라이런이지만 나머지는 실행 즉시 파일을 덮어쓴다 — 돌리기 전에 해당 스크립트
상단 주석을 확인할 것.

- `convertV1.mjs` — v1 레포 아이템 → `src/data/catalog/<slot>.json`
- `buildScrolls.mjs` — maplestory.io → `src/data/scrolls.json`
- `importSkills.mjs` — ms-skill-simulator → `src/data/skills/skillbooks/`, 아이콘은 `public/skill-icons/`로 분리
- `refreshReq.mjs` / `patchMissingTuc.mjs` / `fetch*.mjs` — 카탈로그 요구치·업횟·신규 아이템 보강

⚠ **`buildBuffs.mjs --write`는 실행하지 말 것.** 최초 부트스트랩 이후 손으로 관리해온 JSON을 따라오지
못해 시그너스 전 직업·부스터 등 46건이 유실된다. 버프 데이터는 JSON을 직접 편집한다.

## 문서 (공식의 출처)

계산식을 건드리기 전에 먼저 읽을 것. 코드 주석은 이 문서들을 §번호로 참조한다.

- [docs/nhit-dpm.md](docs/nhit-dpm.md) — N방컷/DPM 기획서. 모션 규칙, 난수 순환(7슬롯), 차지, 콤보,
  공속표(분당 공격횟수)까지 실측 근거와 함께 확정본.
- [docs/plan.md](docs/plan.md) — 세부스탯/몬스터/공격력/성장템/시그너스/피격데미지/방컷 기획 확정본.
- [docs/feedback-setup.md](docs/feedback-setup.md) — 문의하기 프록시 배포/토큰 설정.

## 배포

Vite SPA + Vercel Node Function(`api/feedback.js` — 폼 입력을 GitHub 이슈로 등록).
서버 전용 환경변수(`GITHUB_TOKEN` 등)는 `.env`가 아니라 배포 플랫폼에 넣는다. 프론트에 노출되는 값은
`VITE_` 접두사만 해당(`VITE_FEEDBACK_ENDPOINT`). `.env.example` 참고.

## 작업 흐름

기본 브랜치는 `master`. 작업은 항상 브랜치를 따로 파서 하고 PR로 머지한다.

1. **시작** — 작업을 새로 시작할 때만 `master`로 돌아간다. `git pull`로 최신을 받은 뒤,
   그 시점을 기준으로 새 브랜치를 만든다. (오래된 로컬 `master` 위에서 브랜치를 파지 않는다.)
2. **작업** — 구현 → 검수(`npm run typecheck`, 필요 시 스모크 스크립트) → 커밋.
3. **마무리** — PR을 올리는 것으로 해당 작업을 끝낸다. **PR 생성 후 `master`로 되돌아가지 않는다** —
   로컬은 작업 브랜치에 그대로 둔다. (검수가 끝나기도 전에 브랜치를 떠나 작업이 붕 뜨는 일을 막기 위함.)
   master 복귀는 다음 작업을 시작하는 1번 단계에서 일어난다.

```bash
git checkout master && git pull    # 시작할 때만
git checkout -b <type>/<slug>
# ... 작업 · 검수 · 커밋 ...
git push -u origin <type>/<slug> && gh pr create
# 끝. 로컬은 작업 브랜치에 그대로 둔다.
```

### 어느 브랜치에서 작업해야 하는지 판단하는 법

로컬이 `master`가 아닌 브랜치에 있고 거기서 계속해도 되는지 애매하면, 로컬 상태만 보지 말고
**(1) remote의 PR 머지 여부와 (2) 지금 할 작업이 그 브랜치의 작업 내용과 이어지는지**를 종합해
판단한 뒤 올바른 브랜치로 이동한다.

```bash
gh pr status                             # 현재 브랜치의 PR 상태
gh pr list --state all --head <branch>   # 머지/열림 여부 확인
```

- PR이 **머지됨** → 끝난 작업. 이어서 커밋하지 말고 `master`로 돌아가 pull한 뒤 새 브랜치를 판다.
- PR이 **열려 있음 / 없음**이고 지금 할 작업이 **그 브랜치의 연장선** → 그 브랜치에서 계속한다.
- PR이 **열려 있음 / 없음**이지만 지금 할 작업이 **무관한 주제** → 그 브랜치는 건드리지 말고
  `master`에서 pull한 뒤 새 브랜치를 판다. (열린 PR에 관계없는 커밋을 얹지 않는다.)

### 커밋 메시지

`type(scope): 한국어 요약` 형태(예: `feat(buff):`, `fix(catalog):`, `chore(buff):`, `revert(catalog):`).
