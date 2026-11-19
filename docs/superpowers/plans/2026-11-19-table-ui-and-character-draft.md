# 테이블 화면 개편 + 캐릭터 뽑기 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게임 시작 시 역할 확인 후 캐릭터 2장 중 1장을 고르게 하고, 화면 전체를 "나무 갑판 테이블" 스타일의 실물 카드 게임처럼 바꾸고, 사건마다 애니메이션을 넣는다.

**Architecture:** 엔진에 `chooseCharacter` 입력 대기(선장부터 순서대로, 공유 풀에서 2장)와 이벤트 `seq` 번호를 추가한다. 화면은 방장이 보낸 view를 큐에 쌓고, view 하나마다 새 이벤트(`seq` 기준)로 만든 연출 묶음을 재생한 뒤 그 view로 화면을 바꾼다(밀리면 2배속·건너뛰기). 조작(응답 창, 낼 수 있는 카드)은 항상 최신 view 기준이다.

**Tech Stack:** 기존(TypeScript 5, React 18, Vite 5, Vitest 2, @testing-library/react) + `framer-motion@11`.

**Spec:** `docs/superpowers/specs/2026-11-19-table-ui-and-character-draft-design.md` (기반: `docs/superpowers/specs/2026-11-19-pirate-card-game-design.md`)

## Global Constraints

- 원작의 이름·그림·문구 금지. 화면 문자열은 한국어.
- `engine/`은 `host/`·`net/`·`ai/`·`ui/`를 import하지 않는다. `ui/`·`ai/`는 엔진의 타입, `cards/catalog.ts`, `characters/roster.ts`의 정적 정보(`CHARACTER_INFO`, `CHARACTER_IDS`), `rng.ts`만 import한다.
- 애니메이션 로직은 `ui/` 안에만. 엔진·방장·AI는 애니메이션을 모른다(이벤트 `seq`는 일반 식별자).
- 새 의존성은 `framer-motion@11` 하나.
- 연출 하나는 600ms 이하, 연출 시작 간격 100~150ms.
- 큐에 남은 연출 총 길이 > 1500ms면 2배속, > 3000ms면 건너뛰고 최신 view로.
- `prefers-reduced-motion: reduce`이면 연출 없이 즉시 바꾼다.
- 남의 `chooseCharacter.options`는 view에서 `[]`로 가린다. 뽑기 전 자리는 `character: null`.
- 스타일은 샘플 A(`.superpowers/brainstorm/113739-1795062114/content/visual-style.html`의 `.a` 블록): 나무결 갈색 탁자, 양피지 카드(`#f6ead0→#e7d3a8`, 테두리 `#7a4e24`), 장비는 푸른 종이(`#dfe8ef→#b9c9d6`), 카드 뒷면은 붉은 줄무늬 + 금테(`#d8b56a`), 패널은 `rgba(30,18,8,.55)` + 금테.
- 폭 360px에서 가로 스크롤 없음.

## Review Focus

1. **사람 자리가 선장이 아니라서 AI들이 먼저 캐릭터를 고르는 동안** → 뽑기 화면에 "다른 선원들이 고르는 중"과 자리별 진행이 보이고, 내 차례가 오면 후보 2장이 나타난다. 테스트: Task 6.
2. **AI가 아주 빠르게 연달아 행동해서 view가 쌓이는 경우**(aiDelayMs 0) → 3초 넘게 밀리면 건너뛰고, 조용해지면 화면이 최신 view와 같아진다. 테스트: Task 4.
3. **연출이 남아 있는 중에 게임이 끝나는 view가 오는 경우** → 큐가 빠지거나 건너뛴 뒤 결과 화면이 반드시 나온다(멈춰 있지 않음). 테스트: Task 4, Task 7.
4. **"다시 하기"로 새 게임이 시작되는 경우**(새 게임의 `seq`는 다시 1부터) → 이전 게임의 연출·타이머가 새 게임에 남지 않고, 새 게임의 연출이 정상 재생된다. 테스트: Task 4.
5. **화면에는 아직 보이지만 최신 view에서는 이미 없는 카드**(연출 중에 빼앗김·버려짐)를 누르는 경우 → 누를 수 없다. 반대로 아직 도착하지 않은 카드도 누를 수 없다. 테스트: Task 7.

---

## 파일 구조

