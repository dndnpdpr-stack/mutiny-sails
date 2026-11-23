import type { CardId, CardKind, CardView, Rank, SeatId, Suit } from '../types';
import { CARD_CATALOG, type CardInfo } from './catalog';
import type { Game } from '../Game';

/** targetCardId 없음 = 대상 손패에서 무작위 */
export interface PlayParams {
  target?: SeatId;
  targetCardId?: CardId;
}

export abstract class Card {
  constructor(
    readonly id: CardId,
    readonly kind: CardKind,
    readonly suit: Suit,
    readonly rank: Rank,
  ) {}
  get info(): CardInfo {
    return CARD_CATALOG[this.kind];
  }
  toView(): CardView {
    return { id: this.id, kind: this.kind, suit: this.suit, rank: this.rank };
  }
}

export abstract class ActionCard extends Card {
  /** null = 사용 가능, 문자열 = 거부 사유 */
  abstract validate(game: Game, actor: SeatId, p: PlayParams): string | null;
  abstract play(game: Game, actor: SeatId, p: PlayParams): void;
}

export abstract class EquipmentCard extends Card {
  placement(): 'self' | 'other' {
    return 'self';
  }
  validate(game: Game, actor: SeatId, _p: PlayParams): string | null {
    if (game.seats[actor].equipment.some((c) => c.kind === this.kind)) return `이미 ${this.info.name}을(를) 장착하고 있어요`;
    return null;
  }
  onEquip(_game: Game, _owner: SeatId): void {}
}

export abstract class WeaponCard extends EquipmentCard {
  abstract readonly range: number;
  readonly unlimitedSlash: boolean = false;
  /** 이 무기로 낸 칼질이 피해를 줬을 때 */
  onSlashHit(_game: Game, _attacker: SeatId, _victim: SeatId): void {}
  /** 무기는 교체 가능 */
  validate(): string | null {
    return null;
  }
}

type CardCtor = new (id: CardId, kind: CardKind, suit: Suit, rank: Rank) => Card;
const registry = new Map<CardKind, CardCtor>();

export function registerCard(kind: CardKind, ctor: CardCtor): void {
  registry.set(kind, ctor);
}

export function createCard(spec: CardView): Card {
  const ctor = registry.get(spec.kind) ?? PlaceholderCard;
  return new ctor(spec.id, spec.kind, spec.suit, spec.rank);
}

/** 아직 규칙이 구현되지 않은 카드 (구현 도중에만 쓰임) */
class PlaceholderCard extends ActionCard {
  validate(): string | null {
    return '아직 쓸 수 없는 카드예요';
  }
  play(): void {}
}
