# 반란의 돛 — 1단계(1인 플레이) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저 한 곳에서 사람 1명 + AI 3~6명이 해적 테마 숨겨진 역할 카드 게임을 끝까지 플레이할 수 있게 만든다. 규칙 엔진, 방장 세션, 연결 방식, 화면을 층으로 나눠서 3단계에서 연결 구현체만 추가하면 온라인이 되게 한다.

**Architecture:** `engine/`은 순수 TypeScript 규칙 엔진이다(카드와 캐릭터를 클래스 상속으로 표현하고, 응답 대기를 내부 스택으로 관리한다). `host/`의 `HostSession`이 엔진을 돌리며 자리마다 조종자(사람 연결 또는 AI)를 붙이고, 플레이어별로 가린 `PlayerView`를 `Transport`로 보낸다. `ai/`와 `ui/`는 똑같이 `Transport`로 붙어서 `PlayerView`만 보고 `Action`을 보낸다.

**Tech Stack:** TypeScript 5, React 18, Vite 5, Vitest 2, @testing-library/react, jsdom.

**Spec:** `docs/superpowers/specs/2026-11-19-pirate-card-game-design.md`

## Global Constraints

- 원작 게임의 이름·캐릭터·카드 문구·그림을 코드, 문자열, 주석 어디에도 쓰지 않는다. 카드·캐릭터 이름은 스펙 6.5, 6.6의 한국어 이름을 그대로 쓴다.
- 화면 문자열은 한국어.
- 결과물은 정적 파일(`npm run build` → `dist/`). 서버 코드 없음.
- `engine/`은 `host/`, `net/`, `ai/`, `ui/`를 import하지 않는다. `ui/`와 `ai/`는 `engine/`의 **타입**과 `engine/cards/catalog.ts`의 정적 정보만 import하고, `Game` 인스턴스에 접근하지 않는다.
- `Transport`로 오가는 모든 메시지는 JSON 직렬화 가능해야 한다(함수, 클래스 인스턴스, `Map`, `Set`, `undefined`를 담은 배열 금지).
- `PlayerView`에는 자기 손패 외의 손패 내용, 살아있는 남의 역할(선장 제외), 덱 순서가 들어가면 안 된다.
- 거리, 무기 사거리, 뽑기 장수, 칼질 횟수 제한, 손패 한도는 반드시 `engine/rules.ts`의 함수를 거쳐 계산한다(2단계 바다 이벤트가 `RuleModifier`로 끼어들 자리).
- 덱 80장, 문양마다 20장. ♠ 중 숫자 2~9가 12장.
- 인원 4~7명.

## Review Focus

1. **덱과 버린 카드가 모두 바닥났는데 뽑아야 하는 경우**(전리품 분배, 상선 약탈, 판정) → 가능한 만큼만 뽑고 예외 없이 진행. 판정할 카드가 없으면 판정 실패로 처리. 테스트: Task 5.
2. **여러 명에게 차례로 응답받는 도중 게임이 끝나거나 누군가 쓰러지는 경우**(포격으로 선장이 쓰러짐) → 남은 응답 대기를 버리고 즉시 게임 종료, 쓰러진 사람에게는 응답을 묻지 않음. 테스트: Task 6.
3. **자기 턴에 쓰러지는 경우**(화약통 폭발, 결투에서 짐) → 다음 살아있는 사람에게 턴이 넘어감. 화약통으로 쓰러지면 보상/벌칙 없음. 테스트: Task 7.
4. **차례가 아닌 사람의 행동, 이미 쓴 카드, 중복 클릭** → `rejected`로 거부, 상태 변화 없음. 테스트: Task 4, Task 10.
5. **사람이 먼저 쓰러진 경우** → 화면은 관전 상태로 바뀌고 AI끼리 끝까지 진행, 결과 화면이 나옴. 테스트: Task 10(호스트), Task 12(화면).

---

## 파일 구조

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore, README.md
src/
  main.tsx
  engine/
    types.ts            공용 타입 (Suit, Role, SeatId, Action, PendingView, GameEvent ...)
    rng.ts              시드 난수
    cards/
      catalog.ts        카드 종류별 이름·장수·설명 (정적 데이터, ui/ai도 사용)
      Card.ts           Card / ActionCard / EquipmentCard / WeaponCard 기반 클래스
      actions.ts        즉시 사용 카드 클래스 12종
      equipment.ts      장비 카드 클래스 10종
      deck.ts           80장 덱 생성
    characters/
      Character.ts      Character 기반 클래스 (훅 기본값)
      roster.ts         캐릭터 10명 + 정적 정보
    rules.ts            거리·사거리·한도 계산 + RuleModifier
    judge.ts            판정
    Game.ts             게임 상태, 턴 진행, 응답 스택, 피해·쓰러짐·승리
    defaults.ts         응답 대기별 시간 초과 기본 행동
    legal.ts            낼 수 있는 카드·대상 힌트
  net/
    Transport.ts        연결 인터페이스
    LocalTransport.ts   같은 페이지 안 구현체
  host/
    messages.ts         ClientMessage / ServerMessage
    view.ts             buildView (정보 가리기)
    HostSession.ts      엔진 + 자리별 조종자 + 타이머
  ai/
    memory.ts           적대도 추정
    decide.ts           PlayerView → Action
    AiPlayer.ts         Transport에 붙는 AI
  ui/
    useLocalGame.ts     1인 플레이 조립 훅
    App.tsx, SetupScreen.tsx, GameScreen.tsx, SeatPanel.tsx, HandView.tsx,
    PromptDialog.tsx, ResultScreen.tsx, format.ts, styles.css
tests/                  src와 같은 구조의 *.test.ts(x)
```

---

### Task 1: 프로젝트 뼈대

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/ui/App.tsx`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm test`(= `vitest run`), `npm run dev`, `npm run build`(= `tsc -b && vite build`), `npm run typecheck`(= `tsc --noEmit`).

- [ ] **Step 1:** 프로젝트 폴더에서 `git init`. `.gitignore`에 `node_modules`, `dist`, `.vite`, `coverage`.
- [ ] **Step 2:** Vite React-TS 구성 파일을 직접 만들고 `npm install react@18 react-dom@18` / `npm install -D typescript@5 vite@5 @vitejs/plugin-react vitest@2 jsdom @testing-library/react @testing-library/jest-dom @types/react@18 @types/react-dom@18`. `vite.config.ts`에 `base: './'`(GitHub Pages 하위 경로 대응), `test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'] }`. `tsconfig`는 `strict: true`.
- [ ] **Step 3:** `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`. `App.tsx`는 `<h1>반란의 돛</h1>`만.
- [ ] **Step 4:** `npm test` → 1 passed. `npm run build` → `dist/index.html` 생성.
- [ ] **Step 5:** 커밋 (스펙 문서 포함): `git add -A && git commit -m "chore: scaffold Vite React TS project"`

