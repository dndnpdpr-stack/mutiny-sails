import type { PlayHint, SeatId } from './types';
import type { Game } from './Game';
import { ActionCard, EquipmentCard, type Card, type PlayParams } from './cards/Card';

function valid(game: Game, seat: SeatId, card: Card, p: PlayParams): boolean {
  if (card instanceof ActionCard || card instanceof EquipmentCard) return card.validate(game, seat, p) === null;
  return false;
}

/** turn 대기 중인 본인에게 낼 수 있는 카드와 대상. 아니면 [] */
export function playHints(game: Game, seat: SeatId): PlayHint[] {
  const p = game.pending();
  if (!p || p.kind !== 'turn' || p.seat !== seat) return [];
  const out: PlayHint[] = [];
  for (const card of game.seats[seat].hand) {
    const info = card.info;
    if (!info.needsTarget) {
      if (valid(game, seat, card, {})) out.push({ cardId: card.id, targets: null, targetCards: false });
      continue;
    }
    const targets = game.othersFrom(seat).filter(
      (t) =>
        valid(game, seat, card, { target: t }) ||
        (info.targetsCards && game.seats[t].equipment.some((e) => valid(game, seat, card, { target: t, targetCardId: e.id }))),
    );
    if (targets.length) out.push({ cardId: card.id, targets: targets.sort((a, b) => a - b), targetCards: info.targetsCards });
  }
  return out;
}
