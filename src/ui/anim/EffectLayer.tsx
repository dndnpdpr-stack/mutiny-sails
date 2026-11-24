import { motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { CardBack, CardFace } from '../table/Card';
import { anchorRect } from './anchors';
import type { Anchor, Effect } from './effects';

interface Pt { x: number; y: number }
interface Live { id: number; effect: Effect; path: Pt[]; speed: 1 | 2 }

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
          const [a, b] = path;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          return (
            <div key={`${p.batchKey}-${id}`} data-effect="aim">
              {/* 낸 사람 → 대상으로 뻗는 빨간 화살 */}
              <motion.div
                className="aim-line"
                style={{ left: a.x, top: a.y, width: len, rotate: ang }}
                initial={{ scaleX: 0, opacity: 1 }}
                animate={{ scaleX: 1, opacity: [1, 1, 0] }}
                transition={{ duration: dur, ease: 'easeOut', opacity: { times: [0, 0.7, 1], duration: dur } }}
              />
              <motion.div
                className="aim-hit"
                style={{ left: b.x, top: b.y }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.3, 1], opacity: [0, 1, 0] }}
                transition={{ duration: dur, times: [0, 0.5, 1] }}
              >
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
