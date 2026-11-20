# 타이틀 그림 + 게임 방법 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시작 화면에 움직이는 타이틀 그림과 로고를 넣고, "게임 방법" 창(기본 규칙/역할/캐릭터/카드 탭)을 추가한다.
**Architecture:** 타이틀은 `src/ui/art/title.svg`를 `<img>`로. 게임 방법은 `src/ui/screens/HowToPlay.tsx` 모달, 내용은 `CARD_CATALOG`·`CHARACTER_INFO`·`ROLE_GOAL`에서.
**Tech Stack:** 기존.
**Spec:** `docs/superpowers/specs/2026-11-20-title-art-and-how-to-play-design.md`

## Global Constraints
- 화면 문자열 한국어, 원작 이름·그림 금지. 외부 이미지·폰트 서버 금지.
- 그림체: 굵은 외곽선 `#1b120a`, 색 면 + 그림자 한 단계. 움직임은 `prefers-reduced-motion: reduce`면 정지.
- 폭 360px 가로 스크롤 없음.

## Review Focus
1. 게임 방법 창이 열린 채 "출항"이 눌리지 않음(창이 화면을 덮음) — 테스트: Task 2.
2. 좁은 화면에서 창이 화면을 넘지 않고 안에서 스크롤 — 확인: Task 3 스크린샷.
3. 카드/캐릭터 추가 시 설명 자동 반영 — 테스트: Task 2 (카탈로그 전 종류가 보임).
4. Esc로 닫힘, 다시 열면 첫 탭 — 테스트: Task 2.
5. 타이틀 그림 로드 실패 시에도 로고 글자는 보임 — 테스트: Task 1(heading 유지).

---
### Task 1: 타이틀 그림
**Files:** Create `src/ui/art/title.svg`; Modify `src/ui/screens/SetupScreen.tsx`, `src/ui/theme.css`; Test `tests/ui/screens.test.tsx`
- [ ] 실패하는 테스트: Setup 화면에 `getByRole('img', { name: '반란의 돛 타이틀 그림' })`, `getByRole('heading', { name: '반란의 돛' })`, 부제 텍스트.
- [ ] FAIL 확인 → `title.svg`(배 흔들림·깃발 펄럭임 CSS 애니메이션 + reduced-motion 정지) 그리고 SetupScreen에 `.title-block`(img + h1 로고 + 부제). 로고: 금색 글자, 어두운 테두리(`-webkit-text-stroke` 또는 text-shadow), 굵게.
- [ ] `npm test`, `npx tsc --noEmit` PASS → 커밋 `feat(ui): title art on the setup screen`
### Task 2: 게임 방법 창
**Files:** Create `src/ui/screens/HowToPlay.tsx`; Modify `SetupScreen.tsx`, `theme.css`; Test `tests/ui/howToPlay.test.tsx`
**Interfaces:** `export function HowToPlay(p: { onClose: () => void }): JSX.Element` — `role="dialog"` `aria-label="게임 방법"`, 탭 버튼 `role="tab"` 4개("기본 규칙","역할","캐릭터","카드"), 첫 탭 선택. `export const ROLE_TABLE_ROWS`가 아니라 표는 컴포넌트 안에 상수로.
- [ ] 실패하는 테스트:
  - Setup의 "게임 방법" 버튼 → dialog "게임 방법" 열림, "기본 규칙" 탭 선택 상태(`aria-selected="true"`), "턴" 관련 문구 포함.
  - "역할" 탭 → 선장/충성 선원/반란 선원/첩자와 각 `ROLE_GOAL` 문구, "7명" 행.
  - "캐릭터" 탭 → `CHARACTER_IDS` 10명 이름 모두, `고르기` 버튼 없음.
  - "카드" 탭 → `CARD_CATALOG` 22종 이름 모두와 "×{count}" 장수(예: 칼질 ×23).
  - 닫기 버튼·Esc → 닫힘. 다시 열면 "기본 규칙" 탭.
  - 창이 열린 동안 창 바깥 "출항"을 클릭해도 `onStart` 호출 안 됨(오버레이가 덮음 — 오버레이 클릭은 창 닫기만).
- [ ] FAIL 확인 → 구현 → PASS → 커밋 `feat(ui): how-to-play guide`
### Task 3: 화면 확인
- [ ] 개발 서버 + Orca 브라우저로 1280px·360px 스크린샷: 타이틀 그림, 로고, 게임 방법 각 탭. 문제는 고치고 전후 스크린샷. `npm test && npm run build`. README "게임 방법" 한 줄. 커밋.
