import type { Anchor } from './effects';

/** 영역 요소에 data-anchor="{Anchor}"를 붙이면 연출 레이어가 그 위치를 찾는다 */
export function anchorRect(a: Anchor): DOMRect | null {
  const el = document.querySelector(`[data-anchor="${a}"]`);
  return el ? el.getBoundingClientRect() : null;
}
