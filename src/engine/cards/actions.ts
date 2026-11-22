import type { SeatId } from '../types';
import type { Game } from '../Game';
import { ActionCard, registerCard, type PlayParams } from './Card';
import { distance, slashLimit, weaponRange } from '../rules';

/** 다른 살아있는 대상이 지정됐는지 검사 */
export function checkOtherTarget(game: Game, actor: SeatId, p: PlayParams): string | null {
  if (p.target === undefined) return '대상을 골라 주세요';
  const t = game.seats[p.target];
  if (!t || !t.alive || p.target === actor) return '고를 수 없는 대상이에요';
  return null;
}

export class Slash extends ActionCard {
  validate(game: Game, actor: SeatId, p: PlayParams): string | null {
    const err = checkOtherTarget(game, actor, p);
    if (err) return err;
    if (game.slashesPlayedThisTurn >= slashLimit(game, actor)) return '칼질은 한 턴에 한 번만 쓸 수 있어요';
    if (distance(game, actor, p.target!) > weaponRange(game, actor)) return '사거리 밖이에요';
    return null;
  }
  play(game: Game, actor: SeatId, p: PlayParams): void {
    game.slashesPlayedThisTurn++;
    game.slashAttack(p.target!, actor);
  }
}

export class Dodge extends ActionCard {
  validate(): string | null {
    return '피하기는 공격을 받았을 때만 낼 수 있어요';
  }
  play(): void {}
}

export class Rum extends ActionCard {
  validate(game: Game, actor: SeatId): string | null {
    if (game.aliveSeats().length <= 2) return '두 명만 남으면 럼주를 쓸 수 없어요';
    if (game.modifiers.some((m) => m.rumOnlyWhenDying)) return '보급 부족: 럼주는 쓰러질 때만 쓸 수 있어요';
    const s = game.seats[actor];
    if (s.hp >= s.maxHp) return '이미 체력이 가득해요';
    return null;
  }
  play(game: Game, actor: SeatId): void {
    game.heal(actor, game.seats[actor].character.rumHeal());
  }
}

export class Cannonade extends ActionCard {
  validate(): string | null {
    return null;
  }
  play(game: Game, actor: SeatId): void {
    game.cannonade(actor);
  }
}

export class Brawl extends ActionCard {
  validate(): string | null {
    return null;
  }
  play(game: Game, actor: SeatId): void {
    for (const t of [...game.othersFrom(actor)].reverse()) {
      game.pushStep(() =>
        game.pushCardResponse({ kind: 'respondBrawl', seat: t, attacker: actor }, 'slash', 1, () => {}, () => game.dealDamage(t, 1, actor)),
      );
    }
  }
}

export class Duel extends ActionCard {
  validate(game: Game, actor: SeatId, p: PlayParams): string | null {
    return checkOtherTarget(game, actor, p);
  }
  play(game: Game, actor: SeatId, p: PlayParams): void {
    game.duelTurn(p.target!, actor);
  }
}

/** 대상 손패(무작위) 또는 지정한 장비 1장을 대상에게서 떼어낸다 */
function validateTakeTarget(game: Game, actor: SeatId, p: PlayParams): string | null {
  const err = checkOtherTarget(game, actor, p);
  if (err) return err;
  const t = game.seats[p.target!];
  if (p.targetCardId !== undefined) {
    if (!t.equipment.some((c) => c.id === p.targetCardId)) return '그 장비는 대상에게 없어요';
  } else if (t.hand.length === 0) {
    return t.equipment.length ? '가져올 장비를 골라 주세요' : '대상에게 카드가 없어요';
  }
  return null;
}

function takeFrom(game: Game, p: PlayParams) {
  const t = p.target!;
  if (p.targetCardId !== undefined) return { card: game.removeEquipment(t, p.targetCardId)!, fromHand: false };
  const hand = game.seats[t].hand;
  return { card: hand.splice(game.rng.int(hand.length), 1)[0], fromHand: true };
}

export class Pickpocket extends ActionCard {
  validate(game: Game, actor: SeatId, p: PlayParams): string | null {
    const err = validateTakeTarget(game, actor, p);
    if (err) return err;
    if (distance(game, actor, p.target!) > 1) return '거리 1인 상대에게만 쓸 수 있어요';
    return null;
  }
  play(game: Game, actor: SeatId, p: PlayParams): void {
    const { card, fromHand } = takeFrom(game, p);
    game.seats[actor].hand.push(card);
    if (fromHand) {
      const involved = [actor, p.target!];
      const others = game.seats.map((s) => s.seat).filter((s) => !involved.includes(s));
      game.emit({ type: 'steal', from: p.target!, to: actor, card: null, visibleTo: others });
      game.emit({ type: 'steal', from: p.target!, to: actor, card: card.toView(), visibleTo: involved });
    } else {
      game.emit({ type: 'steal', from: p.target!, to: actor, card: card.toView() });
    }
  }
}

export class CutRope extends ActionCard {
  validate(game: Game, actor: SeatId, p: PlayParams): string | null {
    return validateTakeTarget(game, actor, p);
  }
  play(game: Game, _actor: SeatId, p: PlayParams): void {
    const { card } = takeFrom(game, p);
    game.discardCard(card);
    game.emit({ type: 'discardCards', seat: p.target!, cards: [card.toView()] });
  }
}

abstract class DrawCard extends ActionCard {
  abstract readonly amount: number;
  validate(): string | null {
    return null;
  }
  play(game: Game, actor: SeatId): void {
    game.giveCards(actor, game.draw(this.amount));
  }
}
export class SupplyShip extends DrawCard {
  readonly amount = 2;
}
export class MerchantRaid extends DrawCard {
  readonly amount = 3;
}

export class Feast extends ActionCard {
  validate(): string | null {
    return null;
  }
  play(game: Game): void {
    for (const s of game.aliveSeats()) game.heal(s, 1);
  }
}

export class Loot extends ActionCard {
  validate(): string | null {
    return null;
  }
  play(game: Game, actor: SeatId): void {
    const order = [actor, ...game.othersFrom(actor)];
    const revealed = game.draw(order.length);
    game.lootPick(order, revealed);
  }
}

registerCard('cannonade', Cannonade);
registerCard('brawl', Brawl);
registerCard('duel', Duel);
registerCard('pickpocket', Pickpocket);
registerCard('cutRope', CutRope);
registerCard('supplyShip', SupplyShip);
registerCard('merchantRaid', MerchantRaid);
registerCard('feast', Feast);
registerCard('loot', Loot);
registerCard('slash', Slash);
registerCard('dodge', Dodge);
registerCard('rum', Rum);
