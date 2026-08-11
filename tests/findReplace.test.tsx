import { describe, expect, it } from 'vitest';
import {
  findMatches,
  replaceAllMatches,
  replaceMatch,
} from '../src/renderer/src/components/FindReplaceBar';

describe('shared document find and replace', () => {
  it('finds every non-overlapping match without case sensitivity by default', () => {
    expect(findMatches('Alpha alpha ALPHA', 'alpha', false)).toEqual([
      { from: 0, to: 5 },
      { from: 6, to: 11 },
      { from: 12, to: 17 },
    ]);
  });

  it('respects match case and handles an empty query', () => {
    expect(findMatches('Alpha alpha ALPHA', 'alpha', true)).toEqual([{ from: 6, to: 11 }]);
    expect(findMatches('anything', '', false)).toEqual([]);
  });

  it('replaces one match or all matches without disturbing other Markdown', () => {
    const markdown = '# Alpha\n\nAlpha and alpha.';
    const matches = findMatches(markdown, 'alpha', false);

    expect(replaceMatch(markdown, matches[1]!, 'Beta')).toBe('# Alpha\n\nBeta and alpha.');
    expect(replaceAllMatches(markdown, matches, 'Beta')).toBe('# Beta\n\nBeta and Beta.');
  });
});
