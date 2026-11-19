import type { CardKind, CardView, SeatId } from './types';
import type { Game } from './Game';
import type { Card } from './cards/Card';

/**
 * 덱 맨 위를 뒤집어 판정한다. 뒤집은 카드는 버린 카드로.
 * 캐릭터가 2장을 뒤집으면 judgeChoice 입력을 받아 하나를 고른다.
 * 뒤집을 카드가 없으면 실패.
 */
export function judge(game: Game, seat: SeatId, reason: CardKind, success: (c: CardView) => boolean, then: (ok: boolean) => void): void {
  const flipped = game.draw(game.seats[seat].character.judgeFlipCount());
  for (const c of flipped) game.discardCard(c);
  const finish = (c: Card | undefined) => {
    const ok = c ? success(c.toView()) : false;
    if (c) game.emit({ type: 'judge', seat, card: c.toView(), success: ok, reason });
    then(ok);
  };
  if (flipped.length < 2) {
    finish(flipped[0]);
    return;
  }
  game.pushInput({ kind: 'judgeChoice', seat, options: flipped.map((c) => c.toView()) }, (a) => {
    if (a.type !== 'chooseCard') return '판정에 쓸 카드를 골라 주세요';
    const c = flipped.find((x) => x.id === a.cardId);
    if (!c) return '뒤집은 카드 중에서 골라 주세요';
    finish(c);
    return null;
  });
}

export const isHeart = (c: CardView) => c.suit === 'hearts';
export const isKegBlast = (c: CardView) => c.suit === 'spades' && c.rank >= 2 && c.rank <= 9;
