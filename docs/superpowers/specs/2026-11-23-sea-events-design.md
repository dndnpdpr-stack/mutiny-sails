# 바다 이벤트 설계

## 의도
게임마다 판이 비슷하게 흘러가지 않도록, 라운드마다 바다 상황이 바뀌어 규칙이 조금씩 달라지게 한다. 원작의 확장 규칙을 베끼지 않은 새 이벤트 12장.

## 동작 (사용자 승인안)
- 이벤트 덱 12장을 따로 섞어 둔다. **두 번째 라운드부터** 선장 턴이 시작될 때 한 장을 펼치고, 다음 이벤트가 나올 때까지 모두에게 적용한다. 덱을 다 쓰면 다시 섞는다.
- 테이블 가운데 덱 옆에 현재 이벤트 카드, 펼쳐질 때 "🌊 폭풍!" 같은 띠.
- 시작 화면에 "바다 이벤트" 켜기/끄기(기본 켜짐). 게임 방법에 이벤트 탭.
- AI는 바뀐 규칙에 맞게 행동한다(낼 수 있는 카드 목록이 규칙을 따르므로 대부분 자동).

| id | 이벤트 | 효과 |
|---|---|---|
| storm | 🌪️ 폭풍 | 모든 거리 +1 |
| fairWind | 🌬️ 순풍 | 뽑기 단계에 3장 |
| fog | 😶‍🌫️ 바다 안개 | 망원경·작은 보트 효과 없음 |
| flagFestival | 🏴‍☠️ 해적 깃발 축제 | 칼질 한 턴에 2번까지 |
| seaMonster | 🐙 바다 괴물 | 펼쳐질 때 모두 판정, ♠이면 체력 1 잃음 |
| highTide | 🌊 만조 | 모든 사람의 사거리 +1 |
| doldrums | 🪨 무풍지대 | 뽑기 단계에 1장 |
| shortage | 🧺 보급 부족 | 럼주는 쓰러질 때만 |
| bigCatch | 🐟 만선 | 펼쳐질 때 모두 1장씩 |
| whirlpool | 🌀 소용돌이 | 펼쳐질 때 모두 다음 사람(시계 방향)에게 손패 1장(무작위) |
| treasureIsland | 🏝️ 보물섬 | 펼쳐질 때 체력이 가장 낮은 사람 1 회복(같으면 모두) |
| calmSea | ☀️ 고요한 바다 | 효과 없음 |

## 엔진
- `src/engine/seaEvents.ts`: `SeaEventId`, `SEA_EVENTS` 목록(이름·아이콘·설명·`modifier?`·`onReveal?`).
- `RuleModifier`에 `rangeDelta`, `disablesGear(kind)`, `rumOnlyWhenDying` 추가. `distance`/`weaponRange`/`Rum.validate`가 읽는다.
- `GameConfig.seaEvents?: boolean`(엔진 기본 꺼짐 → 기존 테스트 그대로), `seaEventOrder?: SeaEventId[]`(테스트용 순서 고정).
- 이벤트 덱은 별도 RNG(seed에서 파생)로 섞어 기존 시드의 카드·역할 순서를 바꾸지 않는다.
- 선장 턴 시작 횟수를 세어 2번째부터 공개. `seaEvent` 이벤트를 `turnStart`보다 먼저 내보내고, 펼침 효과는 화약통 단계보다 먼저 실행.
- 바다 괴물 판정은 선장부터 시계 방향, 판정 사유는 `'seaMonster'`(판정 사유 타입을 `CardKind | 'seaMonster'`로 넓힘). 피해 출처 없음.
- 소용돌이는 각자 넘길 카드를 먼저 정한 뒤 동시에 넘긴다. 받은 사람·준 사람만 카드 내용을 본다.
- `PlayerView.seaEvent`, `seaEventsOn` 추가.

## UI
- `CenterPile`에 이벤트 칸(`data-anchor="sea"`), 켜져 있을 때만.
- 연출 `sea` → 화면 가운데 띠(약 1.2초). 항해일지 문구.
- `SetupScreen` 토글 → `onStart(count, name, seaEvents)` → `LocalSetup.seaEvents`.
- `HowToPlay` "바다 이벤트" 탭(목록에서 생성).

## 내가 정한 것
- 만조는 무기 유무와 관계없이 사거리 +1(제안의 "모든 무기"보다 단순하고 맨손도 혜택).
- 무풍지대는 최소 1장.
- 축제는 쌍권총(무제한)을 줄이지 않는다.

## 범위 밖
- 이벤트 카드 그림(아이콘+글자 카드로 시작), 멀티플레이.
