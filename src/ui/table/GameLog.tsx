import { useLayoutEffect, useRef } from 'react';
import type { GameEvent, SeatId } from '../../engine/types';
import { formatEvent } from '../format';

/** 맨 아래에서 이만큼(px) 안쪽이면 "맨 아래를 보는 중"으로 친다 */
const BOTTOM_SLACK = 24;

/**
 * 항해 일지. view에 담긴 이벤트(최근 100개)를 모두 보여주고 스크롤할 수 있다.
 * 맨 아래를 보고 있을 때만 새 기록이 오면 따라 내려가고, 위로 올려 읽는 중에는 위치를 지킨다.
 */
export function GameLog(p: { events: GameEvent[]; name: (s: SeatId) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useLayoutEffect(() => {
    const el = box.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [p.events]);

  const onScroll = () => {
    const el = box.current;
    if (el) atBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_SLACK;
  };

  return (
    <div className="log panel">
      <h4>항해 일지</h4>
      <div className="log-scroll" ref={box} onScroll={onScroll}>
        <ul>
          {p.events.map((e, i) => (
            <li key={e.seq ?? i}>{formatEvent(e, p.name)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
