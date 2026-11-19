import { fireEvent, render, screen } from '@testing-library/react';
import { CardFace } from '../../src/ui/table/Card';
import { CharacterCard } from '../../src/ui/table/CharacterCard';
import { RoleCard, ROLE_GOAL } from '../../src/ui/table/RoleCard';

describe('CardFace', () => {
  it('shows name, rank and red suit for hearts', () => {
    const { container } = render(<CardFace card={{ id: 'c1', kind: 'slash', suit: 'hearts', rank: 12 }} />);
    expect(screen.getByText('칼질')).toBeTruthy();
    expect(screen.getByText('Q')).toBeTruthy();
    expect(container.querySelector('.suit')!.classList.contains('red')).toBe(true);
  });
  it('spades are not red', () => {
    const { container } = render(<CardFace card={{ id: 'c2', kind: 'slash', suit: 'spades', rank: 7 }} />);
    expect(container.querySelector('.suit')!.classList.contains('red')).toBe(false);
  });
  it('equipment class', () => {
    const { container } = render(<CardFace card={{ id: 'c3', kind: 'pistol', suit: 'clubs', rank: 3 }} />);
    expect(container.firstElementChild!.classList.contains('equipment')).toBe(true);
  });
  it('disabled without onClick, calls with', () => {
    const card = { id: 'c4', kind: 'slash' as const, suit: 'spades' as const, rank: 7 as const };
    const { rerender } = render(<CardFace card={card} />);
    expect((screen.getByRole('button', { name: '칼질' }) as HTMLButtonElement).disabled).toBe(true);
    const fn = vi.fn();
    rerender(<CardFace card={card} onClick={fn} />);
    fireEvent.click(screen.getByRole('button', { name: '칼질' }));
    expect(fn).toHaveBeenCalled();
  });
});

describe('CharacterCard', () => {
  it('renders orso', () => {
    const { container } = render(<CharacterCard id="orso" />);
    expect(screen.getByText('갑판장 오르소')).toBeTruthy();
    expect(container.querySelectorAll('.hearts .heart')).toHaveLength(5);
    expect(screen.getByRole('button', { name: '갑판장 오르소 고르기' })).toBeTruthy();
  });
});

describe('RoleCard', () => {
  it('revealed shows role and goal', () => {
    render(<RoleCard role="rebel" revealed />);
    expect(screen.getByText('반란 선원')).toBeTruthy();
    expect(screen.getByText(ROLE_GOAL.rebel)).toBeTruthy();
  });
  it('hidden shows no role name', () => {
    render(<RoleCard role="rebel" revealed={false} />);
    expect(screen.queryByText('반란 선원')).toBeNull();
  });
});