```
src/engine/
  types.ts            + chooseCharacter pending/action, characterChosen 이벤트, GameEvent.seq, SeatView.character nullable
  Game.ts             + 뽑기 단계, emit이 seq 부여
  defaults.ts         + chooseCharacter 기본 행동
src/host/view.ts      + 남의 후보 가리기, 뽑기 전 character null
src/ai/decide.ts      + 캐릭터 고르기
src/ui/
  App.tsx             화면 전환 (setup → draft → table → result)
  useLocalGame.ts     (유지, 연결 조립)
  format.ts           + characterChosen 문구
  theme.css           샘플 A 스타일 전체 (기존 styles.css 대체)
  anim/
    effects.ts        이벤트 → 연출 목록 (순수 함수)
    useAnimatedView.ts view 큐 + 연출 스케줄 훅
    EffectLayer.tsx   유령 카드·떠오르는 숫자 그리기 (framer-motion)
    anchors.ts        화면 영역 위치 찾기 (data-anchor)
  table/
    Card.tsx          CardFace, CardBack
    CharacterCard.tsx
    RoleCard.tsx
    OpponentPanel.tsx
    FanHand.tsx
    CenterPile.tsx    덱, 버린 카드, 판정 자리
    GameLog.tsx
    PromptNote.tsx    응답 창 (기존 PromptDialog 대체)
    MyArea.tsx        내 정보·장비·손패·버튼
  screens/
    SetupScreen.tsx, DraftScreen.tsx, TableScreen.tsx, ResultScreen.tsx
삭제: src/ui/CardBox.tsx, SeatPanel.tsx, HandView.tsx, PromptDialog.tsx, GameScreen.tsx, SetupScreen.tsx, ResultScreen.tsx, styles.css (새 파일로 대체)
```

---

### Task 1: 엔진 — 이벤트 번호와 캐릭터 뽑기

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/Game.ts`, `src/engine/defaults.ts`
- Test: `tests/engine/draft.test.ts`, `tests/engine/defaults.test.ts`(케이스 추가)

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  // PendingView에 추가
  | { kind: 'chooseCharacter'; seat: SeatId; options: CharacterId[] }
  // Action에 추가
  | { type: 'chooseCharacter'; character: CharacterId }
  // GameEvent: 공통부에 seq 추가, 종류 추가
  export type GameEvent = { visibleTo?: SeatId[]; seq?: number } & ( ... | { type: 'characterChosen'; seat: SeatId; character: CharacterId } );
  ```
  `seq`는 `Game.emit`이 항상 채운다(1부터 1씩 증가). 타입상 optional인 이유는 emit 호출부에서 생략하기 위해서다.
- Produces (`Game.ts`):
  - `SeatState.characterChosen: boolean`.
  - `GameConfig.characters`가 있으면: 지금과 똑같이 생성자에서 체력·손패를 정하고 `characterChosen = true`, `start()`는 바로 첫 턴.
  - 없으면: 생성자에서는 역할만 정하고 `hp = maxHp = 0`, 손패 없음, `characterChosen = false`, `character`는 임시로 아무 캐릭터(읽지 않음). `start()`는 뽑기 단계를 쌓는다.
  - 뽑기 단계: 선장부터 시계 방향으로 자리마다, 아직 아무도 안 고른 캐릭터 풀에서 `rng`로 2장 → `chooseCharacter` 대기. 고르면 `character` 설정, `characterChosen = true`, `characterChosen` 이벤트, 나머지 1장은 풀로 복귀. 전원이 고르면 체력(선장 +1) 설정, 체력만큼 손패 배분(`giveCards`가 아닌 직접 배분, 이벤트 없음 — 기존 생성자와 동일), 선장 첫 턴 시작.
