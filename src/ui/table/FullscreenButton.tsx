import { enterFullscreen, exitFullscreen, fullscreenAvailable, useFullscreen } from '../fullscreen';

/** 게임 중 전체 화면 켜고 끄기(주소창·상태 표시줄 숨김). 지원하지 않거나 앱으로 열었으면 안 보인다 */
export function FullscreenButton() {
  const on = useFullscreen();
  if (!fullscreenAvailable()) return null;
  return (
    <button
      type="button"
      className={`speed-toggle fullscreen-toggle${on ? ' on' : ''}`}
      aria-label={on ? '전체 화면 끄기' : '전체 화면'}
      aria-pressed={on}
      onClick={on ? exitFullscreen : enterFullscreen}
    >
      ⛶
    </button>
  );
}
