# 폰트 교체 + 캐릭터 초상화 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면 폰트를 프리텐다드로 통일하고, 캐릭터 10명의 초상화(SVG 파일, 나중에 갈아끼우기 쉬운 구조)를 뽑기 카드·상대 패널·내 정보·결과 화면에 보여준다.

**Architecture:** 폰트는 npm `pretendard`를 번들에 포함. 초상화는 캐릭터마다 `src/ui/art/portraits/{id}.svg` 파일 하나, 등록표 `portraits.ts`가 URL을 내보내고 `Portrait` 컴포넌트가 `card`(세로 상반신)·`face`(원형 얼굴 크롭)로 그린다. 등록표에 없으면 기존 이모지.

**Tech Stack:** 기존 + `pretendard` npm 패키지.

**Spec:** `docs/superpowers/specs/2026-11-20-font-and-character-portraits-design.md`

## Global Constraints
- 외부 폰트 서버·CDN 금지. 폰트는 `pretendard` npm 패키지로 번들.
- 그림 교체 = 파일 교체 또는 `portraits.ts`의 import 한 줄. 화면 컴포넌트는 `Portrait`만 쓴다.
- SVG: viewBox `0 0 166 200`, 얼굴이 대략 y 10~135, 외곽선 `#1b120a`, 그림체 A(코믹 셀 채색: 굵은 외곽선, 과장된 이목구비, 차분한 색 면 + 그림자 한 단계, 단색 배경). 참고 샘플: `.superpowers/brainstorm/127936-1795130866/content/art-v2.html`의 A.
- 원작 카드 게임의 캐릭터 그림을 닮게 그리지 않는다. 화면 문자열 한국어.
- 폭 360px 가로 스크롤 없음 유지.

## Review Focus
1. **등록표에 없는 캐릭터** → 이모지로 대체, 깨진 이미지 아이콘 없음. 테스트: Task 2.
2. **아직 캐릭터를 안 고른 자리(character null)** → 지금처럼 ❔. 테스트: Task 2.
3. **작은 원형 얼굴에서 얼굴이 잘려 안 보임** → `face`는 위쪽(얼굴) 기준 정렬. 확인: Task 3 스크린샷.
4. **그림 로드 실패(파일 교체 실수)** → `onError` 시 이모지로 대체. 테스트: Task 2.
5. **폰트 교체 후 카드 이름이 카드 폭을 넘침** → 줄바꿈/말줄임으로 카드 안에 머묾. 확인: Task 3 스크린샷.

---

### Task 1: 프리텐다드 폰트
**Files:** Modify `package.json`, `src/main.tsx`, `src/ui/theme.css`
- [ ] **Step 1:** `npm install pretendard@1` ; `src/main.tsx`에 `import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';`(패키지 안 실제 경로 확인 후 그 CSS).
- [ ] **Step 2:** `theme.css`의 `--serif`를 지우고 `--font: 'Pretendard Variable', Pretendard, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif;`로 바꾸고 `var(--serif)`를 모두 `var(--font)`로. 제목(`.ttl`/`h1`/`h2`/`h3`), 카드 이름, 캐릭터 이름은 `font-weight: 700~800`.
- [ ] **Step 3:** `npm run build` → `dist/assets`에 woff2 포함, 외부 URL 없음(`grep -r "googleapis\|jsdelivr\|unpkg" dist` 0건). `npm test` 전부 통과.
- [ ] **Step 4:** `git commit -m "feat(ui): switch to bundled Pretendard font"`