- Produces (`defaults.ts`): `chooseCharacter` → `{ type: 'chooseCharacter', character: p.options[0] }`.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/engine/draft.test.ts` (`new Game({ seed, names })`, characters 미지정)
  - `start()` 직후 `pending()`이 `{ kind: 'chooseCharacter', seat: captainSeat(), options: [a, b] }`, `a !== b`.
  - 뽑기 중 모든 자리 `hand.length === 0`, `hp === 0`.
  - 응답 순서가 선장부터 시계 방향(`captain, captain+1, ...` mod n).
  - 7명: 매 자리 options가 2개이고 이미 고른 캐릭터와 겹치지 않음, 7명 모두 서로 다른 캐릭터로 끝남.
  - options 밖 캐릭터 → `{ ok: false }`, `pending()` 그대로.
  - 다른 행동 타입(`endTurn`) → 거부.
  - 전원 고른 뒤: 선장 `maxHp === character.maxHp + 1`, 각자 손패 = 체력(선장은 첫 턴 뽑기로 +2), `pending()`이 `{ kind: 'turn', seat: captainSeat() }`.
  - `characterChosen` 이벤트가 n개, 공개(`visibleTo` 없음).
  - `events`의 `seq`가 1부터 빈틈없이 증가.
  - `characters` 강제 시 `start()` 직후 `{ kind: 'turn', ... }` (기존 동작).
  - `defaults.test.ts`에 `chooseCharacter` 케이스: `defaultActionFor` 적용 → ok. 기존 "defaults alone never break a game" 테스트는 뽑기 단계 포함으로 계속 통과해야 한다.
- [ ] **Step 2:** `npx vitest run tests/engine` → 새 테스트 FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** `npm test` → 전부 PASS (기존 엔진 테스트는 `makeGame`이 characters를 강제하므로 영향 없음).
- [ ] **Step 5:** `git commit -m "feat(engine): character draft and event sequence numbers"`

---

### Task 2: 방장 화면 상태·AI·로그 문구

**Files:**
- Modify: `src/engine/types.ts` (`SeatView.character: CharacterId | null`), `src/host/view.ts`, `src/ai/decide.ts`, `src/ui/format.ts`
- Test: `tests/host/view.test.ts`, `tests/ai/decide.test.ts`, `tests/ai/simulation.test.ts`, `tests/ui/format.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `buildView` — 뽑기 전 자리 `character: null`; `pending.kind === 'chooseCharacter' && pending.seat !== seat`이면 `options: []`. AI `decide` — `chooseCharacter`면 `CHARACTER_INFO[id].maxHp`가 큰 쪽, 같으면 `rng`로. `formatEvent` — `characterChosen` → `"{이름}이(가) {캐릭터 이름}을(를) 골랐어요."`.
- `SeatView.character`가 nullable이 되면서 깨지는 기존 화면 코드는 Task 6~7에서 교체되므로, 이 Task에서는 `?? ` 처리로 타입 검사만 통과시킨다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `view.test.ts`: 뽑기 게임에서 선장 view의 `pending.options.length === 2`, 다른 자리 view의 `pending.options` 는 `[]`; 아직 안 고른 자리 `character === null`, 고른 자리는 캐릭터 id.
  - `decide.test.ts`: options `['margo','orso']`(체력 3, 5) → `{ type: 'chooseCharacter', character: 'orso' }`.
  - `simulation.test.ts`: `playOut`이 characters 미지정 `new Game({seed, names})`이므로 뽑기 포함으로 300판 통과, 거부율 < 1% (기존 테스트 그대로 통과해야 함).
  - `format.test.ts`: `characterChosen` 문구에 이름과 캐릭터 이름 포함.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** `npm test`, `npm run typecheck` PASS.
- [ ] **Step 5:** `git commit -m "feat: draft in views, AI and log"`

---

### Task 3: 카드 컴포넌트와 테마

**Files:**
- Create: `src/ui/theme.css`, `src/ui/table/Card.tsx`, `src/ui/table/CharacterCard.tsx`, `src/ui/table/RoleCard.tsx`
- Modify: `package.json` (`npm install framer-motion@11`)
- Test: `tests/ui/cards.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function CardFace(p: { card: CardView; size?: 'md' | 'sm'; dim?: boolean; raised?: boolean; selected?: boolean; highlight?: boolean; onClick?: () => void; layoutId?: string }): JSX.Element
  export function CardBack(p: { size?: 'md' | 'sm' }): JSX.Element
  export function CharacterCard(p: { id: CharacterId; onClick?: () => void }): JSX.Element
  export function RoleCard(p: { role: Role | null; revealed: boolean }): JSX.Element  // revealed가 false→true가 되면 Y축 뒤집기
  export const ROLE_GOAL: Record<Role, string>  // 승리 조건 한 줄
  ```
  - `CardFace`: `<motion.button>`(클릭 가능) 또는 `<motion.div>`, `className="pcard {action|equipment} {size}"`, 왼쪽 위 문양·숫자(♥♦는 `red` 클래스), 가운데 이모지, 아래 이름, `aria-label = 카드 이름`, `title = 효과 문구`. `onClick` 없으면 `disabled`.
  - `CharacterCard`: 얼굴 이모지(캐릭터별 고정 — 구현자 선택), 이름, 체력 하트, 능력 문구, `<button aria-label="{이름} 고르기">`.
  - `ROLE_GOAL`: 선장 "반란 선원과 첩자를 모두 쓰러뜨리세요", 충성 선원 "선장을 지켜 반란 선원과 첩자를 쓰러뜨리세요", 반란 선원 "선장을 쓰러뜨리세요", 첩자 "마지막까지 혼자 살아남으세요".
  - `theme.css`: Global Constraints의 샘플 A 색·질감. 카드 기본 크기 md 92×132px, sm 52×74px.

