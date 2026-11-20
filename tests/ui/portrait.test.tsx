import { fireEvent, render, screen } from '@testing-library/react';
import { Portrait } from '../../src/ui/table/Portrait';
import { PORTRAITS } from '../../src/ui/art/portraits';
import { CharacterCard } from '../../src/ui/table/CharacterCard';
import { CHARACTER_IDS, CHARACTER_INFO } from '../../src/engine/characters/roster';

describe('Portrait', () => {
  it('draws the registered picture with the character name as alt', () => {
    render(<Portrait id="tom" variant="card" />);
    const img = screen.getByRole('img', { name: CHARACTER_INFO.tom.name }) as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.className).toContain('card');
  });

  it('uses the face variant class for round faces', () => {
    render(<Portrait id="margo" variant="face" />);
    expect((screen.getByRole('img', { name: CHARACTER_INFO.margo.name }) as HTMLElement).className).toContain('face');
  });

  it('falls back to the emoji when no picture is registered', () => {
    const { container } = render(<Portrait id="tom" variant="face" portraits={{}} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('👨‍🍳');
  });

  it('shows a question mark before a character is chosen', () => {
    const { container } = render(<Portrait id={null} variant="face" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('❔');
  });

  it('falls back to the emoji when the picture fails to load', () => {
    const { container } = render(<Portrait id="tom" variant="card" portraits={{ tom: '/missing.svg' }} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('👨‍🍳');
  });

  it('has a picture for all ten characters', () => {
    expect(CHARACTER_IDS.filter((id) => !PORTRAITS[id])).toEqual([]);
  });

  it('character cards show the portrait', () => {
    render(<CharacterCard id="tom" onClick={() => {}} />);
    expect(screen.getByRole('img', { name: '요리사 톰' })).toBeTruthy();
  });
});
