import type { CardId, CharacterId, SeatId } from '../types';
import type { Game } from '../Game';

export abstract class Character {
  abstract readonly id: CharacterId;
  abstract readonly name: string;
  abstract readonly maxHp: number;
  abstract readonly text: string;
  rumHeal(): number {
    return 1;
  }
  handLimitBonus(): number {
    return 0;
  }
  distanceBonusAgainstMe(_game: Game, _me: SeatId): number {
    return 0;
  }
  judgeFlipCount(): 1 | 2 {
    return 1;
  }
  duelSlashesRequiredFromOpponent(): number {
    return 1;
  }
  canUseAbility(_game: Game, _me: SeatId, _cardIds: CardId[]): string | null {
    return '쓸 수 있는 능력이 없어요';
  }
  useAbility(_game: Game, _me: SeatId, _cardIds: CardId[]): void {}
  /** 마고: 뽑기 직전 */
  onTurnStartBeforeDraw(_game: Game, _me: SeatId): void {}
  /** 루 */
  offersDiscardDraw(): boolean {
    return false;
  }
  /** 니코: 칼질 카드로 피해를 준 직후 */
  onSlashDamageDealt(_game: Game, _me: SeatId, _victim: SeatId): void {}
  /** 비비 */
  passesKegFreely(): boolean {
    return false;
  }
}
