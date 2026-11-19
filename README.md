# 반란의 돛

정체를 숨긴 해적들의 카드 게임이에요. 선장, 충성 선원, 반란 선원, 첩자 중 하나의 역할을 받고,
사거리·공격과 회피·장비 카드로 서로 겨뤄요. 지금은 AI 상대 1인 플레이를 지원해요.

## 실행

```
npm install
npm run dev     # 개발 서버
npm test        # 테스트
npm run build   # 타입 검사 + 빌드
```

## 폴더 구조

- `src/engine` — 게임 규칙 (카드, 캐릭터, 턴 진행, 승패 판정). 연결 방식과 무관해요.
- `src/host` — 방장 세션과 플레이어별 정보 가리기(`buildView`).
- `src/net` — `Transport` 인터페이스와 같은 페이지 안에서 쓰는 `LocalTransport`.
- `src/ai` — 규칙 기반 AI.
- `src/ui` — React 화면.

## 다음 단계

- 바다 이벤트 (라운드마다 규칙이 조금 바뀌는 카드)
- 온라인 멀티플레이: `src/net`에 WebRTC용 `Transport` 구현체를 추가하고, 대기실 화면과 방 코드를 붙여요.
