import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { ResultScreen } from '../../src/ui/screens/ResultScreen';
import { DraftScreen } from '../../src/ui/screens/DraftScreen';
import { SetupScreen } from '../../src/ui/screens/SetupScreen';
import type { PlayerView, Role, SeatView } from '../../src/engine/types';

const ROLES = /선장|충성 선원|반란 선원|첩자/;

describe('SetupScreen', () => {
  it('defaults to 5 players and starts with the typed name', () => {
    const onStart = vi.fn();
    render(<SetupScreen onStart={onStart} />);
    expect(screen.getByText('5명').closest('button')?.className).toMatch(/selected/);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '잭' } });
    fireEvent.click(screen.getByText('출항'));
    expect(onStart).toHaveBeenCalledWith(5, '잭', { seaEvents: true, expansionCards: true });
  });

  it('can turn sea events off', () => {
    const onStart = vi.fn();
    render(<SetupScreen onStart={onStart} />);
    const toggle = screen.getByRole('checkbox', { name: /바다 이벤트/ }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText('출항'));
    expect(onStart).toHaveBeenCalledWith(5, '', { seaEvents: false, expansionCards: true });
  });

  it('can turn expansion cards off', () => {
    const onStart = vi.fn();
    render(<SetupScreen onStart={onStart} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /확장 카드/ }));
    fireEvent.click(screen.getByText('출항'));
    expect(onStart).toHaveBeenCalledWith(5, '', { seaEvents: true, expansionCards: false });
  });

  it('shows the title art with the logo and subtitle', () => {
    render(<SetupScreen onStart={vi.fn()} />);
    expect(screen.getByRole('img', { name: '반란의 돛 타이틀 그림' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '반란의 돛' })).toBeTruthy();
    expect(screen.getByText('정체를 숨긴 해적들의 카드 게임')).toBeTruthy();
  });
});

/** 내 차례가 오면 첫 번째 역할 카드를 뽑는다 */
async function drawMyRole() {
  const cards = await screen.findAllByRole('button', { name: /^역할 카드 \d+번$/ }, { timeout: 3000 });
  fireEvent.click(cards[0]);
}

describe('App draft flow', () => {
  it('draws a role, drafts a character, then enters the table', async () => {
    render(<App defaults={{ seed: 11, aiDelayMs: 0, animations: false }} />);
    fireEvent.click(screen.getByText('4명'));
    fireEvent.click(screen.getByText('출항'));
    await drawMyRole();
    const picks = await screen.findAllByRole('button', { name: /고르기$/ }, { timeout: 3000 });
    expect(picks).toHaveLength(2);
    expect(screen.getAllByText(ROLES).length).toBeGreaterThan(0);
    expect(screen.getByText(/반란 선원과 첩자를|선장을 지켜|선장을 쓰러뜨리세요|마지막까지/)).toBeTruthy();
    fireEvent.click(picks[0]);
    await waitFor(() => expect(screen.getAllByTestId('seat-panel')).toHaveLength(3), { timeout: 3000 });
  });

  it('lets me draw my role first even when I am not in seat 0', async () => {
    // 4명, 시드 2: 내 자리 = |2*31+7|%4 = 1
    render(<App defaults={{ seed: 2, aiDelayMs: 0, animations: false }} />);
    fireEvent.click(screen.getByText('4명'));
    fireEvent.click(screen.getByText('출항'));
    expect(await screen.findByText('역할 카드를 뽑으세요', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^역할 카드 \d+번$/ })).toHaveLength(4);
  });

  it('waits for the captain-first character draft after drawing roles', async () => {
    // 4명, 시드 2: 내 자리는 1번. 선장은 뽑은 카드에 따라 정해져서 내가 선장일 수도 아닐 수도 있다
    render(<App defaults={{ seed: 2, aiDelayMs: 0, animations: false }} />);
    fireEvent.click(screen.getByText('4명'));
    fireEvent.click(screen.getByText('출항'));
    await drawMyRole();
    await waitFor(() =>
      expect(screen.queryByText(/다른 선원들이 캐릭터를 고르는 중/) ?? screen.queryAllByRole('button', { name: /고르기$/ })[0]).toBeTruthy(),
    );
    expect(await screen.findAllByRole('button', { name: /고르기$/ }, { timeout: 3000 })).toHaveLength(2);
  });
});

