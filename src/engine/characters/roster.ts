import type { AttackSource, CharacterId, SeatId } from '../types';
import type { Game } from '../Game';
import { Character, type AbilityParams } from './Character';

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
  canUseAbility(game: Game, me: SeatId, { cardIds }: AbilityParams): string | null {
    if (game.abilityUsedThisTurn) return '능력은 한 턴에 한 번만 쓸 수 있어요';
    const cards = game.cardsInHand(me, cardIds, 'slash');
    if (!cards || cards.length !== 2) return '칼질 2장을 골라 주세요';
    return null;
  }
  useAbility(game: Game, me: SeatId, { cardIds }: AbilityParams): void {
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

// ───────────── 추가 캐릭터 ─────────────

const ONCE = '능력은 한 턴에 한 번만 쓸 수 있어요';

class Dorothy extends Character {
  readonly id = 'dorothy';
  readonly name = '선의 도로시';
  readonly maxHp = 3;
  readonly text = '내 턴에 1번, 럼주 1장을 내서 다른 사람의 체력 1을 회복시켜요.';
  canUseAbility(game: Game, me: SeatId, a: AbilityParams): string | null {
    if (game.abilityUsedThisTurn) return ONCE;
    const cards = game.cardsInHand(me, a.cardIds, 'rum');
    if (!cards || cards.length !== 1) return '럼주 1장을 골라 주세요';
    const t = a.target === undefined ? undefined : game.seats[a.target];
    if (!t || !t.alive || a.target === me) return '회복시킬 다른 사람을 골라 주세요';
    if (t.hp >= t.maxHp) return '그 사람은 이미 체력이 가득해요';
    if (game.aliveSeats().length <= 2) return '두 명만 남으면 럼주를 쓸 수 없어요';
    if (game.modifiers.some((m) => m.rumOnlyWhenDying)) return '보급 부족: 럼주는 쓰러질 때만 쓸 수 있어요';
    return null;
  }
  useAbility(game: Game, me: SeatId, a: AbilityParams): void {
    game.abilityUsedThisTurn = true;
    const rum = game.removeFromHand(me, a.cardIds[0])!;
    game.discardCard(rum);
    game.emit({ type: 'play', seat: me, card: rum.toView(), target: a.target });
    game.heal(a.target!, 1);
  }
}

class Ori extends Character {
  readonly id = 'ori';
  readonly name = '점쟁이 오르';
  readonly maxHp = 3;
  readonly text = '내 턴 시작 시 덱 맨 위 카드를 보고, 그대로 두거나 맨 밑으로 보내요.';
  onTurnStartBeforeDraw(game: Game, me: SeatId): void {
    const top = game.peekTop();
    if (!top) return;
    game.pushInput({ kind: 'fortune', seat: me, card: top.toView() }, (a) => {
      if (a.type !== 'fortune') return '덱 맨 위 카드를 둘지 보낼지 골라 주세요';
      if (a.toBottom) game.deck.unshift(game.deck.pop()!);
      game.emit({ type: 'ability', seat: me, character: 'ori' });
      return null;
    });
  }
}

class Felix extends Character {
  readonly id = 'felix';
  readonly name = '냄비투구 펠릭스';
  readonly maxHp = 4;
  readonly text = '포격과 불붙은 배를 자동으로 피해요.';
  autoDodges(source: AttackSource): boolean {
    return source === 'cannonade' || source === 'fireShip';
  }
}

class Tara extends Character {
  readonly id = 'tara';
  readonly name = '돛잡이 타라';
  readonly maxHp = 4;
  readonly text = '칼질을 한 번도 쓰지 않은 턴이면, 턴을 마칠 때 카드 1장을 받아요.';
  drawsOnQuietTurn(): boolean {
    return true;
  }
}

class Luca extends Character {
  readonly id = 'luca';
  readonly name = '노름꾼 루카';
  readonly maxHp = 4;
  readonly text = '내 판정에서 ♣이 나오면 카드 1장을 받아요.';
  drawsOnClubJudge(): boolean {
    return true;
  }
}

class Gordon extends Character {
  readonly id = 'gordon';
  readonly name = '밧줄꾼 고든';
  readonly maxHp = 4;
  readonly text = '소매치기·밧줄 자르기·주사위 내기의 대상이 되면 판정: ♥·♦이면 무효로 해요.';
  resistsTakes(): boolean {
    return true;
  }
}

class Kiki extends Character {
  readonly id = 'kiki';
  readonly name = '원숭이 조련사 키키';
  readonly maxHp = 3;
  readonly text = '내 턴에 1번, 손패 1장을 버리고 아무나 1명의 장비 1장을 버리게 해요.';
  canUseAbility(game: Game, me: SeatId, a: AbilityParams): string | null {
    if (game.abilityUsedThisTurn) return ONCE;
    const cards = game.cardsInHand(me, a.cardIds);
    if (!cards || cards.length !== 1) return '버릴 손패 1장을 골라 주세요';
    const t = a.target === undefined ? undefined : game.seats[a.target];
    if (!t || !t.alive) return '장비를 버리게 할 사람을 골라 주세요';
    if (!t.equipment.some((c) => c.id === a.targetCardId)) return '그 사람의 장비 중에서 골라 주세요';
    return null;
  }
  useAbility(game: Game, me: SeatId, a: AbilityParams): void {
    game.abilityUsedThisTurn = true;
    const mine = game.removeFromHand(me, a.cardIds[0])!;
    const gear = game.removeEquipment(a.target!, a.targetCardId!)!;
    game.discardCard(mine);
    game.discardCard(gear);
    game.emit({ type: 'discardCards', seat: me, cards: [mine.toView()] });
    game.emit({ type: 'discardCards', seat: a.target!, cards: [gear.toView()] });
  }
}

class Morgan extends Character {
  readonly id = 'morgan';
  readonly name = '상어 사냥꾼 모건';
  readonly maxHp = 4;
  readonly text = '체력이 2 이하이면 칼질을 한 턴에 2번까지 써요.';
  minSlashes(game: Game, me: SeatId): number {
    return game.seats[me].hp <= 2 ? 2 : 0;
  }
}

class Bartol extends Character {
  readonly id = 'bartol';
  readonly name = '덩치 바르톨';
  readonly maxHp = 5;
  readonly text = '덩치가 커서 남이 나를 볼 때 거리 -1.';
  distanceBonusAgainstMe(): number {
    return -1;
  }
}

class Pip extends Character {
  readonly id = 'pip';
  readonly name = '견습생 핍';
  readonly maxHp = 2;
  readonly text = '칼질·포격을 받을 때 판정: ♥이면 피해요. 피해를 받을 때마다 카드 2장을 받아요.';
  hasInnateBarrel(): boolean {
    return true;
  }
  drawOnDamage(): number {
    return 2;
  }
}

class Jack extends Character {
  readonly id = 'jack';
  readonly name = '쌍칼 잭';
  readonly maxHp = 4;
  readonly text = '칼질을 한 턴에 몇 번이든 써요.';
  minSlashes(): number {
    return Infinity;
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
  dorothy: new Dorothy(),
  ori: new Ori(),
  felix: new Felix(),
  tara: new Tara(),
  luca: new Luca(),
  gordon: new Gordon(),
  kiki: new Kiki(),
  morgan: new Morgan(),
  bartol: new Bartol(),
  pip: new Pip(),
  jack: new Jack(),
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
