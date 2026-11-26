import type { AttackSource, CardId, CharacterId, SeatId } from '../types';
import type { Game } from '../Game';

export interface AbilityParams {
  cardIds: CardId[];
  target?: SeatId;
  targetCardId?: CardId;
}

export abstract class Character {
  abstract readonly id: CharacterId;
  abstract readonly name: string;
  abstract readonly maxHp: number;
  abstract readonly text: string;
  rumHeal(): number {
    return 1;
  }
  /** 럼주로 회복할 수 있는 상한 (럼보는 최대 체력을 넘어 마신다) */
  rumCap(maxHp: number): number {
    return maxHp;
  }
  /** 럼보: 처음 받는 손패 추가 장수 */
  openingHandBonus(): number {
    return 0;
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
  canUseAbility(_game: Game, _me: SeatId, _a: AbilityParams): string | null {
    return '쓸 수 있는 능력이 없어요';
  }
  useAbility(_game: Game, _me: SeatId, _a: AbilityParams): void {}
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
  /** 펠릭스: 이 공격은 판정 없이 피한다 */
  autoDodges(_source: AttackSource): boolean {
    return false;
  }
  /** 타라: 칼질을 안 쓴 턴이면 턴 끝에 1장 */
  drawsOnQuietTurn(): boolean {
    return false;
  }
  /** 루카: 내 판정에서 ♣이면 1장 */
  drawsOnClubJudge(): boolean {
    return false;
  }
  /** 고든: 손패·장비를 뺏기거나 버리게 하는 카드의 대상이 되면 판정 */
  resistsTakes(): boolean {
    return false;
  }
  /** 핍: 나무통을 몸에 단 것처럼 칼질·포격을 받을 때 먼저 판정 */
  hasInnateBarrel(): boolean {
    return false;
  }
  /** 핍: 피해를 1번 받을 때마다 뽑는 카드 수 */
  drawOnDamage(): number {
    return 0;
  }
  /** 모건·잭: 한 턴 칼질 횟수의 최소값 */
  minSlashes(_game: Game, _me: SeatId): number {
    return 0;
  }
}
