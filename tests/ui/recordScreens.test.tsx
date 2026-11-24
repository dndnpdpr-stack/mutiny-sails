import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResultScreen } from '../../src/ui/screens/ResultScreen';
import { SetupScreen } from '../../src/ui/screens/SetupScreen';
import { loadRecord } from '../../src/ui/record';
import type { PlayerView } from '../../src/engine/types';

const view = {
  you: 0, myRole: 'captain', myHand: [], events: [], winner: 'captainTeam', stats: { 0: { damage: 2, kills: 1 } },
  seats: [{ seat: 0, name: '나', role: 'captain', character: 'tom', hp: 2, maxHp: 4, alive: true, handCount: 0, equipment: [], isAi: false }],
} as unknown as PlayerView;

describe('my record on screens', () => {
  beforeEach(() => localStorage.clear());

  it('the result screen adds a finished game once; setup shows it by role and can reset it', () => {
    const { rerender, unmount } = render(<ResultScreen view={view} onRestart={() => {}} />);
    rerender(<ResultScreen view={view} onRestart={() => {}} />);
    expect(screen.getByText('🎉 내가 이겼어요!')).toBeTruthy();
    expect(screen.getByText(/통산 1전 1승 \(100%\) · 선장 1전 1승/)).toBeTruthy();
    expect(loadRecord().games).toBe(1);
    unmount();

    render(<SetupScreen onStart={() => {}} />);
    fireEvent.click(screen.getByText(/내 전적 1전 1승/));
    expect(screen.getByRole('dialog', { name: '내 전적' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '선장' })).toBeTruthy();
    fireEvent.click(screen.getByText('초기화'));
    fireEvent.click(screen.getByText('정말 지울까요?'));
    expect(loadRecord().games).toBe(0);
    expect(screen.getByText(/내 전적 없음/)).toBeTruthy();
  });
});
