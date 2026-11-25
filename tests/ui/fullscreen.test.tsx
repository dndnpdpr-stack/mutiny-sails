import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FullscreenButton } from '../../src/ui/table/FullscreenButton';
import { SetupScreen } from '../../src/ui/screens/SetupScreen';

const el = document.documentElement as HTMLElement & { requestFullscreen?: unknown };

function fakeDevice(touch: boolean) {
  window.matchMedia = ((q: string) => ({ matches: touch && q === '(pointer: coarse)', media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

describe('fullscreen', () => {
  let request: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    request = vi.fn(() => {
      Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    el.requestFullscreen = request;
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(el, "requestFullscreen");
  });

  it('the in-game button turns fullscreen on and shows that it is on', () => {
    fakeDevice(true);
    render(<FullscreenButton />);
    act(() => fireEvent.click(screen.getByRole('button', { name: '전체 화면' })));
    expect(request).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '전체 화면 끄기' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('is hidden when the browser cannot go fullscreen', () => {
    Reflect.deleteProperty(el, "requestFullscreen");
    fakeDevice(true);
    const { container } = render(<FullscreenButton />);
    expect(container.innerHTML).toBe('');
  });

  it('on a phone, setting sail goes fullscreen unless the option is off', () => {
    fakeDevice(true);
    const { unmount } = render(<SetupScreen onStart={() => {}} />);
    fireEvent.click(screen.getByText('출항'));
    expect(request).toHaveBeenCalledTimes(1);
    unmount();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    render(<SetupScreen onStart={() => {}} />);
    fireEvent.click(screen.getByLabelText(/출항하면 전체 화면/));
    fireEvent.click(screen.getByText('출항'));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('on a computer there is no fullscreen option and setting sail stays windowed', () => {
    fakeDevice(false);
    render(<SetupScreen onStart={() => {}} />);
    expect(screen.queryByLabelText(/출항하면 전체 화면/)).toBeNull();
    fireEvent.click(screen.getByText('출항'));
    expect(request).not.toHaveBeenCalled();
  });
});
