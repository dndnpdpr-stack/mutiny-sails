import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TableScreen } from '../../src/ui/screens/TableScreen';
import type { Effect } from '../../src/ui/anim/effects';
import type { Action, CardView, PlayerView, SeatView } from '../../src/engine/types';
import { CARD_CATALOG } from '../../src/engine/cards/catalog';

const card = (id: string, kind: CardView['kind'], suit: CardView['suit'] = 'spades', rank: CardView['rank'] = 5): CardView => ({ id, kind, suit, rank });

function seat(i: number, extra: Partial<SeatView> = {}): SeatView {
  return {
    seat: i, name: `p${i}`, character: 'tom', hp: 3, maxHp: 4, alive: true, handCount: 3,
    equipment: [], role: i === 0 ? 'captain' : null, isAi: i !== 1, ...extra,
  };
}

/** 5명, 나는 1번 자리, 선장은 0번 */
function makeView(extra: Partial<PlayerView> = {}, seats?: SeatView[]): PlayerView {
  return {
    you: 1, myRole: 'rebel', myHand: [], seats: seats ?? [0, 1, 2, 3, 4].map((i) => seat(i)), current: 1,
    pending: { kind: 'turn', seat: 1 }, hints: [], deckCount: 40, discardTop: card('d0', 'rum', 'hearts', 9),
    distances: { 0: 1, 2: 1, 3: 2, 4: 2 }, myRange: 1, abilityUsed: false, events: [], winner: null, seaEventsOn: false, seaEvent: null, ...extra,
  };
}

function renderTable(
  latest: PlayerView,
  opts: {
    shown?: PlayerView;
    effects?: Effect[];
    lastRejection?: string | null;
    spectate?: { fast: boolean; onToggleFast: () => void; onRestart: () => void };
    doubleSpeed?: { on: boolean; onToggle: () => void };
  } = {},
) {
  const send = vi.fn<(a: Action) => void>();
  const r = render(
    <TableScreen latest={latest} shown={opts.shown ?? latest} effects={opts.effects ?? []} speed={1} batchKey={0} send={send} lastRejection={opts.lastRejection ?? null} spectate={opts.spectate} doubleSpeed={opts.doubleSpeed} />,
  );
  return { ...r, send };
}

const panel = (n: number) => document.querySelector(`[data-testid="seat-panel"][data-anchor="seat:${n}"]`) as HTMLElement;
const handCard = (name: string) => within(document.querySelector('[data-anchor="hand"]') as HTMLElement).getByRole('button', { name });

describe('TableScreen — margo peek', () => {
  const peeked = card('x9', 'dodge', 'hearts', 7);
  const peekEvent = { seq: 3, type: 'peek' as const, seat: 1, target: 2, card: peeked, visibleTo: [1] };

  it('shows the peeked card in a note until confirmed', () => {
    renderTable(makeView({ events: [peekEvent] }));
    const note = screen.getByRole('dialog', { name: /엿본 카드/ });
    expect(note.textContent).toContain('p2');
    expect(within(note).getByRole('button', { name: '피하기' })).toBeTruthy();
    fireEvent.click(within(note).getByRole('button', { name: '확인' }));
    expect(screen.queryByRole('dialog', { name: /엿본 카드/ })).toBeNull();
  });

  it('keeps a memo on the peeked opponent panel', () => {
    renderTable(makeView({ events: [peekEvent] }));
    expect(panel(2).textContent).toContain('엿본 카드: 피하기');
    expect(panel(3).textContent).not.toContain('엿본 카드');
  });
});