- [ ] **Step 1: 실패하는 테스트 작성** (`cards.test.tsx`)
  - `CardFace` ♥Q 칼질 → "칼질" 텍스트, "Q", 문양 요소에 `red` 클래스; ♠7 → `red` 없음.
  - `CardFace` 장비(권총) → 루트에 `equipment` 클래스.
  - `onClick` 없으면 버튼이 disabled / 있으면 클릭 시 호출.
  - `CharacterCard('orso')` → "갑판장 오르소", 하트 5개, `getByRole('button', { name: '갑판장 오르소 고르기' })`.
  - `RoleCard({ role: 'rebel', revealed: true })` → "반란 선원"과 `ROLE_GOAL.rebel` 텍스트. `revealed: false` → 역할 이름 없음.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat(ui): parchment card components and table theme"`

---

### Task 4: 연출 목록과 view 큐

**Files:**
- Create: `src/ui/anim/effects.ts`, `src/ui/anim/useAnimatedView.ts`
- Test: `tests/ui/effects.test.ts`, `tests/ui/animatedView.test.tsx`

**Interfaces:**
- Produces (`effects.ts`):
  ```ts
  export type Anchor = 'deck' | 'discard' | 'judge' | 'hand' | `seat:${number}` | `equip:${number}`;
  export type Effect =
    | { kind: 'fly'; from: Anchor; to: Anchor; via?: Anchor; card: CardView | null; flip?: boolean; at: number; ms: number }
    | { kind: 'shake'; seat: SeatId; at: number; ms: number }
    | { kind: 'float'; seat: SeatId; text: string; tone: 'damage' | 'heal'; at: number; ms: number }
    | { kind: 'judge'; card: CardView; success: boolean; at: number; ms: number }
    | { kind: 'death'; seat: SeatId; at: number; ms: number }
    | { kind: 'turn'; seat: SeatId; mine: boolean; at: number; ms: number };
  export const STAGGER_MS = 120;
  export function effectsFor(events: GameEvent[], you: SeatId): Effect[];  // at = 시작 시각(ms), 이벤트 순서대로 STAGGER_MS씩 증가
  export function totalMs(effects: Effect[]): number;                      // max(at + ms), 없으면 0
  ```
  매핑(스펙 6.3 표): 자기 자리 출발·도착 앵커는 손패면 `'hand'`, 남이면 `seat:n`.
  - `draw`: `seat === you`면 연출 없음(`drawCards`가 담당). 남이면 `count`장의 `fly deck→seat:n card:null` (장마다 stagger).
  - `drawCards`(내 것): 장마다 `fly deck→hand card flip:true`.
  - `play` 즉시 사용 카드: `fly (hand|seat:n)→discard card`, 대상 있으면 `via: seat:target`. 장비: `fly → equip:(target ?? seat)`.
  - `respond`/`discardCards`: 카드마다 `fly 출발→discard`.
  - `damage`: `shake` + `float "-N" damage`(같은 at). `heal`: `float "+N" heal`.
  - `judge`: `judge`. `steal`: `fly seat:from(또는 hand)→seat:to(또는 hand)`, card null이면 뒷면. `death`: `death`. `turnStart`: `turn`(`mine = seat === you`).
  - `characterChosen`, `peek`, `ability`, `gameOver`: 연출 없음.
  - 길이: fly 450, shake 400, float 600, judge 600, death 600, turn 500.
