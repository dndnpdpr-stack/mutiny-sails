import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Action, CardView, PlayerView, SeatId } from '../../engine/types';
import { CardInfoContext } from '../table/Card';
import { EffectLayer } from '../anim/EffectLayer';
import type { Effect } from '../anim/effects';
import { CenterPile } from '../table/CenterPile';
import { GameLog } from '../table/GameLog';
import { MyArea } from '../table/MyArea';
import { OpponentPanel, type SeatFx } from '../table/OpponentPanel';
import { PeekNote, PlankWarnNote, PromptNote, TargetCardNote, WeaponSwapNote, responseNeed, responseWith } from '../table/PromptNote';
import { CARD_CATALOG } from '../../engine/cards/catalog';
import { CardInfoNote } from '../table/CardInfoNote';
import { latestPeek, peekMemos } from '../table/peek';
import { DorothyNote, KikiNote, dorothyTargets, kikiTargets } from '../table/AbilityNote';
import { seaEventTitle } from '../format';
import type { SeaEventId } from '../../engine/seaEvents';
import type { Spectate } from '../table/MyArea';

type Flags = Record<string, number>;

/** 연출 시간 동안 자리별 클래스(shake/dying/turn-glow)와 "내 차례!" 띠를 켠다 */
function useEffectFlags(effects: Effect[], speed: 1 | 2, key: number): Flags {
  const [flags, setFlags] = useState<Flags>({});
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  // 같은 묶음 안에서 배속만 바뀌면 처음부터 다시 켜지 않고, 지나간 시간(배속 전 기준)만큼 이어서 간다
  const clock = useRef({ key, speed, tick: Date.now(), elapsed: 0, started: new Set<number>() });
  useLayoutEffect(() => {
    const c = clock.current;
    const now = Date.now();
    if (c.key === key) {
      c.elapsed += (now - c.tick) * c.speed;
    } else {
      c.key = key;
      c.elapsed = 0;
      c.started = new Set();
      setFlags({});
    }
    c.tick = now;
    c.speed = speed;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const bump = (names: string[], d: number) =>
      setFlags((f) => {
        const next = { ...f };
        for (const k of names) next[k] = Math.max(0, (next[k] ?? 0) + d);
        return next;
      });
    effectsRef.current.forEach((e, id) => {
      const names: string[] = [];
      if (e.kind === 'shake') names.push(`${e.seat}:shake`);
      if (e.kind === 'death') names.push(`${e.seat}:dying`);
      if (e.kind === 'turn') {
        names.push(`${e.seat}:turn-glow`);
        if (e.mine) names.push('banner');
      }
      const end = e.at + e.ms;
      if (names.length === 0 || end <= c.elapsed) return;
      if (!c.started.has(id)) {
        timers.push(
          setTimeout(
            () => {
              c.started.add(id);
              bump(names, 1);
            },
            Math.max(0, e.at - c.elapsed) / speed,
          ),
        );
      }
      timers.push(setTimeout(() => bump(names, -1), (end - c.elapsed) / speed));
    });
    return () => timers.forEach(clearTimeout);
  }, [key, speed]);
  return flags;
}

const FX: SeatFx[] = ['shake', 'dying', 'turn-glow'];
/** 바다 이벤트 띠는 배속과 상관없이 이 시간(실제 시간) 동안 보인다 */
export const SEA_BANNER_MS = 1600;

/** 새 묶음에 바다 이벤트가 있으면 띠를 띄운다. 같은 묶음에 내 차례가 오면 함께 알린다 */
function useSeaBanner(effects: Effect[], key: number) {
  const [banner, setBanner] = useState<{ event: SeaEventId; mine: boolean } | null>(null);
  const effectsRef = useRef(effects);
  effectsRef.current = effects;
  // 다음 장면(batch)이 시작돼도 끄는 타이머는 살아 있어야 한다. 새 이벤트가 오거나 화면이 닫힐 때만 취소
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const sea = [...effectsRef.current].reverse().find((e) => e.kind === 'sea');
    if (!sea || sea.kind !== 'sea') return;
    const mine = effectsRef.current.some((e) => e.kind === 'turn' && e.mine);
    setBanner({ event: sea.event, mine });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setBanner(null), SEA_BANNER_MS);
  }, [key]);
  return banner;
}

