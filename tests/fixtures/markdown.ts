/**
 * Markdown fixture corpus. Built programmatically with explicit escape
 * sequences so exact bytes (CRLF, BOM, trailing spaces) survive Git checkout
 * and editor settings. Each fixture is the raw file text WITHOUT BOM; the
 * tests add a BOM where required.
 */

export interface MarkdownFixture {
  name: string;
  text: string;
}

const LF_BODY = [
  '# Heading One',
  '',
  'A paragraph with *italic* and _emphasis_ and **bold** text.',
  '',
  '- item one',
  '* item two',
  '  - nested bullet',
  '    1. deep ordered',
  '',
  '[Google][google]',
  '',
  '[google]: https://google.com',
  '',
  'Trailing spaces below:',
  'line with two trailing spaces  ',
  'line with a tab\tend',
  '',
  '```python',
  'def hello():',
  '    print("fences stay untouched")',
  '```',
  '',
].join('\n');

const CRLF_BODY = LF_BODY.split('\n').join('\r\n');

const UNICODE_BODY = [
  '# 多语言文档',
  '',
  '中文段落，包含标点：，。！',
  '',
  'فقرة عربية مع نص طويل للاختبار',
  '',
  'বাংলা অনুচ্ছেদ পরীক্ষার জন্য',
  '',
  'Emoji: 🚀 ✨ 📝 and accents: café naïve coördination',
  '',
].join('\n');

const FRONT_MATTER_BODY = [
  '---',
  'title: "Quoted: Title"',
  'tags: [research, draft]',
  'date: 2026-08-10',
  '---',
  '',
  '# Body After Front Matter',
  '',
  '| Column A | Column B |',
  '| -------- | :------: |',
  '| a1       | b1       |',
  '| a2       | b2       |',
  '',
  '<div class="note">',
  '  Embedded <b>HTML</b> stays as-is.',
  '</div>',
  '',
  '<!-- an HTML comment -->',
  '',
  '- [x] done task',
  '- [ ] open task',
  '',
].join('\n');

const MIXED_EOL_BODY = 'first line\r\nsecond line\nthird line\r\n';

export const MARKDOWN_FIXTURES: MarkdownFixture[] = [
  { name: 'lf-basic.md', text: LF_BODY },
  { name: 'crlf-basic.md', text: CRLF_BODY },
  { name: 'unicode.md', text: UNICODE_BODY },
  { name: 'front-matter-tables-html.md', text: FRONT_MATTER_BODY },
  { name: 'crlf-front-matter.md', text: FRONT_MATTER_BODY.split('\n').join('\r\n') },
  { name: 'mixed-eol.md', text: MIXED_EOL_BODY },
  { name: 'empty.md', text: '' },
  { name: 'no-trailing-newline.md', text: '# No newline at end of file' },
];

export const UTF8_BOM_STRING = String.fromCharCode(0xfeff);
