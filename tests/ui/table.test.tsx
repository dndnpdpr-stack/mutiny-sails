import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TableScreen } from '../../src/ui/screens/TableScreen';
import type { Effect } from '../../src/ui/anim/effects';
import type { Action, CardView, PlayerView, SeatView } from '../../src/engine/types';

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

function renderTable(latest: PlayerView, opts: { shown?: PlayerView; effects?: Effect[]; lastRejection?: string | null } = {}) {
  const send = vi.fn<(a: Action) => void>();
  const r = render(
    <TableScreen latest={latest} shown={opts.shown ?? latest} effects={opts.effects ?? []} speed={1} batchKey={0} send={send} lastRejection={opts.lastRejection ?? null} />,
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

  it('plays a no-target card immediately', () => {
    const v = makeView({ myHand: [card('r1', 'rum')], hints: [{ cardId: 'r1', targets: null, targetCards: false }] });
    const { send } = renderTable(v);
    fireEvent.click(handCard('럼주'));
    expect(send).toHaveBeenCalledWith({ type: 'playCard', cardId: 'r1' });
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
