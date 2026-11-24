import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../src/ui/App';

function startGame(count: number, animations: boolean, seed = 11) {
  render(<App defaults={{ seed, aiDelayMs: 0, animations }} />);
  fireEvent.click(screen.getByText(`${count}명`));
  fireEvent.click(screen.getByText('출항'));
}

async function pickCharacter() {
  const roleCards = await screen.findAllByRole('button', { name: /^역할 카드 \d+번$/ }, { timeout: 3000 });
  fireEvent.click(roleCards[0]);
  const picks = await screen.findAllByRole('button', { name: /고르기$/ }, { timeout: 3000 });
  fireEvent.click(picks[0]);
}

/** 기본 행동(맞기·포기·턴 종료…)을 계속 누른다. 돌려준 함수로 멈춘다 */
function autoplay(): () => void {
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
  return () => clearInterval(timer);
}

async function playUntil(done: () => boolean, waitMs: number) {
  const stop = autoplay();
  try {
    await waitFor(() => expect(done()).toBe(true), { timeout: waitMs, interval: 20 });
  } finally {
    stop();
  }
}

/** 기본 행동만 눌러 결과 화면까지 진행 */
async function playThrough(waitMs: number) {
  const stop = autoplay();
  try {
    await waitFor(() => expect(screen.queryByText('관전 중') ?? screen.queryByText('다시 하기')).not.toBeNull(), { timeout: waitMs, interval: 20 });
    await waitFor(() => expect(screen.queryByText('다시 하기')).not.toBeNull(), { timeout: waitMs, interval: 20 });
  } finally {
    stop();
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

  it('new game from spectating goes back to setup', async () => {
    startGame(5, false, 1); // seed 1: 기본 행동만 하면 내가 먼저 쓰러진다
    await pickCharacter();
    await playUntil(() => screen.queryByText('관전 중') !== null, 10000);
    const ff = screen.getByRole('button', { name: /빨리 감기/ });
    fireEvent.click(ff);
    expect(ff.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '새로 하기' }));
    expect(await screen.findByText('출항')).toBeTruthy();
  }, 25000);

  it('reaches the result screen with animations on (Review Focus 3)', async () => {
    startGame(5, true);
    await pickCharacter();
    await playThrough(19000);
  }, 20000);
});
