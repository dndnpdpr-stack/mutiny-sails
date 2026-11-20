import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/theme.css', 'utf8');
const main = readFileSync('src/main.tsx', 'utf8');

describe('font', () => {
  it('uses bundled Pretendard everywhere, no old serif stack', () => {
    expect(main).toContain("pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css");
    expect(css).toMatch(/--font:\s*'Pretendard Variable'/);
    expect(css).not.toMatch(/Georgia|Batang|--serif/);
  });
});
