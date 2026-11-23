import type { GameEvent, PendingView, PlayerView, SeatId } from '../engine/types';
import type { Game } from '../engine/Game';
import { distance, weaponRange } from '../engine/rules';
import { playHints } from '../engine/legal';

const EVENT_LIMIT = 100;

function visible(e: GameEvent, seat: SeatId): boolean {
  return !e.visibleTo || e.visibleTo.includes(seat);
}

function maskPending(p: PendingView | null, seat: SeatId): PendingView | null {
  if (p && p.kind === 'chooseCharacter' && p.seat !== seat) return { ...p, options: [] };
  if (p && p.kind === 'treasureMap' && p.seat !== seat) return { ...p, revealed: [] };
  return p;
}

/** 한 플레이어가 볼 수 있는 정보만 골라 화면 상태를 만든다 */
export function buildView(game: Game, seat: SeatId, isAi: (s: SeatId) => boolean): PlayerView {
  const me = game.seats[seat];
  const over = game.winner !== null;
  const distances: Record<SeatId, number> = {};
  if (me.alive) for (const s of game.othersFrom(seat)) distances[s] = distance(game, seat, s);

  const events: GameEvent[] = [];
  for (let i = game.events.length - 1; i >= 0 && events.length < EVENT_LIMIT; i--) {
    const e = game.events[i];
    if (visible(e, seat)) events.push(e);
  }
  events.reverse();

  return {
    you: seat,
    myRole: me.roleDrawn ? me.role : null,
    myHand: me.hand.map((c) => c.toView()),
    seats: game.seats.map((s) => ({
      seat: s.seat,
      name: s.name,
      character: s.characterChosen ? s.character.id : null,
      hp: s.hp,
      maxHp: s.maxHp,
      alive: s.alive,
      handCount: s.hand.length,
      equipment: s.equipment.map((c) => c.toView()),
      role: s.roleDrawn && (over || s.seat === seat || s.role === 'captain' || !s.alive || game.knowsRole(seat, s.seat)) ? s.role : null,
      isAi: isAi(s.seat),
    })),
    current: game.current,
    pending: maskPending(game.pending(), seat),
    hints: playHints(game, seat),
    deckCount: game.deck.length,
    discardTop: game.discard.at(-1)?.toView() ?? null,
    distances,
    myRange: weaponRange(game, seat),
    abilityUsed: game.current === seat && game.abilityUsedThisTurn,
    events,
    winner: game.winner,
    seaEventsOn: game.seaEventsOn,
    seaEvent: game.seaEvent,
  };
}
