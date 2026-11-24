import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

/** 이만큼 누르고 있으면 설명을 띄운다 */
export const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/** 우클릭(웹)이나 길게 누르기(터치)로 onLong을 부르는 이벤트 묶음. 길게 누른 뒤 따라오는 클릭은 삼킨다 */
export function useLongPress(onLong: () => void) {
  const s = useRef({ timer: undefined as ReturnType<typeof setTimeout> | undefined, x: 0, y: 0, fired: false });
  const clear = () => clearTimeout(s.current.timer);
  useEffect(() => clear, []);
  return {
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      onLong();
    },
    onPointerDown: (e: PointerEvent) => {
      s.current.fired = false;
      clear();
      if (e.pointerType === 'mouse') return;
      s.current.x = e.clientX;
      s.current.y = e.clientY;
      s.current.timer = setTimeout(() => {
        s.current.fired = true;
        onLong();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (Math.hypot(e.clientX - s.current.x, e.clientY - s.current.y) > MOVE_TOLERANCE_PX) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClickCapture: (e: MouseEvent) => {
      if (!s.current.fired) return;
      s.current.fired = false;
      e.stopPropagation();
      e.preventDefault();
    },
  };
}
