import type { GameEvent, Role, SeatId, Winner } from '../engine/types';
import { CARD_CATALOG } from '../engine/cards/catalog';
import { CHARACTER_INFO } from '../engine/characters/roster';

const ROLE_NAMES: Record<Role, string> = { captain: '선장', loyalist: '충성 선원', rebel: '반란 선원', spy: '첩자' };

export function roleName(r: Role): string {
  return ROLE_NAMES[r];
}

export function winnerText(w: Winner): string {
  switch (w) {
    case 'captainTeam':
      return '선장과 충성 선원의 승리!';
    case 'rebels':
      return '반란 선원의 승리!';
    case 'spy':
      return '첩자의 승리!';
  }
}

export const cardName = (kind: keyof typeof CARD_CATALOG): string => CARD_CATALOG[kind].name;

export function formatEvent(e: GameEvent, names: (s: SeatId) => string): string {
  const cards = (list: { kind: keyof typeof CARD_CATALOG }[]) => list.map((c) => cardName(c.kind)).join(', ');
  switch (e.type) {
    case 'turnStart':
      return `${names(e.seat)}의 턴이에요.`;
    case 'draw':
      return `${names(e.seat)}이(가) 카드 ${e.count}장을 뽑았어요.`;
    case 'drawCards':
      return `${names(e.seat)}이(가) ${cards(e.cards)}을(를) 뽑았어요.`;
    case 'play':
      return e.target === undefined
        ? `${names(e.seat)}이(가) ${cardName(e.card.kind)}을(를) 냈어요.`
        : `${names(e.seat)}이(가) ${names(e.target)}에게 ${cardName(e.card.kind)}을(를) 냈어요.`;
    case 'respond':
      return e.cards.length
        ? `${names(e.seat)}이(가) ${cards(e.cards)}을(를) 냈어요.`
        : `${names(e.seat)}이(가) 아무것도 내지 않았어요.`;
    case 'damage':
      return `${names(e.seat)}이(가) 체력 ${e.amount}을(를) 잃었어요.`;
    case 'heal':
      return `${names(e.seat)}이(가) 체력 ${e.amount}을(를) 회복했어요.`;
    case 'judge':
      return `${names(e.seat)}의 ${cardName(e.reason)} 판정: ${e.success ? '성공' : '실패'}`;
    case 'steal':
      return e.card
        ? `${names(e.to)}이(가) ${names(e.from)}의 ${cardName(e.card.kind)}을(를) 가져갔어요.`
        : `${names(e.to)}이(가) ${names(e.from)}의 손패 1장을 가져갔어요.`;
    case 'discardCards':
      return `${names(e.seat)}이(가) ${cards(e.cards)}을(를) 버렸어요.`;
    case 'peek':
      return `${names(e.target)}의 손패에서 ${cardName(e.card.kind)}을(를) 엿봤어요.`;
    case 'death':
      return `${names(e.seat)}이(가) 쓰러졌어요. (${roleName(e.role)})`;
    case 'ability':
      return `${names(e.seat)}이(가) ${CHARACTER_INFO[e.character].name}의 능력을 썼어요.`;
    case 'characterChosen':
      return `${names(e.seat)}이(가) ${CHARACTER_INFO[e.character].name}을(를) 골랐어요.`;
    case 'roleDrawn':
      return e.role ? `${names(e.seat)}이(가) ${roleName(e.role)} 카드를 뽑았어요.` : `${names(e.seat)}이(가) 역할 카드를 뽑았어요.`;
    case 'gameOver':
      return winnerText(e.winner);
  }
}
