import type { Action, PendingView } from './types';
import type { Game } from './Game';

/** 시간 초과 등으로 사람이 고르지 않았을 때 대신 넣는 행동 */
export function defaultActionFor(game: Game, p: PendingView): Action {
  switch (p.kind) {
    case 'turn':
      return { type: 'endTurn' };
    case 'respondAttack':
    case 'respondBrawl':
    case 'respondDuel':
    case 'dying':
      return { type: 'respond', cardIds: [] };
    case 'discardExcess': {
      const hand = [...game.seats[p.seat].hand];
      const picked: string[] = [];
      for (let i = 0; i < p.count; i++) picked.push(hand.splice(game.rng.int(hand.length), 1)[0].id);
      return { type: 'discard', cardIds: picked };
    }
    case 'loot':
    case 'judgeChoice':
      return { type: 'chooseCard', cardId: (p.kind === 'loot' ? p.revealed : p.options)[0].id };
    case 'peekTarget': {
      const others = game.othersFrom(p.seat);
      return { type: 'chooseSeat', target: others.find((s) => game.seats[s].hand.length > 0) ?? others[0] };
    }
    case 'passKeg':
      return { type: 'chooseSeat', target: game.nextAlive(p.seat) };
    case 'drawRole':
      return { type: 'drawRole', slot: p.slots[0] };
    case 'drawSource':
      return { type: 'chooseDrawSource', fromDiscard: false };
    case 'chooseCharacter':
      return { type: 'chooseCharacter', character: p.options[0] };
  }
}