describe('TableScreen', () => {
  it('lays out 4 opponents, crown on the captain, and every anchor', () => {
    renderTable(makeView({ myHand: [card('h1', 'slash')] }));
    expect(screen.getAllByTestId('seat-panel')).toHaveLength(4);
    expect(panel(0).textContent).toContain('👑');
    expect(panel(2).textContent).not.toContain('👑');
    for (const a of ['deck', 'discard', 'judge', 'hand', 'seat:0', 'seat:1', 'seat:2', 'seat:3', 'seat:4']) {
      expect(document.querySelector(`[data-anchor="${a}"]`)).not.toBeNull();
    }
    expect(screen.getByText('항해 일지')).toBeTruthy();
  });

  describe('weapon swap', () => {
    const musketHint = { cardId: 'w2', targets: null, targetCards: false };
    const armed = () => [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { equipment: [card('w1', 'pistol')] } : {}));
    const swapNote = () => screen.queryByRole('dialog', { name: '무기 바꾸기' });

    it('asks before throwing away the weapon I already have, and equips on yes', () => {
      const { send } = renderTable(makeView({ myHand: [card('w2', 'musket')], hints: [musketHint] }, armed()));
      fireEvent.click(handCard('머스킷'));
      expect(send).not.toHaveBeenCalled();
      expect(swapNote()!.textContent).toContain('권총');
      expect(swapNote()!.textContent).toContain('머스킷');
      fireEvent.click(within(swapNote()!).getByRole('button', { name: '바꾸기' }));
      expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'w2' });
      expect(swapNote()).toBeNull();
    });

    it('keeps the old weapon when I say no', () => {
      const { send } = renderTable(makeView({ myHand: [card('w2', 'musket')], hints: [musketHint] }, armed()));
      fireEvent.click(handCard('머스킷'));
      fireEvent.click(within(swapNote()!).getByRole('button', { name: '그대로 두기' }));
      expect(send).not.toHaveBeenCalled();
      expect(swapNote()).toBeNull();
    });

    it('equips right away when I have no weapon', () => {
      const { send } = renderTable(makeView({ myHand: [card('w2', 'musket')], hints: [musketHint] }));
      fireEvent.click(handCard('머스킷'));
      expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'w2' });
    });

    it('also asks from the play button in the card info', () => {
      const { send } = renderTable(makeView({ myHand: [card('w2', 'musket')], hints: [musketHint] }, armed()));
      fireEvent.contextMenu(handCard('머스킷'));
      fireEvent.click(within(screen.getByRole('dialog', { name: '카드 설명' })).getByRole('button', { name: '내기' }));
      expect(send).not.toHaveBeenCalled();
      expect(swapNote()).toBeTruthy();
    });
  });

  describe('walk the plank warning', () => {
    const plankHint = { cardId: 'k1', targets: null, targetCards: false };
    const hand = (n: number) => [card('k1', 'walkPlank'), ...Array.from({ length: n - 1 }, (_, i) => card(`f${i}`, 'rum'))];
    const note = () => screen.queryByRole('dialog', { name: '널빤지 걷기 주의' });

    it('warns when I would still have the most cards, naming who ties, and plays on yes', () => {
      // 내고 나면 3장, 다른 사람들도 3장(동률)
      const { send } = renderTable(makeView({ myHand: hand(4), hints: [plankHint] }));
      fireEvent.click(handCard('널빤지 걷기'));
      expect(send).not.toHaveBeenCalled();
      expect(note()!.textContent).toContain('3장');
      expect(note()!.textContent).toContain('p0, p2, p3, p4');
      fireEvent.click(within(note()!).getByRole('button', { name: '그래도 내기' }));
      expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'k1' });
      expect(note()).toBeNull();
    });

    it('can be called off', () => {
      const { send } = renderTable(makeView({ myHand: hand(5), hints: [plankHint] }));
      fireEvent.click(handCard('널빤지 걷기'));
      fireEvent.click(within(note()!).getByRole('button', { name: '그만두기' }));
      expect(send).not.toHaveBeenCalled();
      expect(note()).toBeNull();
    });

    it('plays right away when someone else has more cards', () => {
      const { send } = renderTable(makeView({ myHand: hand(3), hints: [plankHint] }));
      fireEvent.click(handCard('널빤지 걷기'));
      expect(note()).toBeNull();
      expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'k1' });
    });
  });

  it('has a 2x speed toggle', () => {
    const onToggle = vi.fn();
    const { rerender, send } = renderTable(makeView(), { doubleSpeed: { on: false, onToggle } });
    const b = screen.getByRole('button', { name: '2배속' });
    expect(b.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(b);
    expect(onToggle).toHaveBeenCalledTimes(1);
    const v = makeView();
    rerender(<TableScreen latest={v} shown={v} effects={[]} speed={2} batchKey={0} send={send} lastRejection={null} doubleSpeed={{ on: true, onToggle }} />);
    expect(screen.getByRole('button', { name: '2배속' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the captain with a ribbon and its own frame', () => {
    renderTable(makeView());
    expect(panel(0).classList.contains('captain')).toBe(true);
    expect(within(panel(0)).getByText('👑 선장')).toBeTruthy();
    expect(panel(2).classList.contains('captain')).toBe(false);
    expect(document.querySelector('.me-info')?.classList.contains('captain')).toBe(false);
  });

  it('marks my own panel when I am the captain', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, { role: i === 1 ? 'captain' : null }));
    renderTable(makeView({ myRole: 'captain' }, seats));
    const me = document.querySelector('.me-info') as HTMLElement;
    expect(me.classList.contains('captain')).toBe(true);
    expect(within(me).getByText('👑 선장')).toBeTruthy();
  });

  it('orders opponents clockwise starting after me', () => {
    renderTable(makeView());
    const order = screen.getAllByTestId('seat-panel').map((p) => p.getAttribute('data-anchor'));
    expect(order).toEqual(['seat:2', 'seat:3', 'seat:4', 'seat:0']);
  });

  it('selects a slash, marks targets, and plays on the clicked target', () => {
    const v = makeView({ myHand: [card('s1', 'slash')], hints: [{ cardId: 's1', targets: [0, 2], targetCards: false }] });
    const { send } = renderTable(v);
    fireEvent.click(handCard('칼질'));
    expect(send).not.toHaveBeenCalled();
    expect(panel(0).classList.contains('targetable')).toBe(true);
    expect(panel(2).classList.contains('targetable')).toBe(true);
    expect(panel(3).classList.contains('targetable')).toBe(false);
    expect(panel(3).classList.contains('out-of-range')).toBe(true);
    fireEvent.click(panel(2));
    expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 's1', target: 2 });
  });

  it('cancels selection on a second click and with Escape', () => {
    const v = makeView({ myHand: [card('s1', 'slash')], hints: [{ cardId: 's1', targets: [2], targetCards: false }] });
    renderTable(v);
    fireEvent.click(handCard('칼질'));
    expect(panel(2).classList.contains('targetable')).toBe(true);
    fireEvent.click(handCard('칼질'));
    expect(panel(2).classList.contains('targetable')).toBe(false);
    fireEvent.click(handCard('칼질'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(panel(2).classList.contains('targetable')).toBe(false);
  });

  describe('card info', () => {
    const info = () => screen.queryByRole('dialog', { name: '카드 설명' });
    const rumHint = { cardId: 'r1', targets: null, targetCards: false };
    const rerenderWith = (rerender: (ui: React.ReactElement) => void, send: (a: Action) => void, v: PlayerView) =>
      rerender(<TableScreen latest={v} shown={v} effects={[]} speed={1} batchKey={0} send={send} lastRejection={null} />);

    it('tapping a no-target card plays it at once, without the card info', () => {
      const { send } = renderTable(makeView({ myHand: [card('r1', 'rum')], hints: [rumHint] }));
      fireEvent.click(handCard('럼주'));
      expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'r1' });
      expect(info()).toBeNull();
    });

    it('right-click shows the text without playing, and the close button hides it', () => {
      const { send } = renderTable(makeView({ myHand: [card('r1', 'rum')], hints: [rumHint] }));
      fireEvent.contextMenu(handCard('럼주'));
      expect(send).not.toHaveBeenCalled();
      expect(within(info()!).getByText(CARD_CATALOG.rum.text)).toBeTruthy();
      fireEvent.click(within(info()!).getByRole('button', { name: '닫기' }));
      expect(info()).toBeNull();
    });

    it('Escape closes the card info', () => {
      renderTable(makeView({ myHand: [card('r1', 'rum')], hints: [rumHint] }));
      fireEvent.contextMenu(handCard('럼주'));
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(info()).toBeNull();
    });

    describe('long press', () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it('holding a card shows its text, and letting go does not play it', () => {
        const { send } = renderTable(makeView({ myHand: [card('r1', 'rum')], hints: [rumHint] }));
        const c = handCard('럼주');
        fireEvent.pointerDown(c, { pointerType: 'touch' });
        act(() => void vi.advanceTimersByTime(500));
        expect(within(info()!).getByText(CARD_CATALOG.rum.text)).toBeTruthy();
        fireEvent.pointerUp(c, { pointerType: 'touch' });
        fireEvent.click(c);
        expect(send).not.toHaveBeenCalled();
      });

      it('a short tap still plays the card', () => {
        const { send } = renderTable(makeView({ myHand: [card('r1', 'rum')], hints: [rumHint] }));
        const c = handCard('럼주');
        fireEvent.pointerDown(c, { pointerType: 'touch' });
        act(() => void vi.advanceTimersByTime(150));
        fireEvent.pointerUp(c, { pointerType: 'touch' });
        fireEvent.click(c);
        act(() => void vi.advanceTimersByTime(500));
        expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'r1' });
        expect(info()).toBeNull();
      });
    });

    it('the play button in the card info plays a no-target card', () => {
      const { send } = renderTable(makeView({ myHand: [card('r1', 'rum')], hints: [rumHint] }));
      fireEvent.contextMenu(handCard('럼주'));
      fireEvent.click(within(info()!).getByRole('button', { name: '내기' }));
      expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'r1' });
      expect(info()).toBeNull();
    });

    it('an unplayable card shows its text without a play button, and tapping it does nothing', () => {
      const { send } = renderTable(makeView({ myHand: [card('d1', 'dodge')] }));
      fireEvent.contextMenu(handCard('피하기'));
      expect(within(info()!).getByText(CARD_CATALOG.dodge.text)).toBeTruthy();
      expect(within(info()!).queryByRole('button', { name: '내기' })).toBeNull();
      fireEvent.click(handCard('피하기'));
      expect(send).not.toHaveBeenCalled();
    });

    it('works when it is not my turn', () => {
      renderTable(makeView({ myHand: [card('s1', 'slash')], current: 2, pending: { kind: 'turn', seat: 2 } }));
      fireEvent.contextMenu(handCard('칼질'));
      expect(within(info()!).getByText(CARD_CATALOG.slash.text)).toBeTruthy();
    });

    it('tapping a target card marks targets without the card info', () => {
      renderTable(makeView({ myHand: [card('s1', 'slash')], hints: [{ cardId: 's1', targets: [2], targetCards: false }] }));
      fireEvent.click(handCard('칼질'));
      expect(panel(2).classList.contains('targetable')).toBe(true);
      expect(info()).toBeNull();
    });

    it('expansion cards are tagged', () => {
      renderTable(makeView({ myHand: [card('f1', 'fireShip')] }));
      fireEvent.contextMenu(handCard('불붙은 배'));
      expect(within(info()!).getByText('확장')).toBeTruthy();
    });

    it('responding still plays at once', () => {
      const v = makeView({ current: 0, pending: { kind: 'respondAttack', seat: 1, attacker: 0, source: 'slash' }, myHand: [card('d1', 'dodge')] });
      const { send } = renderTable(v);
      fireEvent.click(handCard('피하기'));
      expect(send).toHaveBeenCalledWith({ type: 'respond', cardIds: ['d1'] });
      expect(info()).toBeNull();
    });

    it('cards in a pick note show their text on right-click, and a tap still picks', () => {
      const revealed = [card('t1', 'rum', 'hearts'), card('t2', 'fireShip', 'clubs')];
      const { send } = renderTable(makeView({ pending: { kind: 'treasureMap', seat: 1, revealed } }));
      const note = screen.getByRole('dialog');
      fireEvent.contextMenu(within(note).getByRole('button', { name: '불붙은 배' }));
      expect(within(info()!).getByText(CARD_CATALOG.fireShip.text)).toBeTruthy();
      expect(within(info()!).queryByRole('button', { name: '내기' })).toBeNull();
      expect(send).not.toHaveBeenCalled();
      fireEvent.click(within(note).getByRole('button', { name: '럼주' }));
      expect(send).toHaveBeenCalledWith({ type: 'chooseCard', cardId: 't1' });
    });

    it("an opponent's equipment shows its text on right-click", () => {
      const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 2 ? { equipment: [card('e1', 'barrel', 'hearts')] } : {}));
      renderTable(makeView({}, seats));
      fireEvent.contextMenu(within(panel(2)).getByRole('button', { name: '엄폐용 나무통' }));
      expect(within(info()!).getByText(CARD_CATALOG.barrel.text)).toBeTruthy();
    });

    it('the card info closes once the card left my hand', () => {
      const { rerender, send } = renderTable(makeView({ myHand: [card('s1', 'slash')] }));
      fireEvent.contextMenu(handCard('칼질'));
      rerenderWith(rerender, send, makeView({ myHand: [] }));
      expect(info()).toBeNull();
    });
  });

  it('pickpocket on a target with no hand: only equipment choices', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 2 ? { handCount: 0, equipment: [card('e1', 'pistol')] } : {}));
    const v = makeView({ myHand: [card('p1', 'pickpocket')], hints: [{ cardId: 'p1', targets: [2], targetCards: true }] }, seats);
    const { send } = renderTable(v);
    fireEvent.click(handCard('소매치기'));
    fireEvent.click(panel(2));
    const note = screen.getByRole('dialog');
    expect(within(note).queryByText('손패 무작위')).toBeNull();
    fireEvent.click(within(note).getByRole('button', { name: '권총' }));
    expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'p1', target: 2, targetCardId: 'e1' });
  });

  it('pickpocket on a target with cards in hand offers a random hand card', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 2 ? { handCount: 2, equipment: [card('e1', 'pistol')] } : {}));
    const v = makeView({ myHand: [card('p1', 'pickpocket')], hints: [{ cardId: 'p1', targets: [2], targetCards: true }] }, seats);
    const { send } = renderTable(v);
    fireEvent.click(handCard('소매치기'));
    fireEvent.click(panel(2));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('손패 무작위'));
    expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'p1', target: 2 });
  });

  it('draws the hand from shown but only acts on cards that are in latest (Review Focus 5)', () => {
    const x = card('x', 'rum');
    const y = card('y', 'feast');
    const shown = makeView({ myHand: [x], hints: [] });
    const latest = makeView({ myHand: [y], hints: [{ cardId: 'x', targets: null, targetCards: false }, { cardId: 'y', targets: null, targetCards: false }] });
    const { send } = renderTable(latest, { shown });
    const hand = document.querySelector('[data-anchor="hand"]') as HTMLElement;
    expect(within(hand).queryByRole('button', { name: '선상 잔치' })).toBeNull();
    const btn = within(hand).getByRole('button', { name: '럼주' });
    expect(btn.classList.contains('dim')).toBe(true);
    fireEvent.click(btn);
    expect(send).not.toHaveBeenCalled();
  });

  it('opens the response note from latest.pending and highlights the dodge', () => {
    const v = makeView({ current: 0, pending: { kind: 'respondAttack', seat: 1, attacker: 0, source: 'slash' }, myHand: [card('d1', 'dodge'), card('s1', 'slash')] });
    const { send } = renderTable(v);
    const note = screen.getByRole('dialog');
    expect(within(note).getByText('피하기 내기')).toBeTruthy();
    expect(within(note).getByText('맞기')).toBeTruthy();
    expect(handCard('피하기').classList.contains('highlight')).toBe(true);
    expect(handCard('칼질').classList.contains('highlight')).toBe(false);
    fireEvent.click(within(note).getByText('피하기 내기'));
    expect(send).toHaveBeenCalledWith({ type: 'respond', cardIds: ['d1'] });
  });

  it('discardExcess picks cards in the note', () => {
    const v = makeView({ pending: { kind: 'discardExcess', seat: 1, count: 1 }, myHand: [card('a', 'rum'), card('b', 'dodge')] });
    const { send } = renderTable(v);
    const note = screen.getByRole('dialog');
    fireEvent.click(within(note).getByRole('button', { name: '피하기' }));
    fireEvent.click(within(note).getByText('버리기 (1/1)'));
    expect(send).toHaveBeenCalledWith({ type: 'discard', cardIds: ['b'] });
  });

  it('treasure map lets me pick one of the revealed cards', () => {
    const v = makeView({ pending: { kind: 'treasureMap', seat: 1, revealed: [card('m1', 'rum'), card('m2', 'duel')] } });
    const { send } = renderTable(v);
    const note = screen.getByRole('dialog');
    expect(within(note).getByText(/보물 지도/)).toBeTruthy();
    fireEvent.click(within(note).getByRole('button', { name: '결투' }));
    expect(send).toHaveBeenCalledWith({ type: 'chooseCard', cardId: 'm2' });
  });

  it('names a fire ship attack', () => {
    renderTable(makeView({ current: 0, pending: { kind: 'respondAttack', seat: 1, attacker: 0, source: 'fireShip' } }));
    expect(within(screen.getByRole('dialog')).getByText('p0의 불붙은 배!')).toBeTruthy();
  });

  it('fortune shows the top card only to me and sends it to the bottom on request', () => {
    const v = makeView({ pending: { kind: 'fortune', seat: 1, card: card('t', 'rum', 'hearts', 9) } });
    const { send } = renderTable(v);
    const note = screen.getByRole('dialog');
    expect(within(note).getByRole('button', { name: '럼주' })).toBeTruthy();
    fireEvent.click(within(note).getByText('맨 밑으로'));
    expect(send).toHaveBeenCalledWith({ type: 'fortune', toBottom: true });
  });

  it('dorothy heals a hurt player with a rum through the ability note', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { character: 'dorothy' } : i === 3 ? { hp: 4, maxHp: 4 } : {}));
    const v = makeView({ myHand: [card('r1', 'rum'), card('s1', 'slash')] }, seats);
    const { send } = renderTable(v);
    fireEvent.click(screen.getByText('능력 사용'));
    const note = screen.getByRole('dialog', { name: /도로시/ });
    expect(within(note).queryByRole('button', { name: 'p3' })).toBeNull(); // 체력이 가득한 사람은 제외
    fireEvent.click(within(note).getByRole('button', { name: 'p2' }));
    expect(send).toHaveBeenCalledWith({ type: 'useAbility', cardIds: ['r1'], target: 2 });
  });

  it('dorothy cannot use the ability without a rum', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { character: 'dorothy' } : {}));
    renderTable(makeView({ myHand: [card('s1', 'slash')] }, seats));
    expect((screen.getByText('능력 사용') as HTMLButtonElement).disabled).toBe(true);
  });

  it('kiki picks a hand card to throw away and an equipment card to remove', () => {
    const seats = [0, 1, 2, 3, 4].map((i) =>
      seat(i, i === 1 ? { character: 'kiki' } : i === 3 ? { equipment: [card('b3', 'barrel', 'hearts', 4)] } : {}),
    );
    const v = makeView({ myHand: [card('f1', 'feast'), card('s1', 'slash')] }, seats);
    const { send } = renderTable(v);
    fireEvent.click(screen.getByText('능력 사용'));
    const note = screen.getByRole('dialog', { name: /키키/ });
    fireEvent.click(within(note).getByRole('button', { name: '선상 잔치' }));
    fireEvent.click(within(note).getByRole('button', { name: '엄폐용 나무통' }));
    expect(send).toHaveBeenCalledWith({ type: 'useAbility', cardIds: ['f1'], target: 3, targetCardId: 'b3' });
  });

  it('judge choice says what the judgment is for', () => {
    renderTable(makeView({ pending: { kind: 'judgeChoice', seat: 1, options: [card('j1', 'rum', 'hearts'), card('j2', 'dodge', 'clubs')], reason: 'barrel' } }));
    expect(within(screen.getByRole('dialog')).getByText(/엄폐용 나무통 판정/)).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText(/♥이면 피해요/)).toBeTruthy();
  });

  it('the ability note does not come back by itself on my next turn', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { character: 'dorothy' } : {}));
    const mine = makeView({ myHand: [card('r1', 'rum')] }, seats);
    const r = renderTable(mine);
    fireEvent.click(screen.getByText('능력 사용'));
    expect(screen.getByRole('dialog', { name: /도로시/ })).toBeTruthy();
    const others = { ...mine, current: 2, pending: { kind: 'turn' as const, seat: 2 } };
    r.rerender(<TableScreen latest={others} shown={others} effects={[]} speed={1} batchKey={0} send={vi.fn()} lastRejection={null} />);
    r.rerender(<TableScreen latest={mine} shown={mine} effects={[]} speed={1} batchKey={0} send={vi.fn()} lastRejection={null} />);
    expect(screen.queryByRole('dialog', { name: /도로시/ })).toBeNull();
  });

  it('drawSource offers deck and discard', () => {
    const v = makeView({ pending: { kind: 'drawSource', seat: 1 } });
    const { send } = renderTable(v);
    fireEvent.click(within(screen.getByRole('dialog')).getByText('버린 카드에서'));
    expect(send).toHaveBeenCalledWith({ type: 'chooseDrawSource', fromDiscard: true });
  });

  it('ends the turn and shows the derrick ability button', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { character: 'derrick' } : {}));
    const v = makeView({ myHand: [card('s1', 'slash'), card('s2', 'slash')] }, seats);
    const { send } = renderTable(v);
    fireEvent.click(screen.getByText('능력 사용'));
    expect(send).toHaveBeenCalledWith({ type: 'useAbility', cardIds: ['s1', 's2'] });
    fireEvent.click(screen.getByText('턴 종료'));
    expect(send).toHaveBeenCalledWith({ type: 'endTurn' });
  });

  it('disables the derrick ability button once it was used this turn', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { character: 'derrick' } : {}));
    const v = makeView({ myHand: [card('s1', 'slash'), card('s2', 'slash')], abilityUsed: true }, seats);
    renderTable(v);
    expect((screen.getByText('능력 사용').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows spectating instead of the hand when I am dead', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { alive: false, hp: 0, role: 'rebel' } : {}));
    renderTable(makeView({ myHand: [card('s1', 'slash')], current: 0, pending: { kind: 'turn', seat: 0 } }, seats));
    expect(screen.getByText('관전 중')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '칼질' })).toBeNull();
  });

  it('shows my role as a card next to my character, with its goal', () => {
    renderTable(makeView());
    const rc = screen.getByLabelText('내 역할 카드');
    expect(rc.textContent).toContain('반란 선원');
    expect(rc.textContent).toContain('선장을 쓰러뜨리세요');
    expect(document.querySelector('.me-info')?.textContent).not.toContain('반란 선원');
  });

  describe('spectating controls', () => {
    const deadSeats = () => [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { alive: false, hp: 0, role: 'rebel' } : {}));
    const spectate = (fast = false) => ({ fast, onToggleFast: vi.fn(), onRestart: vi.fn() });

    it('offers fast forward and new game once I am dead', () => {
      const sp = spectate();
      renderTable(makeView({ current: 0, pending: { kind: 'turn', seat: 0 } }, deadSeats()), { spectate: sp });
      const ff = screen.getByRole('button', { name: /빨리 감기/ });
      expect(ff.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(ff);
      expect(sp.onToggleFast).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: '새로 하기' }));
      expect(sp.onRestart).toHaveBeenCalledTimes(1);
    });

    it('shows fast forward as pressed while it is on', () => {
      renderTable(makeView({ current: 0, pending: { kind: 'turn', seat: 0 } }, deadSeats()), { spectate: spectate(true) });
      expect(screen.getByRole('button', { name: /빨리 감기/ }).getAttribute('aria-pressed')).toBe('true');
    });

    it('hides them while I am alive', () => {
      renderTable(makeView(), { spectate: spectate() });
      expect(screen.queryByRole('button', { name: /빨리 감기/ })).toBeNull();
      expect(screen.queryByRole('button', { name: '새로 하기' })).toBeNull();
    });
  });

  it('a bounty hunter sees the target on the role card', () => {
    renderTable(makeView({ myRole: 'hunter', myBounty: { target: 3, state: 'open' } }));
    expect(screen.getByLabelText('내 역할 카드').textContent).toContain('표적: p3');
  });

  it('a bounty hunter sees the target seat highlighted, and only that seat', () => {
    renderTable(makeView({ myRole: 'hunter', myBounty: { target: 3, state: 'open' } }));
    const marked = document.querySelectorAll('.opp.bounty-target');
    expect(marked.length).toBe(1);
    expect(marked[0].getAttribute('data-anchor')).toBe('seat:3');
    expect(screen.getAllByLabelText('현상금 표적').length).toBe(1);
  });

  it('no target highlight once the bounty is claimed', () => {
    renderTable(makeView({ myRole: 'hunter', myBounty: { target: 3, state: 'claimed' } }));
    expect(document.querySelector('.bounty-target')).toBeNull();
  });

  it('a navigator sees the special name on the role card', () => {
    renderTable(makeView({ myRole: 'loyalist', mySpecial: 'navigator' }));
    expect(screen.getByLabelText('내 역할 카드').textContent).toContain('항해사');
  });

  it('keeps showing my role card while spectating', () => {
    const seats = [0, 1, 2, 3, 4].map((i) => seat(i, i === 1 ? { alive: false, hp: 0, role: 'rebel' } : {}));
    renderTable(makeView({ current: 0, pending: { kind: 'turn', seat: 0 } }, seats));
    expect(screen.getByLabelText('내 역할 카드').textContent).toContain('반란 선원');
  });

  it('shows a face-down role card before my role is known', () => {
    renderTable(makeView({ myRole: null }));
    expect(screen.getByLabelText('가려진 역할 카드')).toBeTruthy();
  });

  it('marks a shaken seat while its effect runs', async () => {
    renderTable(makeView(), { effects: [{ kind: 'shake', seat: 2, at: 0, ms: 400 }] });
    await waitFor(() => expect(panel(2).classList.contains('shake')).toBe(true));
    expect(panel(3).classList.contains('shake')).toBe(false);
  });

  it('does not re-apply a finished flag when the speed changes mid-batch', () => {
    vi.useFakeTimers();
    try {
      const v = makeView();
      const fx: Effect[] = [{ kind: 'shake', seat: 2, at: 0, ms: 400 }, { kind: 'shake', seat: 3, at: 0, ms: 2000 }];
      const ui = (speed: 1 | 2) => <TableScreen latest={v} shown={v} effects={fx} speed={speed} batchKey={7} send={vi.fn()} lastRejection={null} />;
      const r = render(ui(1));
      act(() => { vi.advanceTimersByTime(10); });
      expect(panel(2).classList.contains('shake')).toBe(true);
      act(() => { vi.advanceTimersByTime(450); });
      expect(panel(2).classList.contains('shake')).toBe(false);
      r.rerender(ui(2));
      act(() => { vi.advanceTimersByTime(10); });
      expect(panel(2).classList.contains('shake')).toBe(false);
      expect(panel(3).classList.contains('shake')).toBe(true);
      act(() => { vi.advanceTimersByTime(800); }); // remaining ~1540ms at 2x
      expect(panel(3).classList.contains('shake')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the my-turn banner during my turn effect', async () => {
    renderTable(makeView(), { effects: [{ kind: 'turn', seat: 1, mine: true, at: 0, ms: 500 }] });
    expect(await screen.findByText('내 차례!')).toBeTruthy();
  });

  it('shows the sea event banner during its effect', async () => {
    renderTable(makeView({ seaEventsOn: true, seaEvent: 'storm' }), { effects: [{ kind: 'sea', event: 'storm', at: 0, ms: 1200 }] });
    expect(await screen.findByText('🌪️ 폭풍!')).toBeTruthy();
  });

  it('keeps the sea banner up for its own time even at double speed, and still says it is my turn', () => {
    vi.useFakeTimers();
    try {
      const effects: Effect[] = [
        { kind: 'sea', event: 'storm', at: 0, ms: 300 },
        { kind: 'turn', seat: 1, mine: true, at: 120, ms: 500 },
      ];
      render(<TableScreen latest={makeView()} shown={makeView()} effects={effects} speed={2} batchKey={1} send={vi.fn()} lastRejection={null} />);
      act(() => void vi.advanceTimersByTime(1000));
      expect(screen.getByText('🌪️ 폭풍!')).toBeTruthy();
      expect(screen.getByText('내 차례!')).toBeTruthy();
      act(() => void vi.advanceTimersByTime(1000));
      expect(screen.queryByText('🌪️ 폭풍!')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the sea banner still goes away when another batch starts before its time is up', () => {
    vi.useFakeTimers();
    try {
      const v = makeView();
      const sea: Effect[] = [{ kind: 'sea', event: 'storm', at: 0, ms: 300 }];
      const { rerender } = render(<TableScreen latest={v} shown={v} effects={sea} speed={1} batchKey={1} send={vi.fn()} lastRejection={null} />);
      act(() => void vi.advanceTimersByTime(500));
      expect(screen.getByText('🌪️ 폭풍!')).toBeTruthy();
      rerender(<TableScreen latest={v} shown={v} effects={[]} speed={1} batchKey={2} send={vi.fn()} lastRejection={null} />);
      act(() => void vi.advanceTimersByTime(2000));
      expect(screen.queryByText('🌪️ 폭풍!')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the current sea event card next to the deck only when events are on', () => {
    const { unmount } = renderTable(makeView({ seaEventsOn: true, seaEvent: 'storm' }));
    const slot = screen.getByTestId('sea-event');
    expect(slot.textContent).toContain('폭풍');
    expect(slot.textContent).toContain('모든 거리 +1');
    unmount();
    const r2 = renderTable(makeView({ seaEventsOn: true, seaEvent: null }));
    expect(screen.getByTestId('sea-event').textContent).toContain('바다 이벤트');
    r2.unmount();
    renderTable(makeView());
    expect(screen.queryByTestId('sea-event')).toBeNull();
  });

  it('shows the rejection toast', () => {
    renderTable(makeView(), { lastRejection: '지금은 낼 수 없어요' });
    expect(screen.getByText('지금은 낼 수 없어요')).toBeTruthy();
  });
});
