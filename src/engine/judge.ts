import type { CardView, JudgeReason, SeatId } from './types';
import type { Game } from './Game';
import type { Card } from './cards/Card';

/**
 * 덱 맨 위를 뒤집어 판정한다. 뒤집은 카드는 버린 카드로.
 * 캐릭터가 2장을 뒤집으면 judgeChoice 입력을 받아 하나를 고른다.
 * 뒤집을 카드가 없으면 실패.
 */
export function judge(game: Game, seat: SeatId, reason: JudgeReason, success: (c: CardView) => boolean, then: (ok: boolean) => void): void {
  const flipped = game.draw(game.judgeFlipCount(seat));
  for (const c of flipped) game.discardCard(c);
  const finish = (c: Card | undefined) => {
    let ok = c ? success(c.toView()) : false;
    // 행운의 동전: 같은 숫자의 ♥였다면 결과가 달라질 때(♥는 모든 판정에서 좋은 쪽) 바꾸고 버린다
    if (c && game.hasEquip(seat, 'luckyCoin')) {
      const asHeart = success({ ...c.toView(), suit: 'hearts' });
      if (asHeart !== ok) {
        game.useUpGear(seat, 'luckyCoin');
        ok = asHeart;
      }
    }
    if (c) game.emit({ type: 'judge', seat, card: c.toView(), success: ok, reason });
    // 노름꾼 루카: ♣이 나오면 1장
    const ch = game.seats[seat].character;
    if (c && c.suit === 'clubs' && ch.drawsOnClubJudge() && game.seats[seat].alive) {
      game.emit({ type: 'ability', seat, character: ch.id });
      game.giveCards(seat, game.draw(1));
    }
    then(ok);
  };
  if (flipped.length < 2) {
    finish(flipped[0]);
    return;
  }
  game.pushInput({ kind: 'judgeChoice', seat, options: flipped.map((c) => c.toView()), reason }, (a) => {
    if (a.type !== 'chooseCard') return '판정에 쓸 카드를 골라 주세요';
    const c = flipped.find((x) => x.id === a.cardId);
    if (!c) return '뒤집은 카드 중에서 골라 주세요';
    finish(c);
    return null;
  });
}

export const isHeart = (c: CardView) => c.suit === 'hearts';
export const isKegBlast = (c: CardView) => c.suit === 'spades' && c.rank >= 2 && c.rank <= 9;
