import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CardBack, CardFace } from '../table/Card';
import { anchorRect } from './anchors';
import type { Anchor, Effect } from './effects';

interface Pt { x: number; y: number }
interface Live { id: number; effect: Effect; path: Pt[]; }

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
    default:
      return null;
  }
}

export function EffectLayer(p: { effects: Effect[]; speed: 1 | 2; batchKey: number }) {
  const [live, setLive] = useState<Live[]>([]);

  useEffect(() => {
    setLive([]);
    const timers: ReturnType<typeof setTimeout>[] = [];
    p.effects.forEach((effect, id) => {
      timers.push(
        setTimeout(() => {
          const path = resolve(effect);
          if (!path) return;
          setLive((l) => [...l, { id, effect, path }]);
        }, effect.at / p.speed),
        setTimeout(() => setLive((l) => l.filter((x) => x.id !== id)), (effect.at + effect.ms) / p.speed),
      );
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.batchKey, p.effects, p.speed]);

  return (
    <div className="effect-layer" aria-hidden="true">
      {live.map(({ id, effect: e, path }) => {
        const dur = e.ms / p.speed / 1000;
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
            <motion.div
              key={`${p.batchKey}-${id}`}
              data-effect="judge"
              className={`judge-ghost ${e.success ? 'success' : 'fail'}`}
              style={{ left: path[0].x, top: path[0].y }}
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: Math.min(dur, 0.4) }}
            >
              <CardFace card={e.card} size="sm" />
            </motion.div>
          );
        }
        return null;
      })}
    </div>
  );
}
