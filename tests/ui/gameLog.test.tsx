import { render } from '@testing-library/react';
import { GameLog } from '../../src/ui/table/GameLog';
import type { GameEvent } from '../../src/engine/types';

const turns = (n: number): GameEvent[] => Array.from({ length: n }, (_, i) => ({ seq: i + 1, type: 'turnStart', seat: i % 4 }));
const name = (s: number) => `p${s}`;

describe('GameLog', () => {
  it('keeps every event the view carries so older ones can be scrolled back to', () => {
    const { container } = render(<GameLog events={turns(30)} name={name} />);
    expect(container.querySelectorAll('li')).toHaveLength(30);
    expect(container.querySelector('.log-scroll')).not.toBeNull();
  });

  it('scrolls to the newest entry when new events arrive and the reader is at the bottom', () => {
    const { container, rerender } = render(<GameLog events={turns(5)} name={name} />);
    const box = container.querySelector('.log-scroll') as HTMLElement;
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 100 });
    rerender(<GameLog events={turns(6)} name={name} />);
    expect(box.scrollTop).toBe(500);
  });

  it('leaves the scroll position alone when the reader scrolled up', () => {
    const { container, rerender } = render(<GameLog events={turns(5)} name={name} />);
    const box = container.querySelector('.log-scroll') as HTMLElement;
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 100 });
    box.scrollTop = 50;
    box.dispatchEvent(new Event('scroll'));
    rerender(<GameLog events={turns(6)} name={name} />);
    expect(box.scrollTop).toBe(50);
  });
});
