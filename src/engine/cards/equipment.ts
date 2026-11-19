import type { SeatId } from '../types';
import type { Game } from '../Game';
import { EquipmentCard, WeaponCard, registerCard, type PlayParams } from './Card';

export class Pistol extends WeaponCard {
  readonly range = 2;
}
export class Musket extends WeaponCard {
  readonly range = 3;
}
export class LongMusket extends WeaponCard {
  readonly range = 4;
}
export class DeckCannon extends WeaponCard {
  readonly range = 5;
}
export class TwinPistols extends WeaponCard {
  readonly range = 1;
  readonly unlimitedSlash = true;
}
export class Spyglass extends EquipmentCard {}
export class Dinghy extends EquipmentCard {}
/** 효과는 Game.attack에서 처리 */
export class Barrel extends EquipmentCard {}
/** 효과는 Game의 턴 시작 처리에서 */
export class PowderKeg extends EquipmentCard {}

export class Brig extends EquipmentCard {
  placement(): 'self' | 'other' {
    return 'other';
  }
  validate(game: Game, actor: SeatId, p: PlayParams): string | null {
    if (p.target === undefined) return '대상을 골라 주세요';
    const t = game.seats[p.target];
    if (!t || !t.alive || p.target === actor) return '고를 수 없는 대상이에요';
    if (t.role === 'captain') return '선장은 영창에 가둘 수 없어요';
    if (t.equipment.some((c) => c.kind === 'brig')) return '이미 영창에 갇혀 있어요';
    return null;
  }
}

registerCard('pistol', Pistol);
registerCard('musket', Musket);
registerCard('longMusket', LongMusket);
registerCard('deckCannon', DeckCannon);
registerCard('twinPistols', TwinPistols);
registerCard('spyglass', Spyglass);
registerCard('dinghy', Dinghy);
registerCard('barrel', Barrel);
registerCard('powderKeg', PowderKeg);
registerCard('brig', Brig);
