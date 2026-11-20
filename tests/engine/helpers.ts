import { Game, type GameConfig } from '../../src/engine/Game';
import type { CardKind, CharacterId, Rank, Role, SeatId, Suit } from '../../src/engine/types';
import type { Card } from '../../src/engine/cards/Card';

export const DEFAULT_CHARS: CharacterId[] = ['derrick', 'bruno', 'hanna', 'orso', 'tom', 'sila', 'bibi'];

/** 0번이 선장인 고정 역할 */
export function defaultRoles(n: number): Role[] {
  const base: Role[] = ['captain', 'rebel', 'rebel', 'spy', 'loyalist', 'rebel', 'loyalist'];
  return base.slice(0, n);
}

export function makeGame(n: number, opts: Partial<GameConfig> = {}): Game {
  return new Game({
    seed: 1,
    names: Array.from({ length: n }, (_, i) => `P${i}`),
    roles: defaultRoles(n),
    characters: DEFAULT_CHARS.slice(0, n),
    ...opts,
  });
}

/** 덱/버린 카드/손패/장비 어디에 있든 해당 종류 카드 하나를 꺼내 돌려준다. (테스트 전용) */
export function pull(game: Game, kind: CardKind): Card {
  const pools: Card[][] = [game.deck, game.discard, ...game.seats.map((s) => s.hand), ...game.seats.map((s) => s.equipment)];
  for (const pool of pools) {
    const i = pool.findIndex((c) => c.kind === kind);
    if (i >= 0) return pool.splice(i, 1)[0];
  }
  throw new Error(`no card of kind ${kind}`);
}

export function giveHand(game: Game, seat: SeatId, kind: CardKind): Card {
  const c = pull(game, kind);
  game.seats[seat].hand.push(c);
  return c;
}

export function giveEquip(game: Game, seat: SeatId, kind: CardKind): Card {
  const c = pull(game, kind);
  game.seats[seat].equipment.push(c);
  return c;
}

/** 손패를 비우고(덱 맨 아래로 되돌림) 지정한 종류로 채운다 */
export function setHand(game: Game, seat: SeatId, kinds: CardKind[]): Card[] {
  game.deck.unshift(...game.seats[seat].hand.splice(0));
  return kinds.map((k) => giveHand(game, seat, k));
}

export interface TopSpec {
  kind?: CardKind;
  suit?: Suit;
  rank?: Rank;
}

/** 덱 맨 위(뽑히는 순서대로)에 카드들을 올린다. 문양·숫자를 강제로 바꿀 수 있다 */
export function stackTop(game: Game, specs: TopSpec[]): Card[] {
  const out: Card[] = [];
  for (const s of specs) {
    const c = pull(game, s.kind ?? 'slash');
    if (s.suit) (c as { suit: Suit }).suit = s.suit;
    if (s.rank) (c as { rank: Rank }).rank = s.rank;
    out.push(c);
  }
  game.deck.push(...[...out].reverse());
  return out;
}

export const ids = (cards: Card[]) => cards.map((c) => c.id);

/** 현재 턴인 사람이 턴을 끝내고(넘치면 앞에서부터 버림) 다음 사람으로 넘긴다 */
export function passTurn(g: Game) {
  const seat = g.current;
  const r = g.apply(seat, { type: 'endTurn' });
  if (!r.ok) throw new Error(r.reason);
  const p = g.pending();
  if (p?.kind === 'discardExcess') g.apply(seat, { type: 'discard', cardIds: g.seats[seat].hand.slice(0, p.count).map((c) => c.id) });
}

export function passUntil(g: Game, seat: number) {
  while (g.current !== seat) passTurn(g);
}

/** 역할 카드 뽑기를 첫 남은 카드로 모두 끝낸다 (역할을 강제하지 않은 게임용) */
export function startPastRoles(g: Game) {
  g.start();
  for (let p = g.pending(); p?.kind === 'drawRole'; p = g.pending()) g.apply(p.seat, { type: 'drawRole', slot: p.slots[0] });
}