---

### Task 2: 공용 타입, 난수, 카드 카탈로그, 덱

**Files:**
- Create: `src/engine/types.ts`, `src/engine/rng.ts`, `src/engine/cards/catalog.ts`, `src/engine/cards/deck.ts`
- Test: `tests/engine/rng.test.ts`, `tests/engine/deck.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
  export type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14; // 11=J 12=Q 13=K 14=A
  export type SeatId = number;           // 0..n-1, 앉은 순서(시계 방향)
  export type CardId = string;           // 'c0'..'c79'
  export type Role = 'captain' | 'loyalist' | 'rebel' | 'spy';
  export type CardKind =
    | 'slash'|'dodge'|'rum'|'cannonade'|'brawl'|'duel'|'pickpocket'|'cutRope'
    | 'supplyShip'|'merchantRaid'|'feast'|'loot'
    | 'pistol'|'musket'|'longMusket'|'deckCannon'|'twinPistols'
    | 'spyglass'|'dinghy'|'barrel'|'powderKeg'|'brig';
  export type CharacterId = 'tom'|'margo'|'lou'|'derrick'|'orso'|'nico'|'hanna'|'sila'|'bibi'|'bruno';
  export interface CardView { id: CardId; kind: CardKind; suit: Suit; rank: Rank }
  ```
  `Action`, `PendingView`, `GameEvent`, `PlayerView`는 해당 Task에서 `types.ts`에 추가한다.
- Produces (`rng.ts`): `class Rng { constructor(seed: number); next(): number /*[0,1)*/; int(n: number): number /*[0,n)*/; shuffle<T>(a: T[]): T[] /*제자리 섞고 같은 배열 반환*/; pick<T>(a: readonly T[]): T }` — mulberry32.
- Produces (`catalog.ts`):
  ```ts
  export interface CardInfo { kind: CardKind; name: string; count: number; category: 'action'|'equipment'; emoji: string; text: string }
  export const CARD_CATALOG: Record<CardKind, CardInfo>;
  ```
  이름·장수·효과 문구는 스펙 6.5 표 그대로(칼질 23장). 이모지는 구현자 선택.
- Produces (`deck.ts`): `function buildDeckSpec(rng: Rng): CardView[]` — 80장, id `c0`~`c79`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `rng.test.ts`: 같은 시드 → `next()` 10회 결과 동일, 다른 시드 → 다름; `int(5)` 1000회 모두 0~4; `shuffle`이 원소 집합 보존.
  - `deck.test.ts`:
    - `buildDeckSpec(new Rng(1)).length === 80`, id 중복 없음.
    - 종류별 장수가 `CARD_CATALOG[kind].count`와 일치, 합계 80.
    - 문양별 20장씩.
    - ♠ 중 rank 2~9가 정확히 12장.
    - 어떤 종류도 장수의 70% 넘게 한 문양에 몰리지 않음(장수 ≥ 4인 종류만 검사).
- [ ] **Step 2:** `npm test` → FAIL(모듈 없음).
- [ ] **Step 3:** 구현. 문양·숫자 배정: 4문양×13숫자 = 52개 조합에 ♠ 2~9 중 12칸이 들어가도록 80칸 슬롯표(문양, 숫자)를 먼저 만들고, 카드 종류 목록을 섞어 슬롯에 순서대로 배정한 뒤 몰림 조건을 만족할 때까지 다시 섞는다(시드 고정이라 결정적).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `git commit -m "feat(engine): types, rng, card catalog, deck"`

---

### Task 3: 카드·캐릭터 클래스 뼈대, 게임 준비, 거리 규칙

**Files:**
- Create: `src/engine/cards/Card.ts`, `src/engine/characters/Character.ts`, `src/engine/characters/roster.ts`, `src/engine/rules.ts`, `src/engine/Game.ts`
- Test: `tests/engine/setup.test.ts`, `tests/engine/rules.test.ts`

**Interfaces:**
- Produces (`Card.ts`):
  ```ts
  export interface PlayParams { target?: SeatId; targetCardId?: CardId } // targetCardId 없음 = 대상 손패 무작위
  export abstract class Card {
    constructor(readonly id: CardId, readonly kind: CardKind, readonly suit: Suit, readonly rank: Rank);
    get info(): CardInfo;           // CARD_CATALOG[kind]
    toView(): CardView;
  }
  export abstract class ActionCard extends Card {
    abstract validate(game: Game, actor: SeatId, p: PlayParams): string | null; // null=가능, 문자열=거부 사유(한국어)
    abstract play(game: Game, actor: SeatId, p: PlayParams): void;
  }
  export abstract class EquipmentCard extends Card {
    placement(): 'self' | 'other';   // 영창만 'other'
    validate(game: Game, actor: SeatId, p: PlayParams): string | null; // 기본: 같은 종류 중복 금지
    onEquip(game: Game, owner: SeatId): void; // 기본 없음
  }
  export abstract class WeaponCard extends EquipmentCard { abstract readonly range: number; readonly unlimitedSlash: boolean = false }
  export function createCard(spec: CardView): Card; // kind → 클래스 (actions.ts, equipment.ts 등록 테이블)
  ```
  이 Task에서는 `createCard`가 Task 4~7에서 추가될 클래스 테이블을 참조하는 빈 레지스트리(`registerCard(kind, ctor)`)로 시작한다.
- Produces (`Character.ts`): 훅 기본값을 가진 기반 클래스. 이후 Task에서 훅을 추가할 때 여기 기본값을 넣는다.
  ```ts
  export abstract class Character {
    abstract readonly id: CharacterId; abstract readonly name: string; abstract readonly maxHp: number; abstract readonly text: string;
    rumHeal(): number { return 1 }
    handLimitBonus(): number { return 0 }
    distanceBonusAgainstMe(game: Game, me: SeatId): number { return 0 }
    judgeFlipCount(): 1 | 2 { return 1 }
    duelSlashesRequiredFromOpponent(): number { return 1 }
  }
  ```
- Produces (`roster.ts`): `CHARACTERS: Record<CharacterId, Character>`, `CHARACTER_INFO: Record<CharacterId, {name; maxHp; text}>`(ui용 정적 정보). 이름·체력·문구는 스펙 6.6.
- Produces (`rules.ts`):
  ```ts
  export interface RuleModifier {
    distanceDelta?(from: SeatId, to: SeatId): number;
    drawCount?(base: number): number;
    slashLimit?(base: number): number;
  }
  export function seatDistance(game: Game, from: SeatId, to: SeatId): number; // 살아있는 자리만 셈, 양쪽 중 짧은 쪽
  export function distance(game: Game, from: SeatId, to: SeatId): number;     // + 보트/망원경/캐릭터/modifier, 최소 1
  export function weaponRange(game: Game, seat: SeatId): number;               // 무기 없으면 1
  export function drawCount(game: Game, seat: SeatId): number;                 // 기본 2
  export function slashLimit(game: Game, seat: SeatId): number;                // 기본 1, 쌍권총 Infinity
  export function handLimit(game: Game, seat: SeatId): number;                 // hp + 캐릭터 보너스
  ```
