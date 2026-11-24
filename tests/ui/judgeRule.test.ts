import { judgeRule } from '../../src/ui/judgeRule';

describe('judgeRule', () => {
  it('barrel: hearts dodge', () => {
    expect(judgeRule('barrel', true)).toEqual({ title: '🛢️ 엄폐용 나무통 판정', need: '♥이면 피해요', result: '피했어요!', good: true });
    expect(judgeRule('barrel', false)).toMatchObject({ result: '못 피했어요', good: false });
  });

  it('brig: hearts escape', () => {
    expect(judgeRule('brig', true)).toMatchObject({ need: '♥이면 탈출', result: '탈출!', good: true });
    expect(judgeRule('brig', false)).toMatchObject({ result: '이번 턴은 쉬어요', good: false });
  });

  it('powder keg: success means it blew up, which is bad', () => {
    expect(judgeRule('powderKeg', true)).toMatchObject({ need: '♠2~9면 폭발', result: '💥 폭발!', good: false });
    expect(judgeRule('powderKeg', false)).toMatchObject({ result: '무사히 넘겨요', good: true });
  });

  it('sea monster: anything but spades is safe', () => {
    expect(judgeRule('seaMonster', true)).toEqual({ title: '🐙 바다 괴물 판정', need: '♠만 아니면 무사', result: '무사해요!', good: true });
    expect(judgeRule('seaMonster', false)).toMatchObject({ result: '물렸어요!', good: false });
  });

  it('resisting a take card: red suits cancel it', () => {
    expect(judgeRule('pickpocket', true)).toMatchObject({ need: '♥·♦이면 무효', result: '막아냈어요!', good: true });
    expect(judgeRule('cutRope', false)).toMatchObject({ result: '막지 못했어요', good: false });
  });
});