- Produces (`useAnimatedView.ts`):
  ```ts
  export interface AnimatedView { shown: PlayerView | null; effects: Effect[]; speed: 1 | 2; batchKey: number }
  export function useAnimatedView(latest: PlayerView | null, opts: { enabled: boolean }): AnimatedView;
  ```
  - 들어온 view를 큐에 쌓는다. 놀고 있으면 다음 view를 꺼내 `seq > lastSeq`인 이벤트로 `effectsFor` → 연출이 없거나 `enabled === false`면 즉시 `shown = view`. 있으면 `effects` 설정, `totalMs / speed` 뒤 `shown = view`, `batchKey++`.
  - 시작 전 큐 전체(지금 묶음 + 대기 view들)의 예상 길이 > 1500 → `speed 2`, > 3000 → 큐를 비우고 `shown = 최신 view`, `effects = []`, `lastSeq = 최신 view의 마지막 seq`.
  - **새 게임 감지**: 새 view의 이벤트 최대 seq < `lastSeq`이면 상태를 초기화(큐·타이머 제거, `lastSeq = 0`).
  - `latest === null`이면 모두 초기화하고 `shown = null`.
  - 첫 view(`shown === null`)는 연출 없이 즉시 표시하고 `lastSeq`를 그 view의 마지막 seq로.
  - 언마운트 시 타이머 정리.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `effects.test.ts` (이벤트 객체 직접 구성, you = 0):
    - 남의 `draw count 2` → fly 2개 `deck→seat:2`, card null, `at` 0과 120.
    - 내 `draw` → 연출 없음, 내 `drawCards` 2장 → `deck→hand flip:true` 2개.
    - 내 칼질 `play target 3` → `{ kind:'fly', from:'hand', to:'discard', via:'seat:3' }`.
    - 남의 권총 `play` → `to: 'equip:2'`; 영창 `play target 4` → `to: 'equip:4'`.
    - `damage amount 1 seat 3` → shake + float "-1" 같은 `at`.
    - `heal` → float "+1" tone heal. `judge` → judge. `death` → death. `characterChosen`·`gameOver` → [].
    - 모든 effect `ms <= 600`, 연속된 이벤트의 `at` 간격 = 120.
    - `totalMs([])` = 0, `totalMs` = max(at+ms).
  - `animatedView.test.tsx` (`renderHook`, `vi.useFakeTimers()`, view는 `PlayerView` 최소 객체를 만드는 도우미로 구성):
    - 첫 view → 즉시 `shown`, effects [].
    - 다음 view에 `damage` 이벤트 1개 → `shown`은 아직 이전 view, `effects` 2개; `totalMs` 경과 후 `shown`이 새 view.
    - `enabled: false` → 즉시 새 view.
    - **Review Focus 2**: 연출 있는 view 10개를 연달아 넣음(각 묶음 ~1000ms) → 큐 길이 > 3000이므로 `shown`이 곧바로 마지막 view, 이후 타이머를 돌려도 `shown` 유지.
    - 1500~3000 사이 → `speed === 2`, 실제 전환이 `totalMs/2` 뒤.
    - **Review Focus 3**: 연출 중에 `winner` 있는 view가 들어옴 → 타이머 진행 후 최종 `shown.winner`가 설정됨.
    - **Review Focus 4**: seq 50까지 진행한 뒤 seq 1~3짜리 새 게임 view → 초기화되어 즉시 표시, 그다음 seq 4 `damage` view는 정상적으로 연출 생성.
    - `latest = null` → `shown = null`, 남은 타이머가 나중에 `shown`을 바꾸지 않음.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat(ui): event-to-effect mapping and animated view queue"`

---

### Task 5: 연출 그리기 레이어

**Files:**
- Create: `src/ui/anim/anchors.ts`, `src/ui/anim/EffectLayer.tsx`
- Test: `tests/ui/effectLayer.test.tsx`