- Produces (`Game.ts`) — 이 Task 분량:
  ```ts
  export interface GameConfig { seed: number; names: string[]; roles?: Role[]; characters?: CharacterId[]; stackDeck?: CardView[] }
  // roles/characters/stackDeck은 테스트용 강제값. stackDeck은 덱 맨 위부터의 순서(남은 카드는 일반 덱에서 그 카드들을 뺀 나머지를 섞어 뒤에 붙임)
  export interface SeatState { seat: SeatId; name: string; role: Role; character: Character; hp: number; maxHp: number;
    hand: Card[]; equipment: Card[]; alive: boolean }
  export class Game {
    constructor(config: GameConfig);
    readonly seats: SeatState[]; deck: Card[]; discard: Card[]; rng: Rng;
    modifiers: RuleModifier[];          // 1단계는 항상 []
    current: SeatId;                    // 지금 턴인 자리
    winner: 'captainTeam' | 'rebels' | 'spy' | null;
    events: Array<GameEvent>;           // Task 4에서 정의
    captainSeat(): SeatId;
    aliveSeats(): SeatId[];             // 시계 방향 순서
    draw(n: number): Card[];            // 덱 부족 시 버린 카드 섞어 보충, 그래도 부족하면 가능한 만큼
  }
  ```
  역할 배분: 4명 `[captain, spy, rebel, rebel]`, 5명 +`loyalist`, 6명 +`rebel`, 7명 +`loyalist`, 섞어서 자리에 배정. 선장이 첫 턴(`current = captainSeat()`). 캐릭터 무작위 중복 없음. 체력 = 캐릭터 maxHp(+선장 1), 시작 손패 = 체력.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `setup.test.ts`:
    - 4/5/6/7명 각각 역할 개수가 스펙 6.1과 일치.
    - 선장 `maxHp === character.maxHp + 1`, 모든 자리 `hand.length === hp`, `deck.length === 80 - 손패 합`.
    - `current === captainSeat()`.
    - 같은 시드 두 게임의 역할·캐릭터·손패 id가 동일.
    - 덱 0장 + 버린 카드 5장에서 `draw(3)` → 3장, `draw(10)` → 나머지 2장만, 예외 없음 (Review Focus 1).
  - `rules.test.ts` (5명, 모두 장비 없음):
    - `distance(0,1)=1`, `distance(0,2)=2`, `distance(0,3)=2`, `distance(0,4)=1`.
    - 2번 자리가 쓰러지면 `distance(1,3)=1`.
    - 상대에게 작은 보트 → +1, 내게 망원경 → −1, 둘 다 → 원래 값, 최소 1 유지.
    - `weaponRange` 무기 없음 1, 권총 2, 선상 대포 5.
    - `modifiers`에 `{distanceDelta: () => 1}`을 넣으면 모든 거리 +1 (바다 이벤트 자리 검증).
    - `handLimit` = hp, 갑판장 오르소는 hp+2.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** 구현. 장비 클래스가 아직 없으므로 테스트에서는 `equipment`에 Task 7 전까지 쓸 최소 장비 클래스(`pistol`, `deckCannon`, `spyglass`, `dinghy`)를 이 Task에서 `equipment.ts`에 먼저 만든다. 오르소, 한나 캐릭터의 해당 훅도 이 Task에서 구현.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `git commit -m "feat(engine): card/character base classes, setup, distance rules"`

---

