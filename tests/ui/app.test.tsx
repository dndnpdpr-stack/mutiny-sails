import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../src/ui/App';

function startGame(count: number, animations: boolean) {
  render(<App defaults={{ seed: 11, aiDelayMs: 0, animations }} />);
  fireEvent.click(screen.getByText(`${count}명`));
  fireEvent.click(screen.getByText('출항'));
}

async function pickCharacter() {
  const picks = await screen.findAllByRole('button', { name: /고르기$/ }, { timeout: 3000 });
  fireEvent.click(picks[0]);
}

/** 기본 행동(맞기·포기·턴 종료…)만 눌러 결과 화면까지 진행 */
async function playThrough(waitMs: number) {
  const click = (name: string | RegExp, root: HTMLElement) => {
    const b = within(root).queryAllByRole('button', { name }).find((x) => !(x as HTMLButtonElement).disabled);
    if (b) fireEvent.click(b);
    return !!b;
  };
  const timer = setInterval(() => {
    act(() => {
      const dialog = screen.queryByRole('dialog');
      if (dialog) {
        const discard = within(dialog).queryByText(/버리기 \(/);
        if (discard) {
          const need = Number(/\/(\d+)\)/.exec(discard.textContent ?? '')![1]);
          within(dialog).getAllByRole('button').filter((b) => b.classList.contains('pcard')).slice(0, need).forEach((b) => fireEvent.click(b));
          click(/버리기 \(/, dialog);
          return;
        }
        if (click(/맞기|포기|쓰러지기|덱에서/, dialog)) return;
        const first = dialog.querySelector('button:not(:disabled)') as HTMLButtonElement | null;
        if (first) fireEvent.click(first);
        return;
      }
      click('턴 종료', document.body);
    });
  }, 5);
  try {
    await waitFor(() => expect(screen.queryByText('관전 중') ?? screen.queryByText('다시 하기')).not.toBeNull(), { timeout: waitMs, interval: 20 });
    await waitFor(() => expect(screen.queryByText('다시 하기')).not.toBeNull(), { timeout: waitMs, interval: 20 });
  } finally {
    clearInterval(timer);
  }
  await waitFor(() => expect(screen.getAllByText(/선장|충성 선원|반란 선원|첩자/).length).toBeGreaterThanOrEqual(5));
}

describe('App', () => {
  it('shows other seats and my hand after start', async () => {
    startGame(5, false);
    await pickCharacter();
    await waitFor(() => expect(screen.getAllByTestId('seat-panel')).toHaveLength(4));
    await waitFor(() => expect(document.querySelectorAll('[data-anchor="hand"] .pcard').length).toBeGreaterThan(0));
  });

  it('plays through with default actions until spectating or result', async () => {
    startGame(5, false);
    await pickCharacter();
    await playThrough(10000);
  }, 25000);

  it('reaches the result screen with animations on (Review Focus 3)', async () => {
    startGame(5, true);
    await pickCharacter();
    await playThrough(19000);
  }, 20000);
});