**Interfaces:**
- Produces (`anchors.ts`): 영역 요소에 `data-anchor="{Anchor}"`를 붙이는 규칙. `function anchorRect(a: Anchor): DOMRect | null` — `document.querySelector('[data-anchor="…"]')`의 `getBoundingClientRect()`, 없으면 null.
- Produces (`EffectLayer.tsx`): `function EffectLayer(p: { effects: Effect[]; speed: 1 | 2; batchKey: number }): JSX.Element` — 화면 전체를 덮는 `pointer-events: none` 레이어.
  - `fly`: `at/speed` 뒤에 `CardFace`(card 있으면) 또는 `CardBack`을 `from` 위치에 놓고 `framer-motion`으로 (`via`가 있으면 거쳐서) `to` 위치로 이동, `flip`이면 도착 직전 Y축 뒤집기. 위치가 null이면 그 연출은 건너뜀.
  - `float`: 해당 `seat:n`(내 자리면 `hand` 대신 내 정보 패널 `seat:{you}`) 위에서 위로 떠오르며 사라지는 텍스트. damage 빨강, heal 초록.
  - `shake`/`death`/`turn`: 레이어가 직접 그리지 않고, `TableScreen`이 effects에서 해당 seat를 찾아 패널에 `shake`/`dying`/`turn-glow` 클래스를 그 시간 동안 붙인다(Task 7).
  - `judge`: `judge` 앵커 위에 카드가 뒤집혀 나타나고 성공 초록·실패 빨강 테두리.
  - 각 요소에 `data-effect="{kind}"`. `batchKey`가 바뀌면 이전 묶음 요소는 제거.

- [ ] **Step 1: 실패하는 테스트 작성** (`vi.useFakeTimers()`, jsdom에서는 `getBoundingClientRect`가 0이므로 앵커 요소만 있으면 됨)
  - 앵커 `deck`, `hand` 요소를 렌더 → `fly deck→hand at 0` effect → `[data-effect="fly"]` 1개.
  - `at: 240`인 fly는 0ms 시점엔 없고 240ms 뒤 생김; `speed 2`면 120ms 뒤.
  - 앵커가 없는 fly는 그려지지 않음.
  - `float "-1"` → "-1" 텍스트, `damage` 클래스.
  - `batchKey` 변경 → 이전 요소 사라짐.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat(ui): effect layer with flying cards and floating numbers"`

---

### Task 6: 시작·뽑기·결과 화면

**Files:**
- Create: `src/ui/screens/SetupScreen.tsx`, `src/ui/screens/DraftScreen.tsx`, `src/ui/screens/ResultScreen.tsx`
- Modify: `src/ui/App.tsx`
- Delete: `src/ui/SetupScreen.tsx`, `src/ui/ResultScreen.tsx`
- Test: `tests/ui/screens.test.tsx`

**Interfaces:**
- Consumes: Task 3 컴포넌트, Task 2의 view.
- Produces:
  ```tsx
  export function SetupScreen(p: { onStart: (playerCount: number, name: string) => void }): JSX.Element
  export function DraftScreen(p: { view: PlayerView; send: (a: Action) => void }): JSX.Element
  export function ResultScreen(p: { view: PlayerView; onRestart: () => void }): JSX.Element
  export function App(p: { defaults?: Partial<LocalSetup> & { animations?: boolean } }): JSX.Element
  ```
  - `SetupScreen`: 양피지 두루마리, 제목 "반란의 돛", 부제, 이름 입력, 인원 버튼 "4명"~"7명"(카드 모양, 기본 5), 버튼 "출항".
  - `DraftScreen`: `RoleCard`(처음 렌더 후 뒤집힘), 역할 이름·`ROLE_GOAL`. `pending`이 내 `chooseCharacter`면 "캐릭터를 고르세요" + `CharacterCard` 2장(클릭 시 `chooseCharacter`). 아니면 "다른 선원들이 캐릭터를 고르는 중…" + 자리별 줄: 이름, 고른 캐릭터 이름 또는 "고르는 중"(지금 대기 중인 자리) / "대기"(아직 차례 아님). 내가 이미 골랐으면 내 `CharacterCard`를 보여줌.
  - `ResultScreen`: `winnerText` 크게, 자리마다 `RoleCard revealed`(0.2초 간격으로 차례로 뒤집힘) + 이름·캐릭터·쓰러짐 여부, 버튼 "다시 하기".
  - `App`: `setup === null` → Setup; `view === null` → "항해 준비 중…"; `view.winner` → Result; 아무 자리나 `character === null`(뽑기 중) → Draft; 그 외 → `TableScreen`(Task 7, 이 Task에서는 임시로 기존 `GameScreen` 유지). `defaults.animations`(기본 true)는 Task 7에서 `useAnimatedView`에 전달.