/** 그리기는 shown, 조작은 latest */
export function TableScreen(p: {
  latest: PlayerView;
  shown: PlayerView;
  effects: Effect[];
  speed: 1 | 2;
  batchKey: number;
  send: (a: Action) => void;
  lastRejection: string | null;
  /** 내가 쓰러진 뒤 관전 중에 쓰는 버튼 */
  spectate?: Spectate;
  /** 2배속 모드 켜기/끄기 */
  doubleSpeed?: { on: boolean; onToggle: () => void };
}) {
  const { latest, shown, send } = p;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<{ cardId: string; target: SeatId } | null>(null);
  const [peekAck, setPeekAck] = useState(0);
  const [abilityOpen, setAbilityOpen] = useState(false);
  // 설명 중인 카드. hand면 손패 카드(낼 수 있으면 내기 버튼, 손을 떠나면 닫힘), 아니면 쪽지·장비·더미의 카드
  const [info, setInfo] = useState<{ card: CardView; hand: boolean } | null>(null);
  const closeInfo = () => setInfo(null);
  const newPeek = latestPeek(latest.events, latest.you, peekAck);
  const memos = peekMemos(latest.events, latest.you);

  const flags = useEffectFlags(p.effects, p.speed, p.batchKey);
  const seaBanner = useSeaBanner(p.effects, p.batchKey);
  const fxOf = (s: SeatId) => FX.filter((c) => (flags[`${s}:${c}`] ?? 0) > 0);

  const hint = selectedId ? (latest.hints.find((h) => h.cardId === selectedId && latest.myHand.some((c) => c.id === h.cardId)) ?? null) : null;
  const pick = pickFor && hint?.cardId === pickFor.cardId ? pickFor : null;
  // 무기를 이미 끼고 있으면 바로 내지 않고 바꿀지 묻는다
  const [swap, setSwap] = useState<{ oldCard: CardView; newCard: CardView } | null>(null);
  // 널빤지 걷기를 내면 나도 버리게 될 때 먼저 묻는다
  const [plank, setPlank] = useState<{ card: CardView; mine: number; others: string[] } | null>(null);
  const cancel = () => {
    setSelectedId(null);
    setPickFor(null);
    setSwap(null);
    setPlank(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (cancel(), closeInfo());
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

  // 누르면 바로 낸다(대상이 있으면 들어 올리고 대상 고르기). 설명은 우클릭·길게 누르기로 따로 본다
  const infoCard = !info ? null : info.hand ? (latest.myHand.find((c) => c.id === info.card.id) ?? null) : info.card;
  const playNow = (id: string) => {
    cancel();
    closeInfo();
    const card = latest.myHand.find((c) => c.id === id);
    const old = latest.seats[latest.you].equipment.find((c) => CARD_CATALOG[c.kind].weapon);
    if (card && old && CARD_CATALOG[card.kind].weapon) return setSwap({ oldCard: old, newCard: card });
    if (card?.kind === 'walkPlank') {
      const mine = latest.myHand.length - 1;
      const rivals = latest.seats.filter((s) => s.alive && s.seat !== latest.you);
      const most = Math.max(0, ...rivals.map((s) => s.handCount));
      if (mine > 0 && mine >= most) return setPlank({ card, mine, others: rivals.filter((s) => s.handCount === mine).map((s) => s.name) });
    }
    send({ type: 'playCard', cardId: id });
  };
  const onHandInfo = (id: string) => {
    const c = latest.myHand.find((x) => x.id === id);
    if (c) setInfo({ card: c, hand: true });
  };
  // 쪽지(고르기 창)가 바뀌거나 닫히면 그 쪽지 카드의 설명도 닫는다
  useEffect(() => setInfo((i) => (i && !i.hand ? null : i)), [latest.pending]);
  const onCardClick = (id: string) => {
    closeInfo();
    if (!canPlay(id)) return;
    const ids = responseWith(latest, id);
    if (ids) return send({ type: 'respond', cardIds: ids });
    if (selectedId === id) return cancel();
    const h = latest.hints.find((x) => x.cardId === id);
    if (!h) return;
    if (h.targets === null) return playNow(id);
    setPickFor(null);
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
  const b = shown.myBounty;
  const bountyNote = !b ? undefined : b.state === 'open' ? `🎯 표적: ${shown.seats[b.target].name}` : b.state === 'claimed' ? '✅ 표적 처치! 살아남으세요' : '❌ 표적을 놓쳤어요';
  const others = Array.from({ length: n - 1 }, (_, i) => shown.seats[(shown.you + 1 + i) % n]);
  const me = shown.seats[shown.you];
  const name = (s: SeatId) => shown.seats[s]?.name ?? '?';

  const myTurn = latest.pending?.kind === 'turn' && latest.pending.seat === latest.you;
  const latestMe = latest.seats[latest.you];
  const slashes = latest.myHand.filter((c) => c.kind === 'slash');
  const canAct = myTurn && !latest.abilityUsed;
  // 턴이 넘어가면 열어 둔 능력 창을 닫는다 (다음 턴에 저절로 다시 뜨지 않게)
  useEffect(() => {
    if (!myTurn) setAbilityOpen(false);
    cancel();
  }, [myTurn]);
  const infoHint = infoCard && info?.hand ? latest.hints.find((h) => h.cardId === infoCard.id) : undefined;
  const openAbility = () => (cancel(), setAbilityOpen(true));
  const ability =
    latestMe.character === 'derrick'
      ? {
          enabled: canAct && slashes.length >= 2,
          onUse: () => (cancel(), send({ type: 'useAbility', cardIds: slashes.slice(0, 2).map((c) => c.id) })),
        }
      : latestMe.character === 'dorothy'
        ? { enabled: canAct && latest.myHand.some((c) => c.kind === 'rum') && dorothyTargets(latest).length > 0, onUse: openAbility }
        : latestMe.character === 'kiki'
          ? { enabled: canAct && latest.myHand.length > 0 && kikiTargets(latest).length > 0, onUse: openAbility }
          : null;

  return (
    <CardInfoContext.Provider value={(card) => setInfo({ card, hand: false })}>
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
                peeked={memos[s.seat] ?? null}
                style={{ marginTop: Math.round((1 - lift) * 48) }}
                onClick={() => onSeatClick(s.seat)}
              />
            );
          })}
        </div>

        <div className="table-middle">
          <CenterPile deckCount={shown.deckCount} discardTop={shown.discardTop} seaEventsOn={shown.seaEventsOn} seaEvent={shown.seaEvent} />
          <GameLog events={shown.events} name={name} />
        </div>

        <MyArea
          me={me}
          myRole={shown.myRole}
          mySpecial={shown.mySpecial}
          roleNote={bountyNote}
          myRange={shown.myRange}
          current={shown.current === shown.you}
          fx={fxOf(shown.you)}
          hand={shown.myHand}
          canPlay={canPlay}
          highlight={highlight}
          selectedId={hint?.cardId ?? null}
          onCardClick={onCardClick}
          onCardInfo={onHandInfo}
          canEndTurn={myTurn}
          onEndTurn={() => (cancel(), send({ type: 'endTurn' }))}
          ability={ability}
          spectate={p.spectate}
          doubleSpeed={p.doubleSpeed}
        />

        {infoCard && (!info?.hand || (me.alive && !pick)) && (
          <CardInfoNote card={infoCard} onPlay={infoHint && infoHint.targets === null ? () => playNow(infoCard.id) : null} onClose={closeInfo} />
        )}
        <PromptNote view={latest} send={send} />
        {abilityOpen && myTurn && latestMe.character === 'dorothy' && <DorothyNote view={latest} send={send} onClose={() => setAbilityOpen(false)} />}
        {abilityOpen && myTurn && latestMe.character === 'kiki' && <KikiNote view={latest} send={send} onClose={() => setAbilityOpen(false)} />}
        {newPeek && <PeekNote targetName={latest.seats[newPeek.target].name} card={newPeek.card} onClose={() => setPeekAck(newPeek.seq ?? 0)} />}
        {pick && (
          <TargetCardNote
            targetName={latest.seats[pick.target].name}
            equipment={latest.seats[pick.target].equipment}
            handCount={latest.seats[pick.target].handCount}
            onPick={(cardId) => {
              send(
                cardId
                  ? { type: 'playCard', cardId: pick.cardId, target: pick.target, targetCardId: cardId }
                  : { type: 'playCard', cardId: pick.cardId, target: pick.target },
              );
              cancel();
            }}
            onCancel={cancel}
          />
        )}

        {seaBanner && (
          <div className="turn-banner sea-banner">
            <div>{seaEventTitle(seaBanner.event)}!</div>
            {seaBanner.mine && <div className="sea-banner-turn">내 차례!</div>}
          </div>
        )}
        {(flags.banner ?? 0) > 0 && !seaBanner && <div className="turn-banner">내 차례!</div>}
        {swap && (
        <WeaponSwapNote
          oldCard={swap.oldCard}
          newCard={swap.newCard}
          onYes={() => (send({ type: 'playCard', cardId: swap.newCard.id }), setSwap(null))}
          onNo={() => setSwap(null)}
        />
      )}
      {plank && (
        <PlankWarnNote
          card={plank.card}
          mine={plank.mine}
          others={plank.others}
          onYes={() => (send({ type: 'playCard', cardId: plank.card.id }), setPlank(null))}
          onNo={() => setPlank(null)}
        />
      )}
      {p.lastRejection && <div className="toast note">{p.lastRejection}</div>}
        <EffectLayer effects={p.effects} speed={p.speed} batchKey={p.batchKey} />
      </div>
    </CardInfoContext.Provider>
  );
}
