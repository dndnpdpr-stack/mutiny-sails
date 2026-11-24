import type { GameEvent, JudgeReason, Role, SeatId, Special, Winner } from '../engine/types';
import { CARD_CATALOG } from '../engine/cards/catalog';
import { rankLabel } from './table/Card';
import { CHARACTER_INFO } from '../engine/characters/roster';
import { SEA_EVENTS, type SeaEventId } from '../engine/seaEvents';
import { judgeNeed, judgeRule } from './judgeRule';

const ROLE_NAMES: Record<Role, string> = { captain: '선장', loyalist: '충성 선원', rebel: '반란 선원', spy: '첩자', hunter: '현상금 사냥꾼' };
const SPECIAL_NAMES: Record<Special, string> = { navigator: '항해사', doubleAgent: '이중 첩자' };

export function roleName(r: Role): string {
  return ROLE_NAMES[r];
}

/** 항해사·이중 첩자면 그 이름, 아니면 역할 이름 */
export function roleLabel(r: Role, special?: Special | null): string {
  return special ? SPECIAL_NAMES[special] : ROLE_NAMES[r];
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

function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}
/** 받침이 있으면 '이에요', 없으면 '예요' */
const ieyo = (word: string) => (hasBatchim(word) ? '이에요' : '예요');

export const cardName = (kind: keyof typeof CARD_CATALOG): string => CARD_CATALOG[kind].name;

export const judgeReasonName = (r: JudgeReason): string => (r === 'seaMonster' ? '바다 괴물' : cardName(r));

export const seaEventTitle = (id: SeaEventId): string => `${SEA_EVENTS[id].icon} ${SEA_EVENTS[id].name}`;

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
      return `${names(e.seat)}의 ${judgeReasonName(e.reason)} 판정(${judgeNeed(e.reason)}): ${judgeRule(e.reason, e.success).result}`;
    case 'steal':
      return e.card
        ? `${names(e.to)}이(가) ${names(e.from)}의 ${cardName(e.card.kind)}을(를) 가져갔어요.`
        : `${names(e.to)}이(가) ${names(e.from)}의 손패 1장을 가져갔어요.`;
    case 'discardCards':
      return `${names(e.seat)}이(가) ${cards(e.cards)}을(를) 버렸어요.`;
    case 'peek':
      return `${names(e.target)}의 손패에서 ${cardName(e.card.kind)}을(를) 엿봤어요.`;
    case 'death':
      return `${names(e.seat)}이(가) 쓰러졌어요. (${roleLabel(e.role, e.special)})`;
    case 'ability':
      return `${names(e.seat)}이(가) ${CHARACTER_INFO[e.character].name}의 능력을 썼어요.`;
    case 'characterChosen':
      return `${names(e.seat)}이(가) ${CHARACTER_INFO[e.character].name}을(를) 골랐어요.`;
    case 'roleDrawn':
      return e.role ? `${names(e.seat)}이(가) ${roleLabel(e.role, e.special)} 카드를 뽑았어요.` : `${names(e.seat)}이(가) 역할 카드를 뽑았어요.`;
    case 'bounty': {
      const t = names(e.target);
      if (e.state === 'open') return `💰 현상금 표적은 ${t}${ieyo(t)}.`;
      if (e.state === 'claimed') return `💰 ${t}을(를) 직접 잡았어요! 이제 끝까지 살아남으면 함께 이겨요.`;
      return `💰 현상금을 놓쳤어요.`;
    }
    case 'gameOver':
      return winnerText(e.winner);
    case 'roleRevealed': {
      const r = roleName(e.role);
      return `🦜 ${names(e.target)}의 역할은 ${r}${ieyo(r)}.`;
    }
    case 'wager':
      return `${names(e.seat)}과(와) ${names(e.target)}의 주사위 내기: ${rankLabel(e.cards[0].rank)} 대 ${rankLabel(e.cards[1].rank)}`;
    case 'gearUsed':
      return `${names(e.seat)}의 ${cardName(e.card.kind)}${hasBatchim(cardName(e.card.kind)) ? '이' : '가'} 효과를 내고 버려졌어요.`;
    case 'seaEvent':
      return `바다 이벤트: ${seaEventTitle(e.event)} — ${SEA_EVENTS[e.event].text}`;
  }
}
