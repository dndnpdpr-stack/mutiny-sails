import type { CharacterId, SeatId } from '../types';
import type { Game } from '../Game';
import { Character } from './Character';

class Tom extends Character {
  readonly id = 'tom';
  readonly name = '요리사 톰';
  readonly maxHp = 4;
  readonly text = '럼주로 체력 2를 회복해요.';
}
class Margo extends Character {
  readonly id = 'margo';
  readonly name = '앵무새 주인 마고';
  readonly maxHp = 3;
  readonly text = '내 턴 시작 시 다른 1명의 손패 중 무작위 1장을 몰래 봐요.';
}
class Lou extends Character {
  readonly id = 'lou';
  readonly name = '밀수꾼 루';
  readonly maxHp = 4;
  readonly text = '뽑기 단계의 첫 장을 버린 카드 더미 맨 위에서 가져올 수 있어요.';
}
class Derrick extends Character {
  readonly id = 'derrick';
  readonly name = '포수 데릭';
  readonly maxHp = 4;
  readonly text = '칼질 2장을 함께 버려 포격 효과를 낼 수 있어요. (턴당 1번)';
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
}
class Bibi extends Character {
  readonly id = 'bibi';
  readonly name = '화약 담당 비비';
  readonly maxHp = 4;
  readonly text = '화약통 판정 대상이 되면, 판정 없이 아무에게나 넘길 수 있어요.';
}
class Bruno extends Character {
  readonly id = 'bruno';
  readonly name = '고집쟁이 브루노';
  readonly maxHp = 4;
  readonly text = '결투에서 상대는 매번 칼질을 2장씩 내야 해요.';
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