### Task 4: 턴 진행, 응답 스택, 칼질·피하기·럼주

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/Game.ts`
- Create: `src/engine/cards/actions.ts`
- Test: `tests/engine/turn.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Action =
    | { type: 'playCard'; cardId: CardId; target?: SeatId; targetCardId?: CardId }
    | { type: 'useAbility'; cardIds: CardId[] }          // 포수 데릭
    | { type: 'endTurn' }
    | { type: 'respond'; cardIds: CardId[] }              // 피하기/칼질/럼주 내기. [] = 안 냄(맞기·포기)
    | { type: 'discard'; cardIds: CardId[] }
    | { type: 'chooseCard'; cardId: CardId }              // 전리품 선택, 실라 판정 선택
    | { type: 'chooseSeat'; target: SeatId }              // 마고 엿보기, 비비 화약통 넘기기
    | { type: 'chooseDrawSource'; fromDiscard: boolean }; // 밀수꾼 루

  export type PendingView =
    | { kind: 'turn'; seat: SeatId }
    | { kind: 'respondAttack'; seat: SeatId; attacker: SeatId; source: 'slash' | 'cannonade' }
    | { kind: 'respondBrawl'; seat: SeatId; attacker: SeatId }
    | { kind: 'respondDuel'; seat: SeatId; opponent: SeatId; required: number }
    | { kind: 'dying'; seat: SeatId; need: number }        // 살아나려면 내야 할 럼주 장수
    | { kind: 'discardExcess'; seat: SeatId; count: number }
    | { kind: 'loot'; seat: SeatId; revealed: CardView[] }
    | { kind: 'judgeChoice'; seat: SeatId; options: CardView[] }
    | { kind: 'peekTarget'; seat: SeatId }
    | { kind: 'passKeg'; seat: SeatId }
    | { kind: 'drawSource'; seat: SeatId };

  export type GameEvent = ({ visibleTo?: SeatId[] }) & (   // visibleTo 없음 = 공개
    | { type: 'turnStart'; seat: SeatId }
    | { type: 'draw'; seat: SeatId; count: number }
    | { type: 'drawCards'; seat: SeatId; cards: CardView[] } // 본인에게만 visibleTo
    | { type: 'play'; seat: SeatId; card: CardView; target?: SeatId }
    | { type: 'respond'; seat: SeatId; cards: CardView[] }
    | { type: 'damage'; seat: SeatId; amount: number; source: SeatId | null }
    | { type: 'heal'; seat: SeatId; amount: number }
    | { type: 'judge'; seat: SeatId; card: CardView; success: boolean; reason: CardKind }
    | { type: 'steal'; from: SeatId; to: SeatId; card: CardView | null } // card는 공개 장비면 공개, 손패면 당사자들만
    | { type: 'discardCards'; seat: SeatId; cards: CardView[] }
    | { type: 'peek'; seat: SeatId; target: SeatId; card: CardView } // 본인만
    | { type: 'death'; seat: SeatId; role: Role; killer: SeatId | null }
    | { type: 'ability'; seat: SeatId; character: CharacterId }
    | { type: 'gameOver'; winner: 'captainTeam' | 'rebels' | 'spy' });
  ```
- Produces (`Game.ts`):
  ```ts
  pending(): PendingView | null;          // 지금 기다리는 입력 (gameOver면 null)
  apply(seat: SeatId, action: Action): { ok: true } | { ok: false; reason: string };
  // 엔진 내부 API (카드·캐릭터 클래스가 사용)
  dealDamage(target: SeatId, amount: number, source: SeatId | null): void;
  heal(seat: SeatId, amount: number): void;
  pushInput(p: PendingView, resolve: (a: Action) => string | null): void; // resolve가 문자열 반환 = 거부
  pushStep(run: () => void): void;         // 입력 없이 실행할 후속 단계
  slashesPlayedThisTurn: number;
  discardCard(c: Card): void;
  ```
  응답 스택: `Game`은 내부에 단계 스택을 둔다. 입력 대기 단계는 `pending()`으로 노출되고, `apply`가 맞는 자리·맞는 행동이면 `resolve`를 부르고, 이어서 입력이 필요 없는 단계들을 다음 입력 대기가 나올 때까지 실행한다. 여러 대상 카드는 앉은 순서대로 대상별 단계를 쌓는다(먼저 응답할 대상이 스택 맨 위). 이 스택은 직렬화하지 않는다(방장만 가짐).
  - 턴: 시작 → (Task 7 판정) → 뽑기 `drawCount`장 → `turn` 입력 대기 → `endTurn` → 손패 > `handLimit`이면 `discardExcess` → 다음 살아있는 자리.
  - 칼질: `distance ≤ weaponRange`, `slashesPlayedThisTurn < slashLimit`, 대상은 자신 제외 생존자. 대상에게 `respondAttack`. 피하기 1장 → 무효, `[]` → 1 피해.
  - 럼주: 자기 턴에 사용, `hp < maxHp`일 때만, 살아있는 인원이 2명이면 거부("두 명만 남으면 럼주를 쓸 수 없어요").
  - 피해로 hp ≤ 0 → `dying` 입력 대기, `need = ceil((1 - hp) / rumHeal())` (럼주 몇 장이면 hp가 1 이상이 되는지). 럼주를 `need`장 내면 `hp += need × rumHeal()`(최대 체력 한도)로 살아남음. 못 내면 쓰러짐(Task 6). 살아있는 인원이 2명이면 `dying`을 묻지 않고 바로 쓰러짐.
  - 거부 사유는 한국어 문자열.

- [ ] **Step 1: 실패하는 테스트 작성** (`stackDeck`, `roles`, `characters`로 상황 고정, 캐릭터는 능력 없는 쪽 위주로 지정하되 Task 9 전이므로 능력 훅 기본값만 동작)
  - 선장 턴 시작 시 손패가 `hp + 2`, `pending()`이 `{kind:'turn', seat: captain}`.
  - 칼질 → 대상 `respondAttack`; 대상이 피하기로 응답 → 피해 없음, 칼질·피하기 모두 버린 카드로.
  - 칼질 → 대상 `respond []` → hp −1, `damage` 이벤트 `source = 공격자`.
  - 같은 턴 두 번째 칼질 → `{ok:false}`, 손패 변화 없음.
  - 사거리 밖 대상 칼질 → 거부.
  - **Review Focus 4**: 턴이 아닌 자리의 `playCard` → 거부, `respondAttack` 대기 중 공격자의 `endTurn` → 거부, 손에 없는 cardId → 거부, 같은 `respond`를 두 번 보내면 두 번째 거부. 거부 시 `events.length`와 모든 손패 id 불변.
  - 럼주: hp가 가득이면 거부, 깎인 상태면 +1, 2명만 남았으면 거부.
  - `endTurn` 시 손패 6장, hp 4 → `discardExcess count 2`; 2장 버리면 다음 자리 `turn`.
  - hp 1에서 피해 → `dying need 1`; 럼주 1장 응답 → hp 1, 살아있음.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `git commit -m "feat(engine): turn flow, response stack, slash/dodge/rum"`

---

### Task 5: 나머지 즉시 사용 카드

**Files:**
- Modify: `src/engine/cards/actions.ts`
- Test: `tests/engine/actions.test.ts`

**Interfaces:**
- Consumes: Task 4의 `Game` 내부 API, `PlayParams`.
- Produces: `cannonade, brawl, duel, pickpocket, cutRope, supplyShip, merchantRaid, feast, loot` 클래스 등록.

규칙(스펙 6.5):
- 포격: 사용자 제외 생존자에게 앉은 순서(사용자 다음 자리부터)로 `respondAttack source:'cannonade'`. 칼질 횟수에 안 셈.
- 갑판 난투: 같은 순서로 `respondBrawl`, 칼질 1장 내거나 1 피해.
- 결투: 대상부터 번갈아 `respondDuel`, `required`장의 칼질을 냄. 못 내면(`[]`) 그 사람이 1 피해, `source` = 상대. 거리·칼질 횟수 무관.
- 소매치기: `distance === 1`인 대상만. `targetCardId` 있으면 그 장비, 없으면 손패 무작위 1장을 내 손으로. 손패도 장비도 없는 대상이면 거부.
- 밧줄 자르기: 거리 무관, 같은 방식으로 버리게 함.
- 보급선 2장, 상선 약탈 3장 뽑기.
- 선상 잔치: 모든 생존자 +1 (최대 체력 한도). 2명 남았을 때도 사용 가능(스펙상 럼주만 제한).
- 전리품 분배: 생존자 수만큼 덱에서 공개, 사용자부터 시계 방향으로 `loot` 대기 → `chooseCard`. 마지막 1장은 마지막 사람에게 자동.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 5명, 포격: 응답 순서가 `[actor+1, actor+2, actor+3, actor+4]`이고, 피하기를 낸 사람은 피해 없음, `[]`는 1 피해.
  - 갑판 난투: 칼질을 낸 사람 피해 없음.
  - 결투: 대상이 칼질 1장 → 사용자 차례 → 사용자 `[]` → 사용자 hp −1, `damage.source === 대상`.
  - 소매치기: 거리 2 대상 → 거부; 거리 1 대상 장비 지정 → 그 장비가 내 손패로 이동; 미지정 → 대상 손패 1장 감소, 내 손패 1장 증가.
  - 밧줄 자르기: 대상 손패가 0장이고 장비도 없으면 거부.
  - 보급선 → 손패 +1(사용 1장 소모, 2장 뽑음), 상선 약탈 → +2.
  - 선상 잔치: 다친 사람만 +1, 최대 체력 넘지 않음.
  - 전리품 분배 5명: 첫 `loot` 대기의 `revealed.length === 5`, 4번 선택 후 마지막 사람 손패 +1, 모두 1장씩 받음.
  - **Review Focus 1**: 덱 2장, 버린 카드 0장에서 전리품 분배(5명) → 공개 2장, 2명만 고르고 끝, 예외 없음. 덱·버린 카드 0장에서 상선 약탈 → 0장 뽑고 진행.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat(engine): remaining action cards"`

