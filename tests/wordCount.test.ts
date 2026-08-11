import { describe, expect, it } from 'vitest';
import { countCharacters, countWords } from '../src/shared/text/wordCount';

describe('countWords', () => {
  it('counts whitespace-separated tokens containing letters or numbers', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one  two\nthree\tfour')).toBe(4);
  });

  it('does not count Markdown punctuation-only tokens', () => {
    expect(countWords('# Title')).toBe(1);
    expect(countWords('- item\n* other')).toBe(2);
    expect(countWords('| a | b |')).toBe(2);
  });

  it('counts Unicode words', () => {
    expect(countWords('中文 段落')).toBe(2);
    expect(countWords('فقرة عربية')).toBe(2);
  });

  it('handles empty and whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });
});

describe('countCharacters', () => {
  it('returns the string length', () => {
    expect(countCharacters('abc')).toBe(3);
    expect(countCharacters('')).toBe(0);
  });
});
