# 바다 이벤트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline).

**Goal:** 두 번째 라운드부터 선장 턴마다 바다 이벤트를 펼쳐 규칙을 바꾼다.
**Architecture:** 엔진 `seaEvents.ts` 목록 + `RuleModifier` 확장 + Game의 공개 단계, view에 현재 이벤트, UI는 가운데 칸·띠·토글·가이드 탭.
**Tech Stack:** TypeScript, React 18, Vitest.
**Spec:** docs/superpowers/specs/2026-11-23-sea-events-design.md

## Global Constraints
- 엔진 기본값은 이벤트 꺼짐. UI 기본값은 켜짐.
- 이벤트 덱은 별도 RNG로 섞는다(기존 시드 결과 불변).
- 모든 문구는 한국어, 원작 이름·카드 사용 금지.

## Review Focus
- 선장이 영창에 갇히지 않으므로 선장 턴은 항상 시작된다. 선장 턴이 영창 판정 등으로 건너뛰어져도 이벤트는 턴 시작 시 공개.
- 바다 괴물로 여러 명이 쓰러지거나 게임이 끝날 때 남은 판정이 멈추는지.
- 소용돌이에서 손패가 0장인 사람은 주지 않고 받기만.
- 이벤트가 바뀌면 이전 modifier가 사라지는지.
- 보급 부족 중 쓰러질 때 럼주 응답은 그대로 가능.

### Task 1: 엔진 이벤트 목록·규칙
Files: create `src/engine/seaEvents.ts`; modify `rules.ts`, `cards/actions.ts`, `Game.ts`, `types.ts`, `judge.ts`, `host/view.ts`, `ui/format.ts`(타입 맞춤); test `tests/engine/seaEvents.test.ts`.
- `GameConfig.seaEvents?`, `seaEventOrder?`; `Game.seaEvent: SeaEventId | null`.
- 테스트: 첫 라운드 없음/두 번째 선장 턴에 공개, 꺼져 있으면 없음, 각 modifier(거리·뽑기·안개·축제·만조·무풍·보급 부족), 펼침 효과(괴물·만선·소용돌이·보물섬), 이벤트 교체 시 이전 효과 해제, 덱 소진 후 재섞기, view 노출.
- Commit `feat(engine): sea events`.

### Task 2: UI
Files: `CenterPile.tsx`, `TableScreen.tsx`, `anim/effects.ts`, `format.ts`, `SetupScreen.tsx`, `useLocalGame.ts`, `App.tsx`, `HowToPlay.tsx`, `theme.css`; tests in `tests/ui/*`.
- 테스트: effectsFor가 `sea` 연출을 만든다, 로그 문구, 셋업 토글이 onStart 세 번째 인자로 전달(기본 true), 가이드 탭에 12장, CenterPile 이벤트 칸 표시.
- Commit `feat(ui): sea event card, banner, toggle and guide tab`.

### Task 3: README·마무리
- README에 바다 이벤트 한 줄, 전체 테스트·tsc·build, 최종 리뷰, main 병합·푸시.