---

### Task 6: 쓰러짐, 보상·벌칙, 승리 판정

**Files:**
- Modify: `src/engine/Game.ts`
- Test: `tests/engine/death.test.ts`

**Interfaces:**
- Produces: `Game.winner`, `gameOver` 이벤트, `death` 이벤트. 게임 종료 후 `pending() === null`, 모든 `apply` 거부.

규칙(스펙 6.2):
- 쓰러지면 `alive=false`, 역할 공개(`death` 이벤트), 손패·장비 버림.
- `killer`가 있고 쓰러진 사람이 반란 선원이면 killer가 3장 뽑음. killer가 선장이고 쓰러진 사람이 충성 선원이면 선장 손패·장비 전부 버림.
- 승리: 선장 쓰러짐 → 생존자가 첩자 1명뿐이면 `spy`, 아니면 `rebels`. 반란 선원과 첩자가 모두 쓰러짐 → `captainTeam`. 쓰러질 때마다 즉시 검사.
- 게임이 끝나면 스택의 남은 단계를 모두 버린다. 쓰러진 사람을 대상으로 쌓여 있던 응답 단계는 건너뛴다.
- 지금 턴인 사람이 쓰러지면 남은 턴 단계를 버리고 다음 생존자의 턴을 시작한다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 반란 선원을 칼질로 쓰러뜨리면 공격자 손패 +3, `death.role === 'rebel'`.
  - 선장이 충성 선원을 쓰러뜨리면 선장 손패 0, 장비 0.
  - 4명(선장, 첩자, 반란, 반란): 반란 둘이 쓰러지고 첩자가 선장을 쓰러뜨림 → `winner === 'spy'`.
  - 선장이 쓰러질 때 반란이 1명이라도 살아있으면 `rebels`.
  - 반란·첩자 전원 쓰러짐 → `captainTeam`.
  - **Review Focus 2**: 5명, 선장 hp 1, 반란 선원이 포격 → 선장이 첫 응답자가 되도록 자리 배치, 선장 `[]`(럼주 없음) → 즉시 `winner === 'rebels'`, `pending() === null`, 나머지 3명에게 응답을 묻지 않음, 이후 `apply` 거부.
  - 포격 도중 두 번째 응답자가 쓰러져도 세 번째 응답자에게 정상적으로 `respondAttack`.
  - 결투에서 사용자 자신이 쓰러짐 → 다음 생존자 `turn`.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat(engine): death, rewards/penalties, win conditions"`

---

### Task 7: 장비 카드와 판정

**Files:**
- Modify: `src/engine/cards/equipment.ts`, `src/engine/Game.ts`
- Create: `src/engine/judge.ts`
- Test: `tests/engine/equipment.test.ts`

**Interfaces:**
- Produces (`judge.ts`): `function judge(game: Game, seat: SeatId, reason: CardKind, success: (c: CardView) => boolean, then: (ok: boolean) => void): void` — 덱 맨 위를 뒤집어 버린 카드로, `judge` 이벤트. 캐릭터 `judgeFlipCount() === 2`면 2장 뒤집고 `judgeChoice` 대기(Task 9에서 실라가 사용, 이 Task에서는 훅 경로만 구현). 뒤집을 카드가 없으면 `ok=false`.

규칙(스펙 6.5):
- 무기 5종: 하나만, 새 무기 장착 시 기존 무기 버림. 쌍권총은 `slashLimit = Infinity`.
- 같은 종류 장비 중복 장착 거부.
- 엄폐용 나무통: `respondAttack`(칼질·포격) 대기를 만들기 직전에 판정. ♥ → 피한 것으로 처리(대기 없음). 아니면 평소처럼 대기.
- 화약통: 자기 앞에 놓음. 턴 시작 시 판정 ♠ 2~9 → 3 피해(`source: null`), 버림. 아니면 왼쪽(다음 생존자) 사람 앞으로 이동.
- 영창: 선장 제외한 다른 생존자 앞에 놓음, 같은 사람에게 중복 불가. 그 사람 턴 시작 시 판정 ♥ → 정상 진행, 아니면 턴 건너뜀. 판정 후 버림.
- 턴 시작 순서: 화약통 → 영창 → (마고 엿보기, Task 9) → 뽑기. 화약통으로 쓰러지면 그 턴은 바로 다음 사람으로.

- [ ] **Step 1: 실패하는 테스트 작성** (`stackDeck`으로 판정 카드 고정)
  - 권총 장착 후 머스킷 장착 → 장비에 머스킷만, 권총은 버린 카드.
  - 망원경 2장째 장착 거부.
  - 쌍권총 장착 시 한 턴 칼질 3회 가능.
  - 나무통 + 판정 ♥ → 칼질 대상에게 `respondAttack` 없이 피해 없음, `judge.success === true`. 판정 ♣ → `respondAttack` 대기.
  - 화약통 판정 ♠5 → 3 피해 후 버림. 판정 ♠10 → 다음 생존자 장비로 이동, 피해 없음.
  - 영창 → 선장 대상 거부. 대상 턴 시작 판정 ♦ → 그 사람 턴 건너뛰고 다음 사람 `turn`, 영창은 버린 카드. 판정 ♥ → 정상 `turn`.
  - 화약통과 영창이 둘 다 있으면 `judge` 이벤트 순서가 `powderKeg` → `brig`.
  - **Review Focus 3**: hp 3인 사람이 화약통 폭발로 쓰러짐(럼주 없음) → 다음 생존자 `turn`, `death.killer === null`, 그 사람이 반란이어도 아무도 3장 받지 않음.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat(engine): equipment cards and judgment"`

---

### Task 8: 캐릭터 능력 10종

**Files:**
- Modify: `src/engine/characters/Character.ts`, `src/engine/characters/roster.ts`, `src/engine/Game.ts`, 필요한 카드 클래스
- Test: `tests/engine/characters.test.ts`

**Interfaces:**
- Produces: `Character`에 추가 훅(기본값 포함). 엔진의 해당 시점에서 호출.
  ```ts
  onTurnStartBeforeDraw(game: Game, me: SeatId): void {}        // 마고: peekTarget 대기
  offersDiscardDraw(): boolean { return false }                  // 루
  canUseAbility(game: Game, me: SeatId, cardIds: CardId[]): string | null { return '능력이 없어요' } // 데릭
  useAbility(game: Game, me: SeatId, cardIds: CardId[]): void {}
  onSlashDamageDealt(game: Game, me: SeatId, victim: SeatId): void {} // 니코
  passesKegFreely(): boolean { return false }                    // 비비
  ```
  `rumHeal`(톰), `handLimitBonus`(오르소), `distanceBonusAgainstMe`(한나), `judgeFlipCount`(실라), `duelSlashesRequiredFromOpponent`(브루노)는 Task 3 훅 사용.

