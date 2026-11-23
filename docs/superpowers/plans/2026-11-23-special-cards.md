# 확장 카드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline).

**Goal:** 확장 카드 10종을 엔진·AI·UI에 추가하고 켜기/끄기를 둔다.
**Spec:** docs/superpowers/specs/2026-11-23-special-cards-design.md

## Global Constraints
- 엔진 기본 꺼짐, 확장이 꺼지면 덱 스펙은 지금과 바이트 단위로 같다.
- 한국어 문구, 원작 이름·카드 금지.

## Review Focus
- 보물 지도 내용이 다른 사람의 view(pending)로 새지 않는지.
- 고자질로 본 역할이 다른 사람 view에 새지 않는지.
- 가죽 코트·동전·작살이 쓰러짐/게임 종료와 겹칠 때 스택이 꼬이지 않는지.
- 덱이 비었을 때 보물 지도·주사위 내기.
- AI가 새 카드로 거부되는 행동을 반복하지 않는지(확장+이벤트 켠 시뮬레이션).

### Task 1: 엔진 (catalog, deck, cards, Game hooks, view, defaults) — tests/engine/specialCards.test.ts
### Task 2: AI (decide, KEEP_VALUE, 알아낸 역할 반영, 시뮬레이션 확장 켬)
### Task 3: UI (토글, PromptNote 보물 지도·불붙은 배, 로그, 연출, 가이드 "확장" 표시) + README
