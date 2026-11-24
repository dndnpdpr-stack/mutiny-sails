import { useEffect, useRef, useState } from 'react';
import type { GameEvent, PlayerView } from '../../engine/types';
import { effectsFor, totalMs, type Effect } from './effects';

export interface AnimatedView {
  shown: PlayerView | null;
  effects: Effect[];
  speed: 1 | 2;
  batchKey: number;
}

const FAST_MS = 1500;
const SKIP_MS = 3000;
const CATCH_UP_QUIET_MS = 600;

const maxSeq = (events: GameEvent[]) => events.reduce((m, e) => Math.max(m, e.seq ?? 0), 0);
const fresh = (view: PlayerView, lastSeq: number) => view.events.filter((e) => (e.seq ?? 0) > lastSeq);

/**
 * 호스트가 보낸 view를 큐에 쌓고, 새 이벤트의 연출이 끝난 뒤에 화면에 반영한다.
 * 밀리면 2배속, 많이 밀리면 큐를 버리고 최신 view로 바로 건너뛴다.
 */
export function useAnimatedView(latest: PlayerView | null, opts: { enabled: boolean; /** 2배속 모드면 2 */ minSpeed?: 1 | 2 }): AnimatedView {
  const [state, setState] = useState<AnimatedView>(() => ({ shown: latest, effects: [], speed: 1, batchKey: 0 }));

  const enabledRef = useRef(opts.enabled);
  enabledRef.current = opts.enabled;
  const minRef = useRef<1 | 2>(opts.minSpeed ?? 1);
  minRef.current = opts.minSpeed ?? 1;

  const m = useRef({
    handled: latest as PlayerView | null,
    shown: latest as PlayerView | null,
    lastSeq: latest ? maxSeq(latest.events) : 0,
    queue: [] as PlayerView[],
    timer: null as ReturnType<typeof setTimeout> | null,
    curMs: 0, // 지금 연출의 배속 전 전체 길이
    rawLeft: 0, // 남은 배속 전 길이
    tick: 0,
    speed: 1 as 1 | 2,
    batchKey: 0,
    running: null as PlayerView | null,
    catchUp: null as ReturnType<typeof setTimeout> | null,
  });

  useEffect(() => {
    const s = m.current;

    const clearTimer = () => {
      if (s.timer) clearTimeout(s.timer);
      s.timer = null;
      s.running = null;
    };
    const show = (view: PlayerView | null, bumpBatch: boolean) => {
      s.shown = view;
      if (bumpBatch) s.batchKey++;
      setState({ shown: view, effects: [], speed: s.speed, batchKey: s.batchKey });
    };
    const endCatchUp = () => {
      if (s.catchUp) clearTimeout(s.catchUp);
      s.catchUp = null;
    };
    const reset = () => {
      clearTimer();
      endCatchUp();
      s.queue = [];
      s.lastSeq = 0;
      s.curMs = 0;
      s.rawLeft = 0;
      s.speed = 1;
    };
    const schedule = (view: PlayerView) => {
      clearTimer();
      s.running = view;
      s.tick = Date.now();
      s.timer = setTimeout(() => {
        s.timer = null;
        s.running = null;
        show(view, true);
        pump();
      }, s.rawLeft / s.speed);
    };
    const pump = () => {
      while (s.queue.length > 0 && !s.timer) {
        const view = s.queue.shift()!;
        const evs = fresh(view, s.lastSeq);
        s.lastSeq = Math.max(s.lastSeq, maxSeq(view.events));
        const fx = enabledRef.current ? effectsFor(evs, view.you) : [];
        const ms = totalMs(fx);
        if (ms === 0) {
          show(view, false);
          continue;
        }
        s.curMs = ms;
        s.rawLeft = ms;
        s.speed = minRef.current === 2 || ms + backlog() > FAST_MS ? 2 : 1;
        s.batchKey++; // 연출 시작도 새 묶음: EffectLayer가 이 키로 다시 재생한다
        setState({ shown: s.shown, effects: fx, speed: s.speed, batchKey: s.batchKey });
        schedule(view);
      }
    };
    /** 지금 묶음의 남은 길이 + 대기 view들의 예상 길이 (배속 전) */
    const backlog = () => {
      let total = 0;
      if (s.timer) total += s.rawLeft - (Date.now() - s.tick) * s.speed;
      let seq = s.lastSeq;
      for (const v of s.queue) {
        total += totalMs(effectsFor(fresh(v, seq), v.you));
        seq = Math.max(seq, maxSeq(v.events));
      }
      return total;
    };

    if (latest === s.handled) return;
    s.handled = latest;

    if (latest === null) {
      reset();
      show(null, false);
      return;
    }

    const top = maxSeq(latest.events);
    const draftEnded = !!s.shown && s.shown.seats.some((x) => x.character === null) && !latest.seats.some((x) => x.character === null);
    if (s.shown === null || draftEnded || (top > 0 && top < s.lastSeq)) {
      // 첫 view이거나 새 게임, 또는 캐릭터 뽑기 직후의 첫 테이블: 연출 없이 바로 표시
      reset();
      s.lastSeq = top;
      show(latest, false);
      return;
    }

    if (!enabledRef.current) {
      reset();
      s.lastSeq = Math.max(s.lastSeq, top);
      show(latest, false);
      return;
    }

    if (s.catchUp) {
      // 건너뛴 직후: 조용해질 때까지 연출 없이 바로 표시
      clearTimeout(s.catchUp);
      s.catchUp = setTimeout(() => { s.catchUp = null; }, CATCH_UP_QUIET_MS);
      s.lastSeq = Math.max(s.lastSeq, top);
      show(latest, false);
      return;
    }

    s.queue.push(latest);
    const total = backlog();
    if (total > SKIP_MS) {
      reset();
      s.lastSeq = top;
      s.catchUp = setTimeout(() => { s.catchUp = null; }, CATCH_UP_QUIET_MS);
      show(latest, true);
      return;
    }
    const next: 1 | 2 = minRef.current === 2 || total > FAST_MS ? 2 : 1;
    if (next !== s.speed) {
      if (s.timer && s.running) {
        // 진행한 만큼 빼고 새 배속으로 남은 시간을 다시 잡는다
        s.rawLeft = Math.max(0, s.rawLeft - (Date.now() - s.tick) * s.speed);
        s.speed = next;
        schedule(s.running);
      } else {
        s.speed = next;
      }
    }
    setState((p) => (p.speed === s.speed ? p : { ...p, speed: s.speed }));
    pump();
  }, [latest]);

  useEffect(
    () => () => {
      if (m.current.timer) clearTimeout(m.current.timer);
      m.current.timer = null;
      if (m.current.catchUp) clearTimeout(m.current.catchUp);
      m.current.catchUp = null;
    },
    [],
  );

  return state;
}