능력 세부(스펙 6.6 + 구현 판단):
- 톰: 럼주 1장 = 2 회복(최대 체력 한도). 쓰러질 때도 적용(`dying.need` 계산에 반영).
- 마고: 화약통·영창 판정 뒤, 뽑기 전에 `peekTarget` 대기 → 손패가 있는 다른 생존자 선택 → 무작위 1장을 `peek` 이벤트로 본인에게만. 손패 있는 상대가 없으면 대기 생략.
- 루: 버린 카드가 1장 이상이면 `drawSource` 대기. `fromDiscard: true`면 첫 장을 버린 카드 맨 위에서, 나머지는 덱에서.
- 데릭: 자기 턴에 `useAbility` + 칼질 2장 → 두 장 버리고 포격 효과, 턴당 1회. 칼질 횟수에 안 셈.
- 니코: 칼질 카드로 1 피해를 준 직후, 대상이 살아있고 손패가 있으면 무작위 1장 가져옴.
- 한나: 자기 앞 카드(장비·화약통·영창 포함) 3장 이상이면 남이 나를 볼 때 +1.
- 실라: 모든 판정에서 2장 뒤집고 `judgeChoice`로 선택. 둘 다 버린 카드로.
- 비비: 자기 턴 시작 시 화약통이 있으면 판정 대신 `passKeg` 대기 → 다른 생존자 아무에게나 넘김.
- 브루노: 브루노가 끼어 있는 결투에서 브루노의 상대는 매번 `required: 2`.

- [ ] **Step 1: 실패하는 테스트 작성** (캐릭터마다 1~2개)
  - 톰 hp 2/4에서 럼주 → 4. hp 3/4 → 4(초과 안 함).
  - 마고 턴: `peekTarget` 대기 → 대상 선택 → `peek` 이벤트 `visibleTo === [마고]`, 이후 `turn`.
  - 루: 버린 카드 맨 위 X → `chooseDrawSource fromDiscard:true` 후 손패에 X 포함.
  - 데릭: 칼질 2장 `useAbility` → 다른 전원에게 `respondAttack source:'cannonade'`, 같은 턴 두 번째 사용 거부, 이후 일반 칼질 1회 여전히 가능.
  - 오르소: hp 5, 손패 7장으로 `endTurn` → `discardExcess` 없음.
  - 니코: 칼질 명중 → 대상 손패 −1, 니코 손패 +1(칼질 사용분 제외).
  - 한나: 장비 3개면 `distance(x, 한나)`가 1 증가.
  - 실라: 판정 시 `judgeChoice.options.length === 2`, 고른 카드로 성공 여부 결정.
  - 비비: 화약통 보유 상태로 턴 시작 → `passKeg` → 고른 사람 장비로 이동, 판정 이벤트 없음.
  - 브루노가 결투 대상일 때 사용자 쪽 `respondDuel.required === 2`, 브루노 쪽은 1.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat(engine): ten character abilities"`

---

### Task 9: 기본 행동(시간 초과용)과 행동 힌트

**Files:**
- Create: `src/engine/defaults.ts`, `src/engine/legal.ts`
- Modify: `src/engine/types.ts`
- Test: `tests/engine/defaults.test.ts`, `tests/engine/legal.test.ts`

**Interfaces:**
- Produces (`defaults.ts`): `function defaultActionFor(game: Game, p: PendingView): Action`
  - `turn` → `endTurn`; `respondAttack`/`respondBrawl`/`respondDuel`/`dying` → `respond []`; `discardExcess` → 손패에서 무작위 `count`장 `discard`; `loot`/`judgeChoice` → 첫 번째 카드 `chooseCard`; `peekTarget`/`passKeg` → 다음 생존자 `chooseSeat`; `drawSource` → `fromDiscard:false`.
- Produces (`types.ts` + `legal.ts`):
  ```ts
  export interface PlayHint { cardId: CardId; targets: SeatId[] | null; targetCards: boolean } // targets null = 대상 불필요
  export function playHints(game: Game, seat: SeatId): PlayHint[]; // turn 대기 중인 본인일 때만, 아니면 []
  ```
  `targets`는 `validate`가 통과하는 대상 자리. `targetCards`는 소매치기·밧줄 자르기처럼 대상의 장비를 고를 수 있는지.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 모든 `PendingView.kind`에 대해 `defaultActionFor`의 결과를 `apply`하면 `{ok: true}` (상황별로 하나씩 만들어 검증).
  - 무작위 시드 50개, 4~7명: 매 대기마다 `defaultActionFor`만 넣어 진행했을 때 1500 행동 안에 예외 없음(끝나지 않아도 됨 — 전원 턴 종료만 하므로).
  - `playHints`: 칼질 대상은 사거리 안 생존자만, 이미 칼질했으면 칼질 힌트 없음, 럼주는 hp 가득이면 없음, 남의 턴이면 `[]`.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat(engine): default actions and play hints"`

---

### Task 10: 연결 인터페이스, 화면 상태 가리기, 방장 세션

**Files:**
- Create: `src/net/Transport.ts`, `src/net/LocalTransport.ts`, `src/host/messages.ts`, `src/host/view.ts`, `src/host/HostSession.ts`
- Modify: `src/engine/types.ts` (`PlayerView`)
- Test: `tests/net/local.test.ts`, `tests/host/view.test.ts`, `tests/host/session.test.ts`

**Interfaces:**
- Produces (`Transport.ts`):
  ```ts
  export interface Transport<In, Out> {
    send(msg: Out): void;
    onMessage(handler: (msg: In) => void): () => void; // 해제 함수 반환
    onClose(handler: () => void): () => void;
    close(): void;
  }
  ```
- Produces (`LocalTransport.ts`): `function createLocalPair<A, B>(): [Transport<B, A>, Transport<A, B>]` — 왼쪽이 A를 보내고 B를 받는다. 전달은 `queueMicrotask`로 비동기, 보낼 때 `JSON.parse(JSON.stringify(msg))`로 복사(직렬화 강제). `close()` 시 양쪽 `onClose` 호출.
- Produces (`messages.ts`):
  ```ts
  export type ClientMessage = { type: 'hello'; seatToken: string } | { type: 'action'; action: Action };
  export type ServerMessage = { type: 'view'; view: PlayerView } | { type: 'rejected'; reason: string };
  ```
