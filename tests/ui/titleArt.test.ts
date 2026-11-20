import { readFileSync } from 'node:fs';

describe('title art', () => {
  it('drifts the waves by exactly one wave period so the loop is seamless', () => {
    const svg = readFileSync('src/ui/art/title.svg', 'utf8');
    expect(svg).toContain('translateX(-80px)');
  });
});
