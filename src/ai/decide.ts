import type { Rng } from '../engine/rng';
import type { Action, CardKind, CardView, PendingView, PlayerView, PlayHint, SeatId } from '../engine/types';
import type { AiMemory } from './memory';

const WEAPON_RANGE: Partial<Record<CardKind, number>> = { pistol: 2, musket: 3, longMusket: 4, deckCannon: 5, twinPistols: 1 };
const WEAPONS = Object.keys(WEAPON_RANGE) as CardKind[];

/** 낮을수록 먼저 버린다 */
const KEEP_VALUE: Record<CardKind, number> = {
  rum: 9, dodge: 8, slash: 7, duel: 6, brig: 6, pickpocket: 6, cutRope: 5, cannonade: 5, brawl: 4,
  supplyShip: 5, merchantRaid: 5, feast: 3, loot: 5, pistol: 3, musket: 3, longMusket: 3, deckCannon: 3,
  twinPistols: 2, spyglass: 4, dinghy: 4, barrel: 5, powderKeg: 0,
};

const isTurnOf = (view: PlayerView): boolean => view.pending?.seat === view.you;

function targetScore(view: PlayerView, mem: AiMemory, t: SeatId): number {
  const seat = view.seats[t];
  const alive = view.seats.filter((s) => s.alive).length;
  const weak = (5 - seat.hp) * 0.3;
  const foe = mem.foe(t);
  const isCaptain = seat.role === 'captain';
  switch (view.myRole) {
    case 'captain':
      return foe * 2 + 1 + weak;
    case 'loyalist':
      return isCaptain ? -100 : foe * 2 + weak;
    case 'rebel':
      return isCaptain ? 20 : -foe * 2 + weak;
    case 'spy':
      if (alive <= 2) return isCaptain ? 20 : 0;
      return (isCaptain ? -5 : 5) + (foe > 0 ? 1 : 0) + weak;
  }
}

function bestTarget(view: PlayerView, mem: AiMemory, candidates: SeatId[], minScore: number): SeatId | null {
  let best: SeatId | null = null;
  let bestScore = -Infinity;
  for (const t of candidates) {
    const s = targetScore(view, mem, t);
    if (s > bestScore) {
      best = t;
      bestScore = s;
    }
  }
  return best !== null && bestScore >= minScore ? best : null;
}

function byKind(hand: CardView[], kind: CardKind): CardView[] {
  return hand.filter((c) => c.kind === kind);
}

function decideTurn(view: PlayerView, mem: AiMemory): Action {
  const me = view.seats[view.you];
  const hand = view.myHand;
  const kindOf = (h: PlayHint) => hand.find((c) => c.id === h.cardId)?.kind;
  const hintsOf = (...kinds: CardKind[]) => view.hints.filter((h) => kinds.includes(kindOf(h) as CardKind));
  const equipped = (k: CardKind) => me.equipment.some((c) => c.kind === k);
  const hasWeapon = me.equipment.some((c) => WEAPONS.includes(c.kind));
  const play = (h: PlayHint, target?: SeatId): Action =>
    target === undefined ? { type: 'playCard', cardId: h.cardId } : { type: 'playCard', cardId: h.cardId, target };

  // 장비
  for (const h of hintsOf('pistol', 'musket', 'longMusket', 'deckCannon')) {
    if (WEAPON_RANGE[kindOf(h)!]! > view.myRange) return play(h);
  }
  if (!hasWeapon && byKind(hand, 'slash').length >= 2) {
    const twin = hintsOf('twinPistols')[0];
    if (twin) return play(twin);
  }
  for (const k of ['spyglass', 'dinghy', 'barrel'] as const) {
    if (!equipped(k)) {
      const h = hintsOf(k)[0];
      if (h) return play(h);
    }
  }

  // 회복
  if (me.hp < me.maxHp) {
    const h = hintsOf('rum')[0];
    if (h) return play(h);
  }

  // 카드 뽑기
  for (const k of ['supplyShip', 'merchantRaid', 'loot'] as const) {
    const h = hintsOf(k)[0];
    if (h) return play(h);
  }
  if (me.hp < me.maxHp) {
    const h = hintsOf('feast')[0];
    if (h) return play(h);
  }

  // 공격
  for (const h of hintsOf('slash')) {
    const t = bestTarget(view, mem, h.targets ?? [], -50);
    if (t !== null) return play(h, t);
  }
  if (me.hp >= 3) {
    const h = hintsOf('cannonade', 'brawl')[0];
    if (h) return play(h);
  }
  for (const h of hintsOf('duel')) {
    if (byKind(hand, 'slash').length < 2) break;
    const t = bestTarget(view, mem, h.targets ?? [], 1);
    if (t !== null) return play(h, t);
  }
  for (const h of hintsOf('pickpocket', 'cutRope')) {
    const candidates = (h.targets ?? []).filter((t) => view.seats[t].handCount + view.seats[t].equipment.length > 0);
    const t = bestTarget(view, mem, candidates, 0);
    if (t === null) continue;
    const seat = view.seats[t];
    if (seat.handCount === 0) return { type: 'playCard', cardId: h.cardId, target: t, targetCardId: seat.equipment[0].id };
    return play(h, t);
  }
  for (const h of hintsOf('brig')) {
    const t = bestTarget(view, mem, h.targets ?? [], 1);
    if (t !== null) return play(h, t);
  }
  return { type: 'endTurn' };
}

