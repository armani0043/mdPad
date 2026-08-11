import { useEffect, useMemo, useRef } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark-dimmed.css';
import { renderMarkdown } from '../markdown/markdown';

interface MarkdownPreviewProps {
  markdown: string;
  documentPath: string | null;
  onOpenLocalLink(href: string): void;
}

function isExternal(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}

export function MarkdownPreview({
  markdown,
  documentPath,
  onOpenLocalLink,
}: MarkdownPreviewProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    for (const code of host.querySelectorAll<HTMLElement>('pre code')) {
      if (!code.dataset.highlighted) hljs.highlightElement(code);
    }
    if (!documentPath) return;
    let cancelled = false;
    for (const image of host.querySelectorAll<HTMLImageElement>('img[src]')) {
      const source = image.getAttribute('src');
      if (!source || /^(data:|https?:|file:|javascript:)/i.test(source)) continue;
      void window.desktopAPI.readAsset({ documentPath, source }).then((result) => {
        if (!cancelled && result.ok && image.isConnected) image.src = result.value.dataUrl;
      });
    }
    return () => {
      cancelled = true;
    };
  }, [html, documentPath]);

  return (
    <article
      ref={hostRef}
      className="markdown-preview markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href') ?? '';
        if (href.startsWith('#')) return;
        event.preventDefault();
        if (isExternal(href)) void window.desktopAPI.openExternal(href);
        else onOpenLocalLink(href);
      }}
    />
  );
}
