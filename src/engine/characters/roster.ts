import type { CardId, CharacterId, SeatId } from '../types';
import type { Game } from '../Game';
import { Character } from './Character';

class Tom extends Character {
  readonly id = 'tom';
  readonly name = '요리사 톰';
  readonly maxHp = 4;
  readonly text = '럼주로 체력 2를 회복해요.';
  rumHeal(): number {
    return 2;
  }
}
class Margo extends Character {
  readonly id = 'margo';
  readonly name = '앵무새 주인 마고';
  readonly maxHp = 3;
  readonly text = '내 턴 시작 시 다른 1명의 손패 중 무작위 1장을 몰래 봐요.';
  onTurnStartBeforeDraw(game: Game, me: SeatId): void {
    const candidates = game.othersFrom(me).filter((s) => game.seats[s].hand.length > 0);
    if (candidates.length === 0) return;
    game.pushInput({ kind: 'peekTarget', seat: me }, (a) => {
      if (a.type !== 'chooseSeat' || !candidates.includes(a.target)) return '손패가 있는 다른 사람을 골라 주세요';
      const hand = game.seats[a.target].hand;
      const card = hand[game.rng.int(hand.length)];
      game.emit({ type: 'peek', seat: me, target: a.target, card: card.toView(), visibleTo: [me] });
      return null;
    });
  }
}
class Lou extends Character {
  readonly id = 'lou';
  readonly name = '밀수꾼 루';
  readonly maxHp = 4;
  readonly text = '뽑기 단계의 첫 장을 버린 카드 더미 맨 위에서 가져올 수 있어요.';
  offersDiscardDraw(): boolean {
    return true;
  }
}
class Derrick extends Character {
  readonly id = 'derrick';
  readonly name = '포수 데릭';
  readonly maxHp = 4;
  readonly text = '칼질 2장을 함께 버려 포격 효과를 낼 수 있어요. (턴당 1번)';
  canUseAbility(game: Game, me: SeatId, cardIds: CardId[]): string | null {
    if (game.abilityUsedThisTurn) return '능력은 한 턴에 한 번만 쓸 수 있어요';
    const cards = game.cardsInHand(me, cardIds, 'slash');
    if (!cards || cards.length !== 2) return '칼질 2장을 골라 주세요';
    return null;
  }
  useAbility(game: Game, me: SeatId, cardIds: CardId[]): void {
    game.abilityUsedThisTurn = true;
    for (const id of cardIds) game.discardCard(game.removeFromHand(me, id)!);
    game.cannonade(me);
  }
}
class Orso extends Character {
  readonly id = 'orso';
  readonly name = '갑판장 오르소';
  readonly maxHp = 5;
  readonly text = '손패 한도가 체력 +2예요.';
  handLimitBonus(): number {
    return 2;
  }
}
class Nico extends Character {
  readonly id = 'nico';
  readonly name = '손버릇 나쁜 니코';
  readonly maxHp = 3;
  readonly text = '칼질로 피해를 주면 그 사람의 손패 1장을 무작위로 가져와요.';
  onSlashDamageDealt(game: Game, me: SeatId, victim: SeatId): void {
    const v = game.seats[victim];
    if (!v.alive || v.hand.length === 0 || !game.seats[me].alive) return;
    const card = v.hand.splice(game.rng.int(v.hand.length), 1)[0];
    game.seats[me].hand.push(card);
    const involved = [me, victim];
    game.emit({ type: 'ability', seat: me, character: 'nico' });
    game.emit({ type: 'steal', from: victim, to: me, card: null, visibleTo: game.seats.map((s) => s.seat).filter((s) => !involved.includes(s)) });
    game.emit({ type: 'steal', from: victim, to: me, card: card.toView(), visibleTo: involved });
  }
}
class Hanna extends Character {
  readonly id = 'hanna';
  readonly name = '닻지기 한나';
  readonly maxHp = 4;
  readonly text = '내 앞에 카드가 3장 이상이면 남이 나를 볼 때 거리 +1.';
  distanceBonusAgainstMe(game: Game, me: SeatId): number {
    return game.seats[me].equipment.length >= 3 ? 1 : 0;
  }
}
class Sila extends Character {
  readonly id = 'sila';
  readonly name = '노련한 항해사 실라';
  readonly maxHp = 3;
  readonly text = '판정할 때 2장을 뒤집고 하나를 골라요.';
  judgeFlipCount(): 1 | 2 {
    return 2;
  }
}
class Bibi extends Character {
  readonly id = 'bibi';
  readonly name = '화약 담당 비비';
  readonly maxHp = 4;
  readonly text = '화약통 판정 대상이 되면, 판정 없이 아무에게나 넘길 수 있어요.';
  passesKegFreely(): boolean {
    return true;
  }
}
class Bruno extends Character {
  readonly id = 'bruno';
  readonly name = '고집쟁이 브루노';
  readonly maxHp = 4;
  readonly text = '결투에서 상대는 매번 칼질을 2장씩 내야 해요.';
  duelSlashesRequiredFromOpponent(): number {
    return 2;
  }
}

export const CHARACTERS: Record<CharacterId, Character> = {
  tom: new Tom(),
  margo: new Margo(),
  lou: new Lou(),
  derrick: new Derrick(),
  orso: new Orso(),
  nico: new Nico(),
  hanna: new Hanna(),
  sila: new Sila(),
  bibi: new Bibi(),
  bruno: new Bruno(),
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

export interface CharacterInfo {
  name: string;
  maxHp: number;
  text: string;
}

export const CHARACTER_INFO = Object.fromEntries(
  CHARACTER_IDS.map((id) => [id, { name: CHARACTERS[id].name, maxHp: CHARACTERS[id].maxHp, text: CHARACTERS[id].text }]),
) as Record<CharacterId, CharacterInfo>;
