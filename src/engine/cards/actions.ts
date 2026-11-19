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
    const s = game.seats[actor];
    if (s.hp >= s.maxHp) return '이미 체력이 가득해요';
    return null;
  }
  play(game: Game, actor: SeatId): void {
    game.heal(actor, game.seats[actor].character.rumHeal());
  }
}

registerCard('slash', Slash);
registerCard('dodge', Dodge);
registerCard('rum', Rum);
