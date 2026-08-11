/**
 * Predictable text metrics for the status bar.
 *
 * Word counting is intentionally simple and documented: text is split on
 * whitespace and every token containing at least one letter or number
 * (Unicode-aware) counts as a word. Markdown punctuation-only tokens such as
 * `#`, `-`, or `|` are not counted. Character count is the number of UTF-16
 * code units (matching string length), which is what most desktop editors
 * display.
 */

const WORD_TOKEN = /[\p{L}\p{N}]/u;

export function countWords(text: string): number {
  if (text.length === 0) return 0;
  let words = 0;
  for (const token of text.split(/\s+/)) {
    if (token.length > 0 && WORD_TOKEN.test(token)) {
      words += 1;
    }
  }
  return words;
}

export function countCharacters(text: string): number {
  return text.length;
}