- [ ] **Step 1: 실패하는 테스트 작성** (`screens.test.tsx`, `App defaults={{ seed, aiDelayMs: 0, animations: false }}`)
  - Setup: "5명" 기본 선택, 이름 입력 후 "출항" → `onStart(5, '잭')`.
  - App 흐름: 인원 "4명" → "출항" → 역할 이름(선장/충성 선원/반란 선원/첩자 중 하나)과 그 승리 조건이 보임 → `findAllByRole('button', { name: /고르기$/ })`가 2개 → 하나 클릭 → 이후 `seat-panel`이 3개 보임(테이블 진입).
  - **Review Focus 1**: 사람 자리가 선장이 아닌 시드(테스트에서 시드를 찾아 고정)로 시작 → 첫 화면에 "다른 선원들이 캐릭터를 고르는 중" 텍스트가 보이거나, 이미 AI가 끝나 후보 2장이 보임; 결국 후보 2장이 나타남(`findAllByRole`, timeout 3000).
  - Result: `winner: 'rebels'` view → "반란 선원의 승리!", 역할 이름 n개, "다시 하기" 클릭 → `onRestart` 호출.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인(기존 `tests/ui/app.test.tsx`는 Task 7에서 갱신; 이 Task에서 깨지면 "시작"→"출항", 뽑기 단계 처리만 반영해 통과시킨다).
- [ ] **Step 5:** `git commit -m "feat(ui): setup, draft and result screens"`

---

### Task 7: 게임 테이블 화면

**Files:**
- Create: `src/ui/screens/TableScreen.tsx`, `src/ui/table/OpponentPanel.tsx`, `src/ui/table/FanHand.tsx`, `src/ui/table/CenterPile.tsx`, `src/ui/table/GameLog.tsx`, `src/ui/table/PromptNote.tsx`, `src/ui/table/MyArea.tsx`
- Modify: `src/ui/App.tsx`, `tests/ui/app.test.tsx`
- Delete: `src/ui/GameScreen.tsx`, `src/ui/SeatPanel.tsx`, `src/ui/HandView.tsx`, `src/ui/PromptDialog.tsx`, `src/ui/CardBox.tsx`, `src/ui/styles.css`
- Test: `tests/ui/table.test.tsx`, `tests/ui/app.test.tsx`

**Interfaces:**
- Consumes: Task 3·4·5.
- Produces: `function TableScreen(p: { latest: PlayerView; shown: PlayerView; effects: Effect[]; speed: 1 | 2; batchKey: number; send: (a: Action) => void; lastRejection: string | null }): JSX.Element`. `App`이 `useAnimatedView(view, { enabled: animations && !reducedMotion })`의 결과를 넘긴다. 결과 화면 판단은 `shown.winner` 기준(연출이 끝난 뒤 결과 화면).
- **그리기는 `shown`, 조작은 `latest`**:
  - 손패(`FanHand`)는 `shown.myHand`를 그리되, 누를 수 있는 카드 = `latest.myHand`에 있고 `latest.hints`에 있는 카드. 나머지는 `dim`.
  - 응답 창(`PromptNote`)과 턴 종료·능력 버튼은 `latest.pending` 기준.
- 배치(스펙 6.2):
  - `OpponentPanel`(`data-testid="seat-panel"`, `data-anchor="seat:n"`): 얼굴 이모지, 이름(+🤖), 캐릭터 이름(마우스 올리면 능력), ♥/♡ 체력, 손패 장수(`CardBack sm` 아이콘 + "×n"), 장비 `CardFace sm`(`data-anchor="equip:n"` 줄), 공개 역할, 거리, 선장 👑. 클래스: `current`(금빛 테두리), `dead`(흑백), `targetable`(대상 고르기 중 깜빡임), `out-of-range`(흐림), 그리고 effects의 `shake`/`death`/`turn` 시간 동안 `shake`/`dying`/`turn-glow`.
  - 상대들은 위쪽 호에 배치(최대 6명, 내 다음 자리부터 시계 방향 순서로 왼쪽→오른쪽).
  - `CenterPile`: `data-anchor="deck"`(CardBack + 장수), `data-anchor="discard"`(맨 위 CardFace), `data-anchor="judge"`(빈 자리).
  - `GameLog`: "항해 일지", `shown.events` 최근 8개 `formatEvent`.
  - `MyArea`: 내 정보 패널(`data-anchor="seat:{you}"`: 이름, 역할, 캐릭터, 능력 문구, 체력, 사거리), 내 장비(`data-anchor="equip:{you}"`), `FanHand`(`data-anchor="hand"`), "턴 종료", 데릭이면 "능력 사용". 쓰러졌으면 손패 대신 "관전 중" 띠.
  - 대상 고르기: 대상 필요한 카드를 누르면 들린 상태, `hint.targets`의 패널이 `targetable`. 다시 누르거나 Esc로 취소. 소매치기·밧줄 자르기는 패널을 누르면 작은 양피지 창: 대상 장비 `CardFace sm`들 + **대상 `handCount > 0`일 때만** "손패 무작위".
  - `PromptNote`: 기존 `PromptDialog`의 모든 경우를 양피지 쪽지 창(`role="dialog"`)으로. 버튼 문구 유지: "피하기 내기"/"맞기", "칼질 내기"/"맞기", "칼질 n장 내기"/"포기", "럼주 n장 내기"/"쓰러지기", "버리기 (k/n)", 전리품·판정 카드 고르기, 자리 고르기, "덱에서"/"버린 카드에서". 응답에 쓸 수 있는 카드는 손패에서 `highlight`.
  - 내 턴 시작 연출(`turn mine`) 동안 "내 차례!" 띠.
  - 거부 토스트(양피지 쪽지, 2초).

