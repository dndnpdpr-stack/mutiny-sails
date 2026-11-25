import { useEffect, useState } from 'react';

/**
 * 폰 웹에서 주소창·상태 표시줄을 치우는 전체 화면.
 * 브라우저 규칙상 사용자가 누른 순간(클릭 처리 안)에만 켤 수 있다. 아이폰 사파리처럼 지원하지 않으면 아무것도 안 한다.
 */
const AUTO_KEY = 'mutiny.autoFullscreen';

export function canFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;
}

export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

/** 홈 화면 아이콘으로 열어 이미 주소창이 없는 상태 */
export function isInstalledApp(): boolean {
  try {
    return matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/** 손가락으로 쓰는 기기(폰·태블릿) */
export function isTouchDevice(): boolean {
  try {
    return matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function enterFullscreen(): void {
  if (!canFullscreen() || isFullscreen()) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
    // 거절되면 그대로 둔다
  });
}

export function exitFullscreen(): void {
  if (isFullscreen()) document.exitFullscreen().catch(() => {});
}

export function loadAutoFullscreen(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveAutoFullscreen(on: boolean): void {
  try {
    localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {
    // 저장이 막혀 있으면 이번만
  }
}

/** 전체 화면 버튼을 보여 줄지: 지원하고, 이미 앱처럼 열린 게 아닐 때 */
export const fullscreenAvailable = (): boolean => canFullscreen() && !isInstalledApp();

export function useFullscreen(): boolean {
  const [on, setOn] = useState(isFullscreen);
  useEffect(() => {
    const sync = () => setOn(isFullscreen());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  return on;
}
