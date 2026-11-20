import { fireEvent, render, screen, within } from '@testing-library/react';
import { SetupScreen } from '../../src/ui/screens/SetupScreen';
import { CARD_CATALOG } from '../../src/engine/cards/catalog';
import { CHARACTER_IDS, CHARACTER_INFO } from '../../src/engine/characters/roster';
import { ROLE_GOAL } from '../../src/ui/table/RoleCard';

function open() {
  const onStart = vi.fn();
  render(<SetupScreen onStart={onStart} />);
  fireEvent.click(screen.getByRole('button', { name: '게임 방법' }));
  return { onStart, dialog: screen.getByRole('dialog', { name: '게임 방법' }) };
}
const tab = (name: string) => screen.getByRole('tab', { name });

describe('HowToPlay', () => {
  it('opens on the basic rules tab', () => {
    const { dialog } = open();
    expect(tab('기본 규칙').getAttribute('aria-selected')).toBe('true');
    expect(dialog.textContent).toContain('2장');
    expect(dialog.textContent).toContain('사거리');
  });

  it('roles tab lists every role, its goal and the player-count table', () => {
    const { dialog } = open();
    fireEvent.click(tab('역할'));
    expect(tab('역할').getAttribute('aria-selected')).toBe('true');
    for (const r of ['선장', '충성 선원', '반란 선원', '첩자']) expect(dialog.textContent).toContain(r);
    for (const goal of Object.values(ROLE_GOAL)) expect(dialog.textContent).toContain(goal);
    expect(dialog.textContent).toContain('7명');
  });

  it('characters tab shows all characters without pick buttons', () => {
    const { dialog } = open();
    fireEvent.click(tab('캐릭터'));
    for (const id of CHARACTER_IDS) expect(dialog.textContent).toContain(CHARACTER_INFO[id].name);
    expect(within(dialog).queryByRole('button', { name: /고르기$/ })).toBeNull();
  });

  it('cards tab shows every card kind with its count', () => {
    const { dialog } = open();
    fireEvent.click(tab('카드'));
    for (const info of Object.values(CARD_CATALOG)) {
      expect(dialog.textContent).toContain(info.name);
      expect(dialog.textContent).toContain(info.text);
    }
    expect(dialog.textContent).toContain('×23');
  });

  it('closes with the close button and with Escape, and reopens on the first tab', () => {
    open();
    fireEvent.click(tab('카드'));
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog', { name: '게임 방법' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '게임 방법' }));
    expect(tab('기본 규칙').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '게임 방법' })).toBeNull();
  });

  it('clicking the backdrop closes the guide instead of starting the game', () => {
    const { onStart } = open();
    fireEvent.click(document.querySelector('.guide-overlay')!);
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '게임 방법' })).toBeNull();
  });
});