function lowestValue(cards: CardView[], count: number): string[] {
  return [...cards].sort((a, b) => KEEP_VALUE[a.kind] - KEEP_VALUE[b.kind]).slice(0, count).map((c) => c.id);
}

function nextAliveAfter(view: PlayerView, from: SeatId): SeatId {
  const n = view.seats.length;
  for (let i = 1; i < n; i++) {
    const s = (from + i) % n;
    if (view.seats[s].alive) return s;
  }
  return from;
}

function othersAlive(view: PlayerView): SeatId[] {
  return view.seats.filter((s) => s.alive && s.seat !== view.you).map((s) => s.seat);
}

function chooseJudgeCard(view: PlayerView, options: CardView[]): CardView {
  const me = view.seats[view.you];
  const isKegHit = (c: CardView) => c.suit === 'spades' && c.rank >= 2 && c.rank <= 9;
  if (me.equipment.some((c) => c.kind === 'powderKeg')) return options.find((c) => !isKegHit(c)) ?? options[0];
  return options.find((c) => c.suit === 'hearts') ?? options[0];
}

/** 판단이 서지 않을 때의 기본 행동 (엔진의 시간 초과 규칙과 같다) */
export function fallbackAction(view: PlayerView): Action | null {
  const p = view.pending;
  if (!p || p.seat !== view.you) return null;
  switch (p.kind) {
    case 'turn':
      return { type: 'endTurn' };
    case 'respondAttack':
    case 'respondBrawl':
    case 'respondDuel':
    case 'dying':
      return { type: 'respond', cardIds: [] };
    case 'discardExcess':
      return { type: 'discard', cardIds: view.myHand.slice(0, p.count).map((c) => c.id) };
    case 'loot':
      return { type: 'chooseCard', cardId: p.revealed[0].id };
    case 'judgeChoice':
      return { type: 'chooseCard', cardId: p.options[0].id };
    case 'peekTarget': {
      const others = othersAlive(view);
      return { type: 'chooseSeat', target: others.find((s) => view.seats[s].handCount > 0) ?? others[0] };
    }
    case 'passKeg':
      return { type: 'chooseSeat', target: nextAliveAfter(view, view.you) };
    case 'drawSource':
      return { type: 'chooseDrawSource', fromDiscard: false };
    case 'chooseCharacter':
      return { type: 'chooseCharacter', character: p.options[0] };
  }
}

function respond(view: PlayerView, p: PendingView): Action | null {
  const hand = view.myHand;
  switch (p.kind) {
    case 'respondAttack': {
      const d = byKind(hand, 'dodge')[0];
      return { type: 'respond', cardIds: d ? [d.id] : [] };
    }
    case 'respondBrawl': {
      const s = byKind(hand, 'slash')[0];
      return { type: 'respond', cardIds: s ? [s.id] : [] };
    }
    case 'respondDuel': {
      const s = byKind(hand, 'slash');
      return { type: 'respond', cardIds: s.length >= p.required ? s.slice(0, p.required).map((c) => c.id) : [] };
    }
    case 'dying': {
      const r = byKind(hand, 'rum');
      return { type: 'respond', cardIds: r.length >= p.need ? r.slice(0, p.need).map((c) => c.id) : [] };
    }
    default:
      return null;
  }
}

/** view만 보고 행동을 고른다. 내가 기다림의 대상이 아니면 null */
export function decide(view: PlayerView, mem: AiMemory, rng: Rng): Action | null {
  mem.update(view);
  const p = view.pending;
  if (!p || !isTurnOf(view)) return null;

  const responded = respond(view, p);
  if (responded) return responded;

  switch (p.kind) {
    case 'turn':
      return decideTurn(view, mem);
    case 'discardExcess':
      return { type: 'discard', cardIds: lowestValue(view.myHand, p.count) };
    case 'loot': {
      const best = [...p.revealed].sort((a, b) => KEEP_VALUE[b.kind] - KEEP_VALUE[a.kind])[0];
      return { type: 'chooseCard', cardId: best.id };
    }
    case 'judgeChoice':
      return { type: 'chooseCard', cardId: chooseJudgeCard(view, p.options).id };
    case 'peekTarget': {
      const others = othersAlive(view).filter((s) => view.seats[s].handCount > 0);
      const pool = others.length ? others : othersAlive(view);
      return { type: 'chooseSeat', target: bestTarget(view, mem, pool, -Infinity) ?? pool[rng.int(pool.length)] };
    }
    case 'drawSource': {
      const top = view.discardTop;
      return { type: 'chooseDrawSource', fromDiscard: !!top && (top.kind === 'rum' || top.kind === 'dodge' || top.kind === 'slash') };
    }
    default:
      return fallbackAction(view);
  }
}
