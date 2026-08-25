import type { ClipboardContent } from '../../../shared/types';
import { renderMarkdown, visualHtmlToMarkdown } from '../markdown/markdown';
import type { PasteMode } from './commands';

const FORBIDDEN_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'button', 'textarea'];
const ALLOWED_TAGS = new Set([
  'A',
  'ABBR',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CAPTION',
  'CITE',
  'CODE',
  'COL',
  'COLGROUP',
  'DEL',
  'DIV',
  'EM',
  'FONT',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'I',
  'IMG',
  'KBD',
  'LI',
  'MARK',
  'OL',
  'P',
  'PRE',
  'Q',
  'S',
  'SAMP',
  'SMALL',
  'SPAN',
  'STRIKE',
  'STRONG',
  'SUB',
  'SUP',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'U',
  'UL',
  'VAR',
  'WBR',
]);
const GLOBAL_ATTRIBUTES = new Set(['style', 'title', 'lang', 'dir', 'align']);
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  A: new Set(['href', 'target', 'rel']),
  COL: new Set(['span', 'width']),
  FONT: new Set(['face', 'size', 'color']),
  IMG: new Set(['src', 'alt', 'width', 'height']),
  LI: new Set(['value']),
  OL: new Set(['start', 'type']),
  TD: new Set(['colspan', 'rowspan', 'width', 'height', 'bgcolor']),
  TH: new Set(['colspan', 'rowspan', 'width', 'height', 'bgcolor']),
};
const ALLOWED_STYLE_PROPERTIES = new Set([
  'background-color',
  'border',
  'border-bottom',
  'border-color',
  'border-left',
  'border-right',
  'border-style',
  'border-top',
  'border-width',
  'color',
  'font',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
  'list-style',
  'list-style-position',
  'list-style-type',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'text-decoration-line',
  'text-indent',
  'text-transform',
  'vertical-align',
  'white-space',
]);

function safeUrl(value: string, image: boolean): boolean {
  const trimmed = value.trim();
  if (!trimmed || /^[#./]|^\.\./.test(trimmed)) return true;
  if (/^(https?:|mailto:)/i.test(trimmed)) return true;
  return image && /^data:image\/(?:png|gif|jpe?g|webp|svg\+xml);/i.test(trimmed);
}

function sanitizeStyle(element: HTMLElement): void {
  const declarations = Array.from({ length: element.style.length }, (_value, index) =>
    element.style.item(index),
  ).filter(Boolean);
  for (const property of declarations) {
    const value = element.style.getPropertyValue(property);
    if (
      !ALLOWED_STYLE_PROPERTIES.has(property.toLocaleLowerCase()) ||
      /(?:url\s*\(|expression\s*\(|javascript:|@import)/i.test(value)
    ) {
      element.style.removeProperty(property);
    }
  }
  if (!element.style.cssText) element.removeAttribute('style');
}

function sanitizeClipboardTree(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const tag of FORBIDDEN_TAGS) {
    for (const element of template.content.querySelectorAll(tag)) element.remove();
  }
  for (const element of [...template.content.querySelectorAll<HTMLElement>('*')]) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLocaleLowerCase();
      if (!GLOBAL_ATTRIBUTES.has(name) && !TAG_ATTRIBUTES[element.tagName]?.has(name)) {
        element.removeAttribute(attribute.name);
      }
    }
    if (element.hasAttribute('style')) sanitizeStyle(element);
    for (const name of ['href', 'src']) {
      const value = element.getAttribute(name);
      if (value !== null && !safeUrl(value, element.tagName === 'IMG'))
        element.removeAttribute(name);
    }
    if (element.tagName === 'A' && element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }
  return template.content;
}

export function emptyClipboardContent(): ClipboardContent {
  return { text: '', html: '', markdown: '' };
}

/** Read all browser-provided formats before a paste/copy event becomes invalid. */
export function clipboardContentFromTransfer(transfer: DataTransfer | null): ClipboardContent {
  if (!transfer) return emptyClipboardContent();
  return {
    text: transfer.getData('text/plain'),
    html: transfer.getData('text/html'),
    markdown: transfer.getData('text/markdown'),
  };
}

export function writeClipboardTransfer(
  transfer: DataTransfer | null,
  content: ClipboardContent,
): boolean {
  if (!transfer) return false;
  transfer.setData('text/plain', content.text);
  if (content.html) transfer.setData('text/html', content.html);
  if (content.markdown) transfer.setData('text/markdown', content.markdown);
  return true;
}

/**
 * Keep only safe HTML. Merge Formatting additionally removes source-specific
 * fonts, sizes, colours, classes, alignment and identifiers while retaining
 * semantic structure such as emphasis, links, headings, lists and tables.
 */
export function sanitizedClipboardHtml(
  html: string,
  mode: Exclude<PasteMode, 'text-only'>,
): string {
  const content = sanitizeClipboardTree(html);
  const container = document.createElement('div');
  container.append(content);
  const sanitized = container.innerHTML;
  if (mode === 'keep-source' || !sanitized) return sanitized;

  const template = document.createElement('template');
  template.innerHTML = sanitized;
  for (const element of template.content.querySelectorAll<HTMLElement>('*')) {
    for (const attribute of [
      'style',
      'class',
      'id',
      'face',
      'size',
      'color',
      'bgcolor',
      'align',
      'width',
      'height',
    ]) {
      element.removeAttribute(attribute);
    }
  }
  for (const font of template.content.querySelectorAll('font'))
    font.replaceWith(...font.childNodes);
  for (const span of template.content.querySelectorAll(
    'span:not([title]):not([lang]):not([dir])',
  )) {
    if (span.attributes.length === 0) span.replaceWith(...span.childNodes);
  }
  return template.innerHTML;
}

export function sourceClipboardContent(markdown: string): ClipboardContent {
  return {
    text: markdown,
    html: renderMarkdown(markdown),
    markdown,
  };
}

export function visualClipboardContent(
  range: Range,
  text: string,
  editorRoot: HTMLElement,
): ClipboardContent {
  const container = document.createElement('div');
  container.append(range.cloneContents());
  let ancestor =
    range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  while (ancestor && ancestor !== editorRoot) {
    const wrapper = ancestor.cloneNode(false) as HTMLElement;
    wrapper.removeAttribute('id');
    wrapper.append(...container.childNodes);
    container.replaceChildren(wrapper);
    ancestor = ancestor.parentElement;
  }
  const html = sanitizedClipboardHtml(container.innerHTML, 'keep-source');
  return {
    text,
    html,
    markdown: visualHtmlToMarkdown(html),
  };
}

/** Convert rich clipboard data into the Markdown stored by mdPad source mode. */
export function markdownForPaste(content: ClipboardContent, mode: PasteMode): string {
  if (mode === 'text-only') return content.text;
  if (mode === 'keep-source' && content.markdown) return content.markdown;
  const html = content.html || (content.markdown ? renderMarkdown(content.markdown) : '');
  if (!html) return content.text;
  return visualHtmlToMarkdown(sanitizedClipboardHtml(html, mode));
}

/** Produce safe rich HTML for visual mode, or null when plain insertion is required. */
export function htmlForPaste(content: ClipboardContent, mode: PasteMode): string | null {
  if (mode === 'text-only') return null;
  const html = content.html || (content.markdown ? renderMarkdown(content.markdown) : '');
  return html ? sanitizedClipboardHtml(html, mode) : null;
}
