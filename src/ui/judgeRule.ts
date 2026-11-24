import { CARD_CATALOG } from '../engine/cards/catalog';
import type { JudgeReason } from '../engine/types';
import { judgeReasonName } from './format';

export interface JudgeRule {
  /** "⛓️ 영창 판정" */
  title: string;
  /** 어떤 카드가 나와야 하는지 */
  need: string;
  /** 이번 결과를 사람 말로 */
  result: string;
  /** 판정 받은 사람에게 좋은 결과인지 (화약통은 success=폭발이라 반대) */
  good: boolean;
}

const RULES: Partial<Record<JudgeReason, { need: string; ok: string; fail: string; successIsBad?: boolean }>> = {
  barrel: { need: '♥이면 피해요', ok: '피했어요!', fail: '못 피했어요' },
  brig: { need: '♥이면 탈출', ok: '탈출!', fail: '이번 턴은 쉬어요' },
  powderKeg: { need: '♠2~9면 폭발', ok: '💥 폭발!', fail: '무사히 넘겨요', successIsBad: true },
  seaMonster: { need: '♠만 아니면 무사', ok: '무사해요!', fail: '물렸어요!' },
};
/** 그 밖의 판정은 빼앗기 카드에 버티는 캐릭터(♥·♦이면 무효) */
const RESIST = { need: '♥·♦이면 무효', ok: '막아냈어요!', fail: '막지 못했어요' };

export function judgeRule(reason: JudgeReason, success: boolean): JudgeRule {
  const r = RULES[reason] ?? RESIST;
  const emoji = reason === 'seaMonster' ? '🐙' : CARD_CATALOG[reason].emoji;
  return {
    title: `${emoji} ${judgeReasonName(reason)} 판정`,
    need: r.need,
    result: success ? r.ok : r.fail,
    good: 'successIsBad' in r && r.successIsBad ? !success : success,
  };
}

/** 판정 전에 보여줄 조건만 */
export const judgeNeed = (reason: JudgeReason): string => (RULES[reason] ?? RESIST).need;