### Task 2: 초상화 구조와 10명 그림
**Files:** Create `src/ui/art/portraits/{tom,margo,lou,derrick,orso,nico,hanna,sila,bibi,bruno}.svg`, `src/ui/art/portraits.ts`, `src/ui/table/Portrait.tsx`; Modify `src/ui/table/CharacterCard.tsx`, `OpponentPanel.tsx`, `MyArea.tsx`, `src/ui/screens/ResultScreen.tsx`, `src/ui/theme.css`; Create `src/vite-env.d.ts`(없으면, `/// <reference types="vite/client" />` — `*.svg` import 타입용)
**Interfaces:**
- `portraits.ts`: `export const PORTRAITS: Partial<Record<CharacterId, string>>` (각 `import tom from './portraits/tom.svg'`).
- `Portrait.tsx`: `export function Portrait(p: { id: CharacterId | null; variant: 'card' | 'face'; portraits?: Partial<Record<CharacterId, string>> }): JSX.Element` — `portraits` 기본값 `PORTRAITS`(테스트에서 주입). 그림 있으면 `<img className="portrait {variant}" src alt="{캐릭터 이름}">`, `onError` 시 이모지로 전환. 그림 없으면 `<span className="portrait-emoji {variant}">{CHARACTER_FACE[id]}</span>`. `id === null`이면 `❔`.
- CSS: `.portrait.card` 세로 166:200 비율, `.portrait.face` 원형 + `object-fit: cover; object-position: 50% 12%`.
- 그림 특징(스펙): 톰 요리사 모자·팔자 콧수염·국자 / 마고 어깨 앵무새·두건 / 루 덥수룩 수염·밀수 자루 / 데릭 포수 모자·그을음·도화선 / 오르소 큰 덩치·닻 문신·대머리 / 니코 날카로운 눈·챙 모자·동전 / 한나 땋은 머리·닻 목걸이 / 실라 삼각모·망원경·흉터 / 비비 고글·화약통 / 브루노 각진 턱·붕대·팔짱. 배경색은 캐릭터마다 다르게(차분한 색).
- [ ] **Step 1: 실패하는 테스트** `tests/ui/portrait.test.tsx`:
  - 등록된 id → `img`, `alt === CHARACTER_INFO[id].name`, 클래스에 `card`/`face`.
  - `portraits={{}}` 주입 → `img` 없고 이모지 텍스트.
  - `id={null}` → "❔".
  - `img`에 `error` 이벤트 → 이모지로 바뀜.
  - `PORTRAITS`에 10명 모두 있음(`CHARACTER_IDS.every(id => PORTRAITS[id])`).
  - `CharacterCard('tom')`이 "요리사 톰" 이름의 `img`를 포함(기존 cards 테스트에 추가).
- [ ] **Step 2:** FAIL 확인 `npx vitest run tests/ui/portrait.test.tsx`.
- [ ] **Step 3:** 구현 — 구조 먼저, 그다음 SVG 10개. 기존 `.face` 이모지 자리를 `Portrait`로 교체(CharacterCard: card, OpponentPanel·MyArea·ResultScreen: face).
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run build` 통과.
- [ ] **Step 5:** `git commit -m "feat(ui): swappable character portraits"`

### Task 3: 화면 확인
- [ ] **Step 1:** 개발 서버를 띄워 브라우저(Orca 내장 브라우저 `orca` CLI 또는 사용 가능한 자동화 도구)로 시작 → 뽑기 → 테이블 → 결과를 1280px·360px에서 스크린샷으로 확인: 10명 초상화가 깨지지 않음, 원형 얼굴에 얼굴이 보임, 폰트 적용, 카드 이름 넘침 없음, 가로 스크롤 없음. 10명 전체를 한 번에 보려면 `CharacterCard`를 모두 늘어놓은 임시 화면 대신 결과 화면이나 여러 판 시드로 확인(임시 코드는 커밋하지 않음).
- [ ] **Step 2:** 문제는 테스트 먼저(가능한 경우) 고치고, 시각 문제는 전후 스크린샷을 증거로.
- [ ] **Step 3:** README에 "캐릭터 그림 바꾸는 법"(파일 위치·형식·등록표) 3줄 추가. `npm test && npm run build`. `git commit -m "docs: how to swap character portraits"`
