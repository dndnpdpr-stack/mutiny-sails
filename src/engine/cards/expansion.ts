import type { SeatId } from '../types';
import type { Game } from '../Game';
import { ActionCard, EquipmentCard, WeaponCard, registerCard, type Card, type PlayParams } from './Card';
import { checkOtherTarget } from './actions';
import { distance, weaponRange } from '../rules';

// ───────────── 확장 카드 ─────────────

/** 앵무새의 고자질: 선장이 아닌 1명의 역할을 나만 본다 */
export class ParrotTattle extends ActionCard {
  validate(game: Game, actor: SeatId, p: PlayParams): string | null {
    const err = checkOtherTarget(game, actor, p);
    if (err) return err;
    if (game.seats[p.target!].role === 'captain') return '선장의 역할은 이미 모두 알아요';
    return null;
  }
  play(game: Game, actor: SeatId, p: PlayParams): void {
    game.revealRoleTo(actor, p.target!);
  }
}

/** 보물 지도: 덱 위 3장을 나만 보고 1장 가져가고 나머지는 버린다 */
export class TreasureMap extends ActionCard {
  validate(): string | null {
    return null;
  }
  play(game: Game, actor: SeatId): void {
    const cards = game.draw(3);
    if (cards.length <= 1) {
      game.giveCards(actor, cards);
      return;
    }
    game.pushInput({ kind: 'treasureMap', seat: actor, revealed: cards.map((c) => c.toView()) }, (a) => {
      if (a.type !== 'chooseCard') return '가져갈 카드를 골라 주세요';
      const picked = cards.find((c) => c.id === a.cardId);
      if (!picked) return '지도에 나온 카드 중에서 골라 주세요';
      game.giveCards(actor, [picked]);
      const rest = cards.filter((c) => c !== picked);
      for (const c of rest) game.discardCard(c);
      // 지도에 나온 카드는 나만 본다
      game.emit({ type: 'discardCards', seat: actor, cards: rest.map((c) => c.toView()), visibleTo: [actor] });
      return null;
    });
  }
}

/** 주사위 내기: 둘 다 덱 맨 위를 뒤집어 높은 쪽이 낮은 쪽 손패 1장(무작위)을 가져간다 */
export class DiceWager extends ActionCard {
  validate(game: Game, actor: SeatId, p: PlayParams): string | null {
    return checkOtherTarget(game, actor, p);
  }
  play(game: Game, actor: SeatId, p: PlayParams): void {
    game.unlessResisted(p.target!, 'diceWager', () => this.wager(game, actor, p.target!));
  }
  private wager(game: Game, actor: SeatId, target: SeatId): void {
    const flipped = game.draw(2);
    for (const c of flipped) game.discardCard(c);
    if (flipped.length < 2) return;
    const [mine, theirs] = flipped;
    game.emit({ type: 'wager', seat: actor, target, cards: [mine.toView(), theirs.toView()] });
    if (mine.rank === theirs.rank) return;
    const [winner, loser] = mine.rank > theirs.rank ? [actor, target] : [target, actor];
    const hand = game.seats[loser].hand;
    if (hand.length === 0) return;
    const card = hand.splice(game.rng.int(hand.length), 1)[0];
    game.seats[winner].hand.push(card);
    const involved = [winner, loser];
    const others = game.seats.map((s) => s.seat).filter((s) => !involved.includes(s));
    game.emit({ type: 'steal', from: loser, to: winner, card: null, visibleTo: others });
    game.emit({ type: 'steal', from: loser, to: winner, card: card.toView(), visibleTo: involved });
  }
}

/** 불붙은 배: 사거리 안 1명과 그 양옆(나 제외)을 공격 */
export class FireShip extends ActionCard {
  validate(game: Game, actor: SeatId, p: PlayParams): string | null {
    const err = checkOtherTarget(game, actor, p);
    if (err) return err;
    if (distance(game, actor, p.target!) > weaponRange(game, actor)) return '사거리 밖이에요';
    return null;
  }
  play(game: Game, actor: SeatId, p: PlayParams): void {
    const target = p.target!;
    const alive = game.aliveSeats();
    const i = alive.indexOf(target);
    const left = alive[(i - 1 + alive.length) % alive.length];
    const right = alive[(i + 1) % alive.length];
    const victims = [...new Set([target, right, left])].filter((s) => s !== actor);
    for (const v of [...victims].reverse()) game.pushStep(() => game.seats[v].alive && game.attack(v, actor, 'fireShip'));
  }
}

/** 널빤지 걷기: 손패가 가장 많은 사람(들)이 2장을 골라 버린다 */
export class WalkPlank extends ActionCard {
  validate(): string | null {
    return null;
  }
  play(game: Game, actor: SeatId): void {
    const order = [actor, ...game.othersFrom(actor)];
    const most = Math.max(...order.map((s) => game.seats[s].hand.length));
    if (most === 0) return;
    const victims = order.filter((s) => game.seats[s].hand.length === most);
    for (const s of [...victims].reverse()) game.pushStep(() => game.forceDiscard(s, Math.min(2, game.seats[s].hand.length)));
  }
}

export class LeatherCoat extends EquipmentCard {}
export class Compass extends EquipmentCard {}
export class LuckyCoin extends EquipmentCard {}
export class BlackFlag extends EquipmentCard {}

/** 작살: 칼질로 피해를 주면 상대 손패 1장(무작위)도 버리게 한다 */
export class Harpoon extends WeaponCard {
  readonly range = 2;
  onSlashHit(game: Game, _attacker: SeatId, victim: SeatId): void {
    const v = game.seats[victim];
    if (!v.alive || v.hand.length === 0) return;
    const card: Card = v.hand.splice(game.rng.int(v.hand.length), 1)[0];
    game.discardCard(card);
    game.emit({ type: 'discardCards', seat: victim, cards: [card.toView()] });
  }
}

registerCard('parrotTattle', ParrotTattle);
registerCard('treasureMap', TreasureMap);
registerCard('diceWager', DiceWager);
registerCard('fireShip', FireShip);
registerCard('walkPlank', WalkPlank);
registerCard('leatherCoat', LeatherCoat);
registerCard('harpoon', Harpoon);
registerCard('compass', Compass);
registerCard('luckyCoin', LuckyCoin);
registerCard('blackFlag', BlackFlag);