- [ ] **Step 1: 실패하는 테스트 작성**
  - `table.test.tsx` (view를 직접 구성해 `TableScreen` 렌더, effects [])
    - 5명 view → `seat-panel` 4개, 선장 패널에 👑, `data-anchor`가 `deck`, `discard`, `judge`, `hand`, `seat:0..4` 모두 존재.
    - hint에 있는 칼질 클릭 → 대상 패널에 `targetable`, 대상 클릭 → `send({ type:'playCard', cardId, target })`.
    - 소매치기, 대상 `handCount: 0` + 장비 1개 → 패널 클릭 시 "손패 무작위" 버튼 없음, 장비 카드 클릭 → `targetCardId` 포함 전송. `handCount: 2`면 "손패 무작위" 있음.
    - **Review Focus 5**: `shown.myHand`에 카드 X가 있지만 `latest.myHand`에는 없음 → X 클릭해도 `send` 호출 안 됨. `latest.myHand`에만 있는 카드 Y는 화면에 없음.
    - `latest.pending`이 내 `respondAttack`이고 손에 피하기 → 창에 "피하기 내기", 손패의 피하기가 `highlight`.
    - 내 자리 `alive: false` → "관전 중", 손패 없음.
    - effects에 `shake seat 2` → 2번 패널에 `shake` 클래스.
  - `app.test.tsx` 갱신: "출항" → 뽑기(첫 `/고르기$/` 버튼 클릭) → 기존 두 테스트(자리 패널·손패 표시, 기본 행동 자동 진행 → "관전 중" 또는 "다시 하기" → 역할 5개 표시). `animations: false`. **Review Focus 3**: 같은 테스트를 `animations: true`로 한 번 더 돌려 결과 화면까지 도달(timeout 20초).
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** `npm test`, `npm run typecheck`, `npm run build` PASS.
- [ ] **Step 5:** `git commit -m "feat(ui): wooden deck table screen with animations"`

---

### Task 8: 직접 플레이 확인과 마무리

**Files:**
- Modify: `README.md`, (발견한 문제의 수정 파일)

- [ ] **Step 1:** `npm run dev`를 백그라운드로 띄우고 브라우저(가능하면 자동화 도구로 스크린샷)로 한 판: 시작 → 역할 공개·캐릭터 고르기 → 카드 내기(대상 선택) → 공격받기 응답 → AI 턴 연출(뽑기·내기·피격) → 결과 화면. 스크린샷을 직접 보고 확인: 카드가 양피지로 보임, 손패 부채꼴, 상대 호 배치, 애니메이션 동작, 폭 360px에서 가로 스크롤 없음.
- [ ] **Step 2:** 발견한 문제는 실패하는 테스트를 먼저 쓰고 고친다.
- [ ] **Step 3:** README에 캐릭터 뽑기와 화면 설명 2~3줄 추가.
- [ ] **Step 4:** `npm run typecheck && npm test && npm run build` 성공. 원작 이름 grep(1단계 계획 Task 13과 같은 패턴) 0건.
- [ ] **Step 5:** `git commit -m "docs: README for table UI"`
