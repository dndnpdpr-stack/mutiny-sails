import { describe, it, expect } from 'vitest';
import { App } from '../src/ui/App';

describe('smoke', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
    expect(typeof App).toBe('function');
  });
});
