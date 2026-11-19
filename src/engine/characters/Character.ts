import type { CharacterId, SeatId } from '../types';
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
}
