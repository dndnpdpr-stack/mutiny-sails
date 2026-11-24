import { motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { CardBack, CardFace } from '../table/Card';
import { anchorRect } from './anchors';
import type { Anchor, Effect } from './effects';

interface Pt { x: number; y: number }
interface Live { id: number; effect: Effect; path: Pt[]; speed: 1 | 2 }

/** 달려든 패널이 대상에 닿는 시점(전체 길이 비율) */
const IMPACT_AT = 0.45;

/**
 * 공격한 사람의 패널이 대상 쪽으로 달려들었다 제자리로 돌아온다(패널 자체를 Web Animations로 움직임).
 * 닿는 순간 대상 패널이 움찔하며 번쩍인다. 움직일 수 없는 환경(테스트 등)이면 아무것도 안 한다.
 */
function lunge(from: string, to: string, [a, b]: Pt[], ms: number): void {
  const el = document.querySelector<HTMLElement>(`[data-anchor="${from}"]`);
  const target = document.querySelector<HTMLElement>(`[data-anchor="${to}"]`);
  // 끝까지 가면 겹쳐 보이니 맞닿을 만큼만
  const dx = (b.x - a.x) * 0.72;
  const dy = (b.y - a.y) * 0.72;
  if (el && typeof el.animate === 'function') {
    el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', zIndex: 45 },
        { transform: `translate(${-dx * 0.06}px, ${-dy * 0.06}px) scale(1.04)`, zIndex: 45, offset: 0.15 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.1)`, zIndex: 45, offset: IMPACT_AT },
        { transform: `translate(${dx * 0.9}px, ${dy * 0.9}px) scale(1.06)`, zIndex: 45, offset: 0.55 },
        { transform: 'translate(0, 0) scale(1)', zIndex: 45 },
      ],
      { duration: ms, easing: 'ease-in-out' },
    );
  }
  if (target && typeof target.animate === 'function') {
    const kx = Math.sign(dx || 1) * 8;
    target.animate(
      [
        { transform: 'none', filter: 'none' },
        { transform: `translateX(${kx}px) scale(0.95)`, filter: 'brightness(1.7) drop-shadow(0 0 14px rgba(224, 69, 58, 0.95))', offset: 0.25 },
        { transform: `translateX(${-kx * 0.6}px)`, filter: 'brightness(1.2)', offset: 0.6 },
        { transform: 'none', filter: 'none' },
      ],
      { duration: ms * 0.45, delay: ms * IMPACT_AT },
    );
  }
}

function center(a: Anchor): Pt | null {
  const r = anchorRect(a);
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

function resolve(e: Effect): Pt[] | null {
  switch (e.kind) {
    case 'fly': {
      const pts = [e.from, ...(e.via ? [e.via] : []), e.to].map(center);
      return pts.every((p) => p) ? (pts as Pt[]) : null;
    }
    case 'float': {
      const p = center(`seat:${e.seat}`);
      return p ? [p] : null;
    }
    case 'judge': {
      const p = center('judge');
      return p ? [p] : null;
    }
    case 'aim': {
      const pts = [center(`seat:${e.from}`), center(`seat:${e.to}`)];
      return pts.every((p) => p) ? (pts as Pt[]) : null;
    }
    default:
      return null;
  }
}

export function EffectLayer(p: { effects: Effect[]; speed: 1 | 2; batchKey: number }) {
  const [live, setLive] = useState<Live[]>([]);
  const effectsRef = useRef(p.effects);
  effectsRef.current = p.effects;

  // 같은 묶음 안에서 배속만 바뀌면 처음부터 다시 재생하지 않고, 지나간 시간(배속 전 기준)만큼 이어서 간다
  const clock = useRef({ key: p.batchKey, speed: p.speed, tick: Date.now(), elapsed: 0, started: new Map<number, { t: number; speed: 1 | 2 }>() });

  useLayoutEffect(() => {
    const c = clock.current;
    const now = Date.now();
    if (c.key === p.batchKey) {
      c.elapsed += (now - c.tick) * c.speed;
    } else {
      c.key = p.batchKey;
      c.elapsed = 0;
      c.started = new Map();
      setLive([]);
    }
    c.tick = now;
    c.speed = p.speed;
    const timers: ReturnType<typeof setTimeout>[] = [];
    effectsRef.current.forEach((effect, id) => {
      const end = effect.at + effect.ms;
      if (end <= c.elapsed) return;
      if (!c.started.has(id)) {
        timers.push(
          setTimeout(() => {
            const path = resolve(effect);
            if (!path) return;
            c.started.set(id, { t: Date.now(), speed: p.speed });
            setLive((l) => [...l, { id, effect, path, speed: p.speed }]);
            if (effect.kind === 'aim') lunge(`seat:${effect.from}`, `seat:${effect.to}`, path, effect.ms / p.speed);
          }, Math.max(0, effect.at - c.elapsed) / p.speed),
        );
      }
      // 이미 날아가는 중인 효과는 framer 애니메이션이 처음 배속 그대로 계속되므로, 제거도 그 기준으로 맞춘다
      const run = c.started.get(id);
      const removeIn = run ? Math.max(0, effect.ms / run.speed - (now - run.t)) : (end - c.elapsed) / p.speed;
      timers.push(setTimeout(() => setLive((l) => l.filter((x) => x.id !== id)), removeIn));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.batchKey, p.speed]);

  return (
    <div className="effect-layer" aria-hidden="true">
      {live.map(({ id, effect: e, path, speed }) => {
        const dur = e.ms / speed / 1000;
        if (e.kind === 'fly') {
          return (
            <motion.div
              key={`${p.batchKey}-${id}`}
              data-effect="fly"
              className="fly-ghost"
              initial={{ left: path[0].x, top: path[0].y, rotateY: e.flip ? 180 : 0 }}
              animate={{
                left: path.map((q) => q.x),
                top: path.map((q) => q.y),
                rotateY: 0,
              }}
              transition={{ duration: dur, ease: 'easeInOut' }}
            >
              {e.card ? <CardFace card={e.card} size="sm" /> : <CardBack size="sm" />}
            </motion.div>
          );
        }
        if (e.kind === 'float') {
          return (
            <motion.div
              key={`${p.batchKey}-${id}`}
              data-effect="float"
              className={`float-num ${e.tone}`}
              style={{ left: path[0].x, top: path[0].y }}
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -50, opacity: 0 }}
              transition={{ duration: dur, ease: 'easeOut' }}
            >
              {e.text}
            </motion.div>
          );
        }
        if (e.kind === 'judge') {
          return (
            <div key={`${p.batchKey}-${id}`} data-effect="judge">
              <motion.div
                className={`judge-ghost ${(e.good ?? e.success) ? 'success' : 'fail'}`}
                style={{ left: path[0].x, top: path[0].y }}
                initial={{ rotateY: 180 }}
                animate={{ rotateY: 0 }}
                transition={{ duration: Math.min(dur, 0.4) }}
              >
                <CardFace card={e.card} size="sm" />
              </motion.div>
              {/* 판정 더미 아래, 화면 가로 가운데에 이유·조건·결과 */}
              {e.title && (
                <div className="judge-caption" style={{ top: path[0].y + 46 }}>
                  <b>{e.title}</b>
                  <span className="judge-need">{e.need}</span>
                  <span className={`judge-result ${e.good === null ? '' : e.good ? 'good' : 'bad'}`}>{e.result}</span>
                </div>
              )}
            </div>
          );
        }
        if (e.kind === 'aim') {
          const b = path[1];
          return (
            <div key={`${p.batchKey}-${id}`} data-effect="aim">
              {/* 패널이 부딪히는 순간 대상 위에 카드 그림과 💥 */}
              <motion.div
                className="aim-hit"
                style={{ left: b.x, top: b.y }}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 0.3, 1.4, 1.1], opacity: [0, 0, 1, 0] }}
                transition={{ duration: dur, times: [0, IMPACT_AT, IMPACT_AT + 0.12, 1] }}
              >
                <span className="aim-burst">💥</span>
                {e.emoji}
              </motion.div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
