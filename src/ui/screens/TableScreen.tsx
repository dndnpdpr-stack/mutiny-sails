import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Action, PlayerView, SeatId } from '../../engine/types';
import { EffectLayer } from '../anim/EffectLayer';
import type { Effect } from '../anim/effects';
import { CenterPile } from '../table/CenterPile';
import { GameLog } from '../table/GameLog';
import { MyArea } from '../table/MyArea';
import { OpponentPanel, type SeatFx } from '../table/OpponentPanel';
import { PromptNote, TargetCardNote, responseNeed, responseWith } from '../table/PromptNote';

type Flags = Record<string, number>;

/** 연출 시간 동안 자리별 클래스(shake/dying/turn-glow)와 "내 차례!" 띠를 켠다 */
function useEffectFlags(effects: Effect[], speed: 1 | 2, key: number): Flags {
  const [flags, setFlags] = useState<Flags>({});
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  useLayoutEffect(() => {
    setFlags({});
    const timers: ReturnType<typeof setTimeout>[] = [];
    const bump = (k: string, d: number) => setFlags((f) => ({ ...f, [k]: Math.max(0, (f[k] ?? 0) + d) }));
    for (const e of effectsRef.current) {
      const names: string[] = [];
      if (e.kind === 'shake') names.push(`${e.seat}:shake`);
      if (e.kind === 'death') names.push(`${e.seat}:dying`);
      if (e.kind === 'turn') {
        names.push(`${e.seat}:turn-glow`);
        if (e.mine) names.push('banner');
      }
      for (const k of names) {
        timers.push(setTimeout(() => bump(k, 1), e.at / speed));
        timers.push(setTimeout(() => bump(k, -1), (e.at + e.ms) / speed));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [key, speed]);
  return flags;
}

const FX: SeatFx[] = ['shake', 'dying', 'turn-glow'];

/** 그리기는 shown, 조작은 latest */
export function TableScreen(p: {
  latest: PlayerView;
  shown: PlayerView;
  effects: Effect[];
  speed: 1 | 2;
  batchKey: number;
  send: (a: Action) => void;
  lastRejection: string | null;
}) {
  const { latest, shown, send } = p;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<{ cardId: string; target: SeatId } | null>(null);

  const flags = useEffectFlags(p.effects, p.speed, p.batchKey);
  const fxOf = (s: SeatId) => FX.filter((c) => (flags[`${s}:${c}`] ?? 0) > 0);

  const hint = selectedId ? latest.hints.find((h) => h.cardId === selectedId && latest.myHand.some((c) => c.id === h.cardId)) ?? null : null;
  const pick = pickFor && hint?.cardId === pickFor.cardId ? pickFor : null;
  const cancel = () => {
    setSelectedId(null);
    setPickFor(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const inLatest = new Set(latest.myHand.map((c) => c.id));
  const hinted = new Set(latest.hints.map((h) => h.cardId));
  const need = responseNeed(latest);
  const respondable = (id: string) => responseWith(latest, id) !== null;
  const highlight = (id: string) => !!need && latest.myHand.some((c) => c.id === id && c.kind === need.kind);
  const canPlay = (id: string) => inLatest.has(id) && (hinted.has(id) || respondable(id));

  const onCardClick = (id: string) => {
    if (!canPlay(id)) return;
    const ids = responseWith(latest, id);
    if (ids) return send({ type: 'respond', cardIds: ids });
    if (selectedId === id) return cancel();
    const h = latest.hints.find((x) => x.cardId === id);
    if (!h) return;
    setPickFor(null);
    if (h.targets === null) {
      setSelectedId(null);
      return send({ type: 'playCard', cardId: id });
    }
    setSelectedId(id);
  };

  const onSeatClick = (target: SeatId) => {
    if (!hint?.targets?.includes(target)) return;
    const t = latest.seats[target];
    if (hint.targetCards && t.equipment.length > 0) {
      setPickFor({ cardId: hint.cardId, target });
      return;
    }
    send({ type: 'playCard', cardId: hint.cardId, target });
    cancel();
  };

  const n = shown.seats.length;
  const others = Array.from({ length: n - 1 }, (_, i) => shown.seats[(shown.you + 1 + i) % n]);
  const me = shown.seats[shown.you];
  const name = (s: SeatId) => shown.seats[s]?.name ?? '?';

  const myTurn = latest.pending?.kind === 'turn' && latest.pending.seat === latest.you;
  const latestMe = latest.seats[latest.you];
  const slashes = latest.myHand.filter((c) => c.kind === 'slash');

  return (
    <div className="table-bg table-screen">
      <div className="opp-arc">
        {others.map((s, i) => {
          const lift = Math.sin((Math.PI * (i + 0.5)) / others.length);
          return (
            <OpponentPanel
              key={s.seat}
              seat={s}
              current={shown.current === s.seat}
              distance={shown.distances[s.seat]}
              targetable={!!hint?.targets?.includes(s.seat)}
              outOfRange={!!hint?.targets && s.alive && !hint.targets.includes(s.seat)}
              fx={fxOf(s.seat)}
              style={{ marginTop: Math.round((1 - lift) * 48) }}
              onClick={() => onSeatClick(s.seat)}
            />
          );
        })}
      </div>

      <div className="table-middle">
        <CenterPile deckCount={shown.deckCount} discardTop={shown.discardTop} />
        <GameLog events={shown.events} name={name} />
      </div>

      <MyArea
        me={me}
        myRole={shown.myRole}
        myRange={shown.myRange}
        current={shown.current === shown.you}
        fx={fxOf(shown.you)}
        hand={shown.myHand}
        canPlay={canPlay}
        highlight={highlight}
        selectedId={hint?.cardId ?? null}
        onCardClick={onCardClick}
        canEndTurn={myTurn}
        onEndTurn={() => (cancel(), send({ type: 'endTurn' }))}
        ability={
          latestMe.character === 'derrick'
            ? {
                enabled: myTurn && slashes.length >= 2,
                onUse: () => (cancel(), send({ type: 'useAbility', cardIds: slashes.slice(0, 2).map((c) => c.id) })),
              }
            : null
        }
      />

      <PromptNote view={latest} send={send} />
      {pick && (
        <TargetCardNote
          targetName={latest.seats[pick.target].name}
          equipment={latest.seats[pick.target].equipment}
          handCount={latest.seats[pick.target].handCount}
          onPick={(cardId) => {
            send(cardId ? { type: 'playCard', cardId: pick.cardId, target: pick.target, targetCardId: cardId } : { type: 'playCard', cardId: pick.cardId, target: pick.target });
            cancel();
          }}
          onCancel={cancel}
        />
      )}

      {(flags.banner ?? 0) > 0 && <div className="turn-banner">내 차례!</div>}
      {p.lastRejection && <div className="toast note">{p.lastRejection}</div>}
      <EffectLayer effects={p.effects} speed={p.speed} batchKey={p.batchKey} />
    </div>
  );
}