- Produces (`types.ts`):
  ```ts
  export interface SeatView { seat: SeatId; name: string; character: CharacterId; hp: number; maxHp: number; alive: boolean;
    handCount: number; equipment: CardView[]; role: Role | null; isAi: boolean }
  export interface PlayerView {
    you: SeatId; myRole: Role; myHand: CardView[]; seats: SeatView[]; current: SeatId;
    pending: PendingView | null;    // 누가 무엇을 기다리는지는 공개. 단 loot.revealed는 공개, judgeChoice.options는 공개
    hints: PlayHint[]; deckCount: number; discardTop: CardView | null;
    distances: Record<SeatId, number>; myRange: number; // 화면 표시용
    events: GameEvent[];            // 내게 보이는 것만, 최근 100개
    winner: 'captainTeam' | 'rebels' | 'spy' | null; // 끝나면 seats[].role 전부 공개
  }
  ```
- Produces (`view.ts`): `function buildView(game: Game, seat: SeatId, isAi: (s: SeatId) => boolean): PlayerView`
- Produces (`HostSession.ts`):
  ```ts
  export type ServerSide = Transport<ClientMessage, ServerMessage>;
  export interface Controller { kind: 'human' | 'ai'; transport: ServerSide }
  export interface HostOptions { timeouts: { responseMs: number; turnMs: number } | null } // 1단계 null
  export class HostSession {
    constructor(game: Game, opts: HostOptions);
    seatToken(seat: SeatId): string;                 // 자리별 무작위 토큰(rng 아닌 crypto.randomUUID)
    attach(seat: SeatId, c: Controller): void;        // 붙이자마자 view 전송
    detach(seat: SeatId): void;
    onSeatVacated(handler: (seat: SeatId) => void): () => void; // 사람 연결이 끊기면 호출 → 조립 코드가 AI를 붙임
    controllerKind(seat: SeatId): 'human' | 'ai' | null;
  }
  ```
  - `action` 수신 → `game.apply(seat, action)`; 거부면 그 연결에만 `rejected`; 성공이면 모든 자리에 새 view.
  - 사람 연결 `onClose` → `detach` 후 `onSeatVacated` 알림. `hello`로 같은 `seatToken`이 오면 그 자리를 사람에게 돌려주고 view 재전송(3단계 재접속용; 1단계는 테스트로만 확인).
  - 타이머: `timeouts`가 있으면 pending이 바뀔 때마다 하나만 걸고(`turn`은 `turnMs`, 나머지는 `responseMs`), 만료 시 `defaultActionFor`를 해당 자리의 행동으로 `apply`. `null`이면 타이머 없음.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `local.test.ts`: 보낸 메시지가 비동기로 도착(같은 tick에선 미도착, `await Promise.resolve()` 후 도착), 받은 객체는 보낸 객체와 다른 참조, `close` 시 상대 `onClose` 호출.
  - `view.test.ts`:
    - 자리 1의 view에서 `seats[2].role === null`, 선장 자리는 role 공개, 쓰러진 자리는 role 공개.
    - view 전체를 `JSON.stringify`한 문자열에 다른 자리 손패의 card id가 하나도 없음(공개 장비·버린 카드·공개 이벤트에 등장하지 않은 손패 기준).
    - 마고의 `peek` 이벤트가 마고 view에만 있음. `drawCards` 이벤트는 본인 view에만.
    - 게임 종료 후 모든 role 공개.
  - `session.test.ts`:
    - 사람 연결로 정상 `action` → 모든 연결이 새 view 수신.
    - 남의 차례 행동 → 그 연결만 `rejected`, 다른 연결은 수신 없음 (Review Focus 4).
    - 사람 연결 `close` → `onSeatVacated(seat)` 호출, `controllerKind(seat) === null`.
    - AI로 붙였다가 `hello`(맞는 토큰)를 보낸 사람 연결이 자리를 되찾음, 틀린 토큰은 `rejected`.
    - `vi.useFakeTimers()`, `timeouts: {responseMs: 30000, turnMs: 90000}`: 턴 대기 89초엔 그대로, 90초에 다음 자리로 넘어감. `timeouts: null`이면 10분이 지나도 그대로.
    - **Review Focus 5**: 사람 자리가 쓰러진 뒤에도 그 연결이 view를 계속 받고 `winner`가 정해진 view까지 받음.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `git commit -m "feat: transport interface, local transport, view redaction, host session"`

---

### Task 11: AI 플레이어

**Files:**
- Create: `src/ai/memory.ts`, `src/ai/decide.ts`, `src/ai/AiPlayer.ts`
- Test: `tests/ai/decide.test.ts`, `tests/ai/simulation.test.ts`

**Interfaces:**
- Produces (`memory.ts`): `class AiMemory { hostility: Record<SeatId, number>; update(view: PlayerView): void }` — 새로 들어온 공개 이벤트만 반영. 선장을 공격·피해 준 자리는 선장 편 관점에서 적대도 상승, 선장 편을 도운(공격당한 선장 적을 공격한) 자리는 하락 등. 가중치는 구현자 선택.
- Produces (`decide.ts`): `function decide(view: PlayerView, mem: AiMemory, rng: Rng): Action | null` — `view.pending?.seat !== view.you`면 `null`. 반드시 `view` 정보만 사용.
  - 역할별 목표: 선장·충성 → 적대도 높은 자리, 반란 → 선장 우선, 첩자 → 선장 외 가장 위협적인 자리를 먼저, 선장은 마지막(생존자가 첩자와 선장뿐일 때 선장).
  - 턴: 장비(더 긴 무기, 망원경, 보트, 나무통) → hp가 maxHp보다 작으면 럼주 → 뽑기 카드 → 공격 카드 → 영창/화약통 → 버릴 게 있으면 `endTurn`. `hints`에 있는 행동만 고른다.
  - 응답: 피하기·칼질이 있으면 냄, `dying`은 럼주가 `need`장 있으면 냄. 결투는 칼질이 `required`장 이상이면 냄.
  - `loot`/`judgeChoice`/`peekTarget`/`passKeg`/`drawSource`/`discardExcess`는 단순 휴리스틱(구현자 선택). 아무 판단이 안 서면 `defaultActionFor`와 같은 선택(엔진 import 금지이므로 `decide.ts` 안에 같은 규칙을 둔다).