describe('DraftScreen role draw', () => {
  const seats = [0, 1, 2, 3].map((i) => ({
    seat: i, name: `p${i}`, character: null, hp: 0, maxHp: 0, alive: true,
    handCount: 0, equipment: [], role: null, isAi: i !== 1,
  })) as unknown as SeatView[];
  const base = { you: 1, myRole: null, myHand: [], seats, current: 0, hints: [], deckCount: 80,
    discardTop: null, distances: {}, myRange: 1, abilityUsed: false, events: [], winner: null };

  it('lets me draw one of the remaining face-down role cards on my turn', () => {
    const send = vi.fn();
    const view = { ...base, pending: { kind: 'drawRole', seat: 1, slots: [1, 2, 3] },
      events: [{ seq: 1, type: 'roleDrawn', seat: 0, slot: 0, role: null }] } as unknown as PlayerView;
    render(<DraftScreen view={view} send={send} />);
    expect(screen.getByText('역할 카드를 뽑으세요')).toBeTruthy();
    const cards = screen.getAllByRole('button', { name: /^역할 카드 \d+번$/ });
    expect(cards).toHaveLength(3);
    expect(screen.getByText('p0')).toBeTruthy(); // 이미 뽑힌 자리에 뽑은 사람 이름
    fireEvent.click(screen.getByRole('button', { name: '역할 카드 3번' }));
    expect(send).toHaveBeenCalledWith({ type: 'drawRole', slot: 2 });
  });

  it('waits while someone else draws, and announces the captain', () => {
    const withCaptain = seats.map((s) => (s.seat === 0 ? { ...s, role: 'captain' } : s)) as SeatView[];
    const view = { ...base, seats: withCaptain, pending: { kind: 'drawRole', seat: 0, slots: [0, 1, 2, 3] } } as unknown as PlayerView;
    render(<DraftScreen view={view} send={vi.fn()} />);
    expect(screen.getByText('p0이(가) 역할 카드를 고르는 중…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^역할 카드/ })).toBeNull();
    expect(screen.getByText(/선장은 p0/)).toBeTruthy();
  });

  it('reveals my role card once I have drawn it', () => {
    const view = { ...base, myRole: 'rebel', pending: { kind: 'drawRole', seat: 2, slots: [0, 3] } } as unknown as PlayerView;
    render(<DraftScreen view={view} send={vi.fn()} />);
    expect(screen.getByText('반란 선원')).toBeTruthy();
  });
});

describe('DraftScreen', () => {
  it('does not show a pick button on my already-chosen character card', () => {
    const seats = [0, 1].map((i) => ({
      seat: i, name: `p${i}`, character: i === 0 ? 'tom' : null, hp: 4, maxHp: 4, alive: true,
      handCount: 0, equipment: [], role: null, isAi: i > 0,
    })) as unknown as SeatView[];
    const view = { you: 0, myRole: 'captain', myHand: [], seats, current: 0,
      pending: { kind: 'chooseCharacter', seat: 1, options: ['margo', 'lou'] }, hints: [], deckCount: 0,
      discardTop: null, distances: {}, myRange: 1, abilityUsed: false, events: [], winner: null } as unknown as PlayerView;
    render(<DraftScreen view={view} send={vi.fn()} />);
    expect(screen.getByText(/다른 선원들이 캐릭터를 고르는 중/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /고르기$/ })).toBeNull();
  });
});

describe('ResultScreen', () => {
  it('shows winner, every role and restarts', async () => {
    const roles: Role[] = ['captain', 'loyalist', 'rebel', 'spy'];
    const seats: SeatView[] = roles.map((r, i) => ({
      seat: i, name: `p${i}`, character: 'tom', hp: i === 2 ? 0 : 2, maxHp: 4, alive: i !== 2,
      handCount: 0, equipment: [], role: r, isAi: i > 0,
    }));
    const view = { you: 0, myRole: 'captain', myHand: [], seats, current: 0, pending: null, hints: [], deckCount: 0,
      discardTop: null, distances: {}, myRange: 1, abilityUsed: false, events: [], winner: 'rebels' } as unknown as PlayerView;
    const onRestart = vi.fn();
    render(<ResultScreen view={view} onRestart={onRestart} />);
    expect(screen.getByText('반란 선원의 승리!')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(ROLES).length).toBeGreaterThanOrEqual(4));
    expect(screen.getByText(/쓰러짐/)).toBeTruthy();
    fireEvent.click(screen.getByText('다시 하기'));
    expect(onRestart).toHaveBeenCalled();
  });
});
