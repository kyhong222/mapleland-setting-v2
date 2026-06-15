# 사후패치 아이템 오버라이드 (postItem)

메이플랜드 자체 패치로 maplestory.io(GMS) 스펙과 달라진 아이템을 여기에 둔다.

- 파일명: `<itemId>.json` (예: `1002357.json`)
- 내용: 완성된 `ItemData` (도메인 `src/domain/item.ts`의 `ItemData` 형태)
- 등록: [`../postItems.ts`](../postItems.ts)에서 import 후 `POST_ITEM_FILES`에 추가

존재하는 id는 `itemRepository.getItem(id)`에서 **API 호출 없이** 이 데이터로 응답한다.

## 예시 형태

```json
{
  "id": 1002357,
  "name": "자쿠의 투구",
  "slot": "hat",
  "effects": { "STR": 20, "DEX": 20, "INT": 20, "LUK": 20, "pdef": 150, "mdef": 150, "add": 20, "eva": 20 },
  "reqLevel": 50,
  "iconUrl": "https://maplestory.io/api/gms/62/item/1002357/icon"
}
```

`effects`에는 `ITEM_EFFECTS` 부분집합 키만 사용한다. `slot === "weapon"`인 경우 `weaponType`도 포함한다.
