import DOMPurify from 'dompurify';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

marked.setOptions({ gfm: true, breaks: false });

export function expandWikiLinks(markdown: string): string {
  let fence: string | null = null;
  return markdown
    .split('\n')
    .map((line) => {
      const fenceMatch = line.match(/^\s*(```+|~~~+)/)?.[1] ?? null;
      if (fenceMatch) {
        if (!fence) fence = fenceMatch[0] ?? '`';
        else if (fenceMatch.startsWith(fence)) fence = null;
        return line;
      }
      if (fence) return line;
      return line
        .split(/(`+[^`]*`+)/g)
        .map((part) => {
          if (part.startsWith('`')) return part;
          return part.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_all, rawTarget, rawLabel) => {
            const target = String(rawTarget).trim();
            const [rawDocumentName, heading] = target.split('#', 2);
            const documentName = rawDocumentName ?? '';
            const fileName = /\.(md|markdown)$/i.test(documentName)
              ? documentName
              : `${documentName}.md`;
            const href = `./${encodeURI(fileName)}${heading ? `#${encodeURIComponent(heading)}` : ''}`;
            const label = String(rawLabel ?? target)
              .replaceAll('[', '\\[')
              .replaceAll(']', '\\]');
            return `[${label}](${href})`;
          });
        })
        .join('');
    })
    .join('\n');
}

export function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(expandWikiLinks(markdown), { async: false }) as string;
  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'button', 'textarea'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_DATA_ATTR: false,
  });
}

function turndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
  });
  service.use(gfm);
  service.keep(['mark', 'span', 'u', 'sup', 'sub']);
  service.addRule('font', {
    filter: (node) => node.nodeName === 'FONT',
    replacement: (_content, node) => (node as HTMLElement).outerHTML,
  });
  service.addRule('aligned-block', {
    filter: (node) =>
      node.nodeName === 'DIV' &&
      (node.hasAttribute('align') || (node.getAttribute('style') ?? '').includes('text-align')),
    replacement: (_content, node) => `\n${(node as HTMLElement).outerHTML}\n`,
  });
  service.addRule('visual-task-list-item', {
    filter: (node) => {
      if (node.nodeName !== 'LI') return false;
      const item = node as HTMLElement;
      return (
        item.querySelector('input[type="checkbox"]') !== null ||
        /^\s*\[[ xX]\]\s/.test(item.textContent ?? '')
      );
    },
    replacement: (content, node) => {
      const item = node as HTMLElement;
      const checkbox = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const marker = item.textContent?.match(/^\s*\[([ xX])\]\s/)?.[1];
      const checked = checkbox?.checked === true || marker?.toLocaleLowerCase() === 'x';
      const formatted = content.replace(/^\s*\\?\[[ xX]\\?\]\s*/, '').trim();
      return `\n- [${checked ? 'x' : ' '}] ${formatted}\n`;
    },
  });
  return service;
}

export function visualHtmlToMarkdown(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'button', 'textarea'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_DATA_ATTR: false,
  });
  return turndownService()
    .turndown(sanitized)
    .replace(/\n{3,}/g, '\n\n');
}

export interface OutlineHeading {
  level: number;
  text: string;
  line: number;
}

function withoutCode(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`]*`/g, '');
}

export function extractOutline(markdown: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const lines = markdown.split('\n');
  let inFence = false;
  let fence = '';
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fence = fenceMatch[1]?.[0] ?? '';
      } else if (fenceMatch[1]?.startsWith(fence)) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (match?.[1] && match[2]) {
      headings.push({ level: match[1].length, text: match[2], line: index + 1 });
    }
  }
  return headings;
}

export function extractTags(markdown: string): string[] {
  const tags = new Set<string>();
  for (const match of withoutCode(markdown).matchAll(/(^|\s)#([\p{L}\p{N}_/-]+)/gu)) {
    if (match[2]) tags.add(match[2]);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function extractWikiLinks(markdown: string): string[] {
  const links = new Set<string>();
  for (const match of withoutCode(markdown).matchAll(
    /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g,
  )) {
    const target = match[1]?.trim();
    if (target) links.add(target);
  }
  return [...links];
}