- Produces (`AiPlayer.ts`): `class AiPlayer { constructor(transport: Transport<ServerMessage, ClientMessage>, opts: { delayMs: number; seed: number }); dispose(): void }` — view를 받을 때마다 `decide` → `delayMs` 뒤 전송. 대기 중에 새 view가 오면 이전 예약 취소. `rejected`를 받으면 `endTurn`이나 `respond []` 같은 기본 행동으로 한 번 재시도.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `decide.test.ts`(view 객체 직접 구성):
    - 반란 선원, 선장이 사거리 안 → 칼질 대상 = 선장.
    - `respondAttack` + 손에 피하기 → `respond [피하기 id]`; 피하기 없음 → `respond []`.
    - `dying need 1` + 럼주 → 럼주 냄.
    - 내 차례가 아니면 `null`.
    - 결과 행동의 cardId는 항상 `myHand`에 있고, 대상은 `hints`의 `targets`에 있음(무작위 view 20개).
  - `simulation.test.ts` (호스트 없이 엔진 + `buildView` + `decide` 직결, 지연 없음):
    - 시드 1~300, 인원 `4 + seed % 4`: 각 판 3000 행동 안에 `winner !== null`, 예외 없음, `decide`의 행동이 거부되는 비율 1% 미만.
    - 승리 분포 출력(`console.log`)만 하고 검증은 하지 않음(밸런스 참고용).
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인. 시뮬레이션에서 게임이 안 끝나는 시드가 있으면 그 시드로 재현 테스트를 추가하고 엔진 쪽 원인을 고친다.
- [ ] **Step 5:** `git commit -m "feat(ai): rule-based AI player and full-game simulation"`

---

### Task 12: 화면

**Files:**
- Create: `src/ui/useLocalGame.ts`, `src/ui/SetupScreen.tsx`, `src/ui/GameScreen.tsx`, `src/ui/SeatPanel.tsx`, `src/ui/HandView.tsx`, `src/ui/PromptDialog.tsx`, `src/ui/ResultScreen.tsx`, `src/ui/format.ts`, `src/ui/styles.css`
- Modify: `src/ui/App.tsx`
- Test: `tests/ui/format.test.ts`, `tests/ui/app.test.tsx`

**Interfaces:**
- Consumes: `PlayerView`, `ClientMessage`, `ServerMessage`, `createLocalPair`, `HostSession`, `AiPlayer`, `CARD_CATALOG`, `CHARACTER_INFO`.
- Produces (`useLocalGame.ts`):
  ```ts
  export interface LocalSetup { playerCount: number; myName: string; seed?: number; aiDelayMs?: number } // aiDelayMs 기본 700
  export function useLocalGame(setup: LocalSetup | null): { view: PlayerView | null; lastRejection: string | null; send: (a: Action) => void; restart(): void }
  ```
  사람 자리는 무작위 1자리(역할도 무작위가 됨), 나머지는 `AiPlayer`. AI 이름은 해적 별명 목록에서 무작위(구현자 작성). `onSeatVacated`는 1단계에선 발생하지 않음.
- Produces (`format.ts`): `function formatEvent(e: GameEvent, names: (s: SeatId) => string): string`, `function roleName(r: Role): string`(선장/충성 선원/반란 선원/첩자), `function winnerText(w): string`.

화면 동작(스펙 5.5 스케치 기준):
- `App`: `setup === null`이면 `SetupScreen`(인원 4~7 선택, 이름 입력, 시작) → `GameScreen` → `view.winner`가 있으면 `ResultScreen`(승리 팀, 모든 자리 역할·캐릭터, "다시 하기").
- `GameScreen`: 위·옆에 다른 자리 `SeatPanel`(이름, 캐릭터, ♥ 체력, 손패 장수, 장비, 공개된 역할, 내 기준 거리, 현재 턴·대기 중 표시, AI 여부), 가운데 덱 장수·버린 카드 맨 위·최근 이벤트 로그 10줄, 아래 내 역할·캐릭터 능력 문구·체력·장비·`HandView`·"턴 종료"·데릭이면 "능력 사용".
- `HandView`: `hints`에 있는 카드만 누를 수 있음. 대상이 필요하면 누른 뒤 후보 `SeatPanel`이 강조되고 클릭으로 선택, 소매치기·밧줄 자르기는 대상 클릭 후 "손패 무작위 / 장비 n" 선택. Esc나 같은 카드 다시 누르면 취소.
- `PromptDialog`: `pending.seat === view.you`이고 `kind !== 'turn'`일 때 가운데 창. 종류별로 "피하기 내기 / 맞기", "칼질 내기 / 포기", "럼주 n장 내기 / 쓰러지기", 버릴 카드 n장 고르기, 전리품·판정 카드 고르기, 자리 고르기, 뽑을 곳 고르기.
- 내가 쓰러졌으면 아래쪽에 "관전 중" 표시, 손패·버튼 숨김 (Review Focus 5).
- `lastRejection`은 화면 아래 토스트로 2초 표시.
- 카드는 이모지 + 이름 + 문양·숫자를 담은 색 박스(즉시 사용 = 갈색 계열, 장비 = 파란 계열). 마우스를 올리면 `CARD_CATALOG.text`.
- 화면 폭 360px 이상에서 가로 스크롤 없음.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `format.test.ts`: `damage` 이벤트 → 이름과 숫자가 든 한국어 문장, 모든 `GameEvent.type`에 대해 빈 문자열이 아님, `roleName('spy') === '첩자'`.
  - `app.test.tsx` (`aiDelayMs: 0`, 고정 시드):
    - 시작 화면에서 인원 5 선택 후 시작 → 자리 패널 4개와 내 손패가 보임.
    - 내 턴이 될 때까지 기다린 뒤 "턴 종료" 클릭(손패 초과면 버리기 창에서 처리) → 다음 자리 표시로 바뀜.
    - **Review Focus 5**: 사람의 행동을 매번 기본 행동(턴 종료/맞기)으로 자동 처리하는 테스트 도우미로 진행 → 결국 "관전 중" 또는 결과 화면이 나타나고, 결과 화면에 승리 팀 문구와 5명 역할이 모두 보임(`waitFor` 타임아웃 10초).
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. **Step 4:** PASS 확인.
- [ ] **Step 5:** `npm run dev`로 직접 한 판 플레이해서 확인: 카드 대상 선택, 공격받았을 때 창, 쓰러짐, 결과 화면. 문제 있으면 고치고 테스트 추가.
- [ ] **Step 6:** `git commit -m "feat(ui): setup, game, prompt and result screens"`

---

### Task 13: 마무리

**Files:**
- Create: `README.md`

- [ ] **Step 1:** `README.md`(한국어): 게임 소개 2~3줄, `npm install` / `npm run dev` / `npm test` / `npm run build`, 폴더 구조 요약, 다음 단계(바다 이벤트, 온라인 — `Transport` 구현체 추가 위치).
- [ ] **Step 2:** `npm run typecheck && npm test && npm run build` → 모두 성공, 테스트 실패 0.
- [ ] **Step 3:** 원작 이름 혼입 검사: 원작 게임의 영어 용어 목록으로 `src`를 grep해 화면 문자열에 0건인지 확인. (일반 영어 단어인 내부 kind 이름은 화면에 한국어로만 표시되면 됨.)
- [ ] **Step 4:** `git commit -m "docs: README"`
