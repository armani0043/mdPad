/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import {
  htmlForPaste,
  markdownForPaste,
  sanitizedClipboardHtml,
  sourceClipboardContent,
  visualClipboardContent,
} from '../src/renderer/src/editor/clipboard';

describe('rich clipboard conversion', () => {
  it('preserves exact mdPad Markdown when source formatting is kept', () => {
    const markdown = '## Heading\n\n**Bold** and <span style="color: red">red</span>';
    const content = sourceClipboardContent(markdown);

    expect(markdownForPaste(content, 'keep-source')).toBe(markdown);
    expect(content.html).toContain('<strong>Bold</strong>');
  });

  it('retains formatting inherited from partially selected visual elements', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p><strong style="color: red">Bold</strong> text</p>';
    const text = editor.querySelector('strong')?.firstChild;
    expect(text).toBeInstanceOf(Text);
    const range = document.createRange();
    range.setStart(text!, 0);
    range.setEnd(text!, 4);

    const content = visualClipboardContent(range, 'Bold', editor);

    expect(content.html).toContain('<strong style="color: red">Bold</strong>');
    expect(content.markdown).toContain('<strong style="color: red">Bold</strong>');
  });

  it('sanitizes unsafe HTML while retaining supported source formatting', () => {
    const content = {
      text: 'Rich text',
      markdown: '',
      html: '<p style="font-family: Georgia;color: red"><strong>Rich</strong> text<script>bad()</script></p>',
    };

    const pasted = htmlForPaste(content, 'keep-source');
    expect(pasted).toContain('font-family: Georgia');
    expect(pasted).toContain('<strong>Rich</strong>');
    expect(pasted).not.toContain('script');
    expect(markdownForPaste(content, 'keep-source')).toContain('font-family: Georgia');
  });

  it('merges document styling without losing semantic formatting', () => {
    const html =
      '<div class="WordSection" style="font-size: 18px;color: red"><p><strong>Bold</strong></p><ol><li>One</li></ol></div>';
    const merged = sanitizedClipboardHtml(html, 'merge-formatting');

    expect(merged).not.toContain('style=');
    expect(merged).not.toContain('class=');
    expect(merged).toContain('<strong>Bold</strong>');
    expect(
      markdownForPaste({ text: 'Bold One', html, markdown: '' }, 'merge-formatting'),
    ).toContain('**Bold**');
  });

  it('always uses the interoperable plain representation for Keep Text Only', () => {
    const content = {
      text: 'Bold without markers',
      html: '<strong>Bold without markers</strong>',
      markdown: '**Bold without markers**',
    };

    expect(markdownForPaste(content, 'text-only')).toBe('Bold without markers');
    expect(htmlForPaste(content, 'text-only')).toBeNull();
  });
});
