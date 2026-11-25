# 폰 전체 화면 + 홈 화면 앱 — 설계

**왜:** 폰 웹에서 주소창·상태 표시줄이 화면을 차지해 불편(사용자 요청, 둘 다).

- 전체 화면(Fullscreen API): 브라우저가 사용자가 누른 순간에만 허락하므로 폰(pointer: coarse)에서 "출항"을 누를 때 켠다. 시작 화면에 "출항하면 전체 화면" 체크(기본 켬, localStorage `mutiny.autoFullscreen`). 게임 중 ⛶ 버튼으로 켜고 끈다. 지원 안 하는 브라우저(아이폰 사파리)나 앱으로 연 경우엔 숨김.
- 홈 화면에 추가(PWA): `public/manifest.webmanifest` display fullscreen, 아이콘 192/512/180(icon.svg를 헤드리스 크롬으로 구움). 서비스 워커는 넣지 않음 — 배포가 잦아 오래된 화면이 캐시에 남는 문제를 피하려고.
