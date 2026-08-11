import { useMemo, useRef, useState } from 'react';
import { CaseSensitive, ChevronDown, ChevronUp, Replace, ReplaceAll, X } from 'lucide-react';

export interface FindMatch {
  from: number;
  to: number;
}

interface FindReplaceBarProps {
  markdown: string;
  initialReplace: boolean;
  onChange(markdown: string): void;
  onClose(): void;
  onReveal(match: FindMatch, occurrence: number, query: string, matchCase: boolean): void;
}

export function findMatches(content: string, query: string, matchCase: boolean): FindMatch[] {
  if (!query) return [];
  const haystack = matchCase ? content : content.toLocaleLowerCase();
  const needle = matchCase ? query : query.toLocaleLowerCase();
  const matches: FindMatch[] = [];
  let from = 0;
  while (from <= haystack.length) {
    const found = haystack.indexOf(needle, from);
    if (found < 0) break;
    matches.push({ from: found, to: found + query.length });
    from = found + Math.max(query.length, 1);
  }
  return matches;
}

export function replaceMatch(content: string, match: FindMatch, replacement: string): string {
  return `${content.slice(0, match.from)}${replacement}${content.slice(match.to)}`;
}

export function replaceAllMatches(
  content: string,
  matches: FindMatch[],
  replacement: string,
): string {
  let result = content;
  for (const match of [...matches].reverse()) {
    result = replaceMatch(result, match, replacement);
  }
  return result;
}

export function selectTextOccurrence(
  root: HTMLElement,
  query: string,
  occurrence: number,
  matchCase: boolean,
): boolean {
  if (!query) return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Array<{ node: Text; from: number; to: number }> = [];
  let text = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const value = node.nodeValue ?? '';
    if (!value) continue;
    const from = text.length;
    text += value;
    nodes.push({ node, from, to: text.length });
  }
  const matches = findMatches(text, query, matchCase);
  const match = matches[Math.min(Math.max(occurrence, 0), matches.length - 1)];
  if (!match) return false;
  const start = nodes.find((item) => match.from >= item.from && match.from < item.to);
  const end = nodes.find((item) => match.to > item.from && match.to <= item.to);
  if (!start || !end) return false;
  const range = document.createRange();
  range.setStart(start.node, match.from - start.from);
  range.setEnd(end.node, match.to - end.from);
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  (start.node.parentElement ?? root).scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}

export function FindReplaceBar({
  markdown,
  initialReplace,
  onChange,
  onClose,
  onReveal,
}: FindReplaceBarProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [showReplace, setShowReplace] = useState(initialReplace);
  const [matchCase, setMatchCase] = useState(false);
  const [current, setCurrent] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const matches = useMemo(
    () => findMatches(markdown, query, matchCase),
    [markdown, query, matchCase],
  );
  const safeCurrent = matches.length === 0 ? 0 : Math.min(current, matches.length - 1);

  const reveal = (
    index: number,
    nextQuery = query,
    nextCase = matchCase,
    source = markdown,
  ): void => {
    const nextMatches = findMatches(source, nextQuery, nextCase);
    if (nextMatches.length === 0) return;
    const safeIndex = ((index % nextMatches.length) + nextMatches.length) % nextMatches.length;
    setCurrent(safeIndex);
    const match = nextMatches[safeIndex];
    if (match) requestAnimationFrame(() => onReveal(match, safeIndex, nextQuery, nextCase));
  };

  const replaceCurrent = (): void => {
    const match = matches[safeCurrent];
    if (!match) return;
    const next = replaceMatch(markdown, match, replacement);
    onChange(next);
    reveal(safeCurrent, query, matchCase, next);
  };

  const replaceEveryMatch = (): void => {
    if (matches.length === 0) return;
    const next = replaceAllMatches(markdown, matches, replacement);
    onChange(next);
    reveal(0, query, matchCase, next);
  };

  return (
    <aside className="find-replace-bar" role="search" aria-label="Document navigation">
      <header className="find-pane-header">
        <div>
          <strong>Navigation</strong>
          <span>Find in this document</span>
        </div>
        <button
          type="button"
          className="find-close"
          title="Close navigation pane"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <button
        type="button"
        className={showReplace ? 'find-toggle active' : 'find-toggle'}
        title={showReplace ? 'Hide replace' : 'Show replace'}
        onClick={() => setShowReplace(!showReplace)}
      >
        <Replace size={16} />
        <span>{showReplace ? 'Replace is open' : 'Show replace'}</span>
      </button>
      <div className="find-fields">
        <div className="find-row">
          <input
            ref={inputRef}
            autoFocus
            value={query}
            placeholder="Find in this document"
            aria-label="Find text"
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setCurrent(0);
              reveal(0, value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'Enter') reveal(safeCurrent + (event.shiftKey ? -1 : 1));
            }}
          />
          <button
            type="button"
            title="Match case"
            className={matchCase ? 'active' : ''}
            onClick={() => {
              const nextCase = !matchCase;
              setMatchCase(nextCase);
              setCurrent(0);
              reveal(0, query, nextCase);
              inputRef.current?.focus();
            }}
          >
            <CaseSensitive size={17} />
          </button>
        </div>
        <div className="find-navigation-row">
          <span className="find-count">
            {!query
              ? 'Type to search'
              : matches.length === 0
                ? 'No results'
                : `${safeCurrent + 1} of ${matches.length}`}
          </span>
          <button type="button" title="Previous match" onClick={() => reveal(safeCurrent - 1)}>
            <ChevronUp size={17} />
          </button>
          <button type="button" title="Next match" onClick={() => reveal(safeCurrent + 1)}>
            <ChevronDown size={17} />
          </button>
        </div>
        {showReplace && (
          <div className="find-row replace-row">
            <input
              value={replacement}
              placeholder="Replace with"
              aria-label="Replacement text"
              onChange={(event) => setReplacement(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') onClose();
                if (event.key === 'Enter') replaceCurrent();
              }}
            />
            <button type="button" title="Replace current" onClick={replaceCurrent}>
              <Replace size={17} />
              <span>Replace</span>
            </button>
            <button type="button" title="Replace all" onClick={replaceEveryMatch}>
              <ReplaceAll size={17} />
              <span>All</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
