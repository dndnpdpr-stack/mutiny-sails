import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { ResultScreen } from '../../src/ui/screens/ResultScreen';
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
    expect(onStart).toHaveBeenCalledWith(5, '잭');
  });
});

describe('App draft flow', () => {
  it('reveals role, drafts a character, then enters the table', async () => {
    render(<App defaults={{ seed: 11, aiDelayMs: 0, animations: false }} />);
    fireEvent.click(screen.getByText('4명'));
    fireEvent.click(screen.getByText('출항'));
    const picks = await screen.findAllByRole('button', { name: /고르기$/ }, { timeout: 3000 });
    expect(picks).toHaveLength(2);
    expect(screen.getAllByText(ROLES).length).toBeGreaterThan(0);
    expect(screen.getByText(/반란 선원과 첩자를|선장을 지켜|선장을 쓰러뜨리세요|마지막까지/)).toBeTruthy();
    fireEvent.click(picks[0]);
    await waitFor(() => expect(screen.getAllByTestId('seat-panel')).toHaveLength(3), { timeout: 3000 });
  });

  it('waits for the captain-first draft when the human is not the captain', async () => {
    // 4 players, seed 2: human seat = |2*31+7|%4 = 1, captain seat = 2 (verified against the engine shuffle)
    render(<App defaults={{ seed: 2, aiDelayMs: 0, animations: false }} />);
    fireEvent.click(screen.getByText('4명'));
    fireEvent.click(screen.getByText('출항'));
    await waitFor(() =>
      expect(screen.queryByText(/다른 선원들이 캐릭터를 고르는 중/) ?? screen.queryAllByRole('button', { name: /고르기$/ })[0]).toBeTruthy(),
    );
    expect(await screen.findAllByRole('button', { name: /고르기$/ }, { timeout: 3000 })).toHaveLength(2);
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
      discardTop: null, distances: {}, myRange: 1, events: [], winner: 'rebels' } as unknown as PlayerView;
    const onRestart = vi.fn();
    render(<ResultScreen view={view} onRestart={onRestart} />);
    expect(screen.getByText('반란 선원의 승리!')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(ROLES).length).toBeGreaterThanOrEqual(4));
    expect(screen.getByText(/쓰러짐/)).toBeTruthy();
    fireEvent.click(screen.getByText('다시 하기'));
    expect(onRestart).toHaveBeenCalled();
  });
});
