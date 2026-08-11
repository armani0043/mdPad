import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SymbolPickerProps {
  onInsert(symbol: string): void;
  onClose(): void;
}

interface SymbolGroup {
  name: string;
  symbols: string[];
}

const SYMBOL_GROUPS: SymbolGroup[] = [
  {
    name: 'Common',
    symbols: '© ® ™ ° ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∆ µ π Ω § ¶ • · … ‰ † ‡'.split(' '),
  },
  {
    name: 'Punctuation',
    symbols: [
      '—',
      '–',
      '…',
      '•',
      '‣',
      '·',
      '«',
      '»',
      '‹',
      '›',
      '“',
      '”',
      '‘',
      '’',
      '¡',
      '¿',
      '№',
      '※',
    ],
  },
  {
    name: 'Arrows',
    symbols: [
      '←',
      '↑',
      '→',
      '↓',
      '↔',
      '↕',
      '↖',
      '↗',
      '↘',
      '↙',
      '⇐',
      '⇑',
      '⇒',
      '⇓',
      '⇔',
      '↩',
      '↪',
      '⟵',
      '⟶',
      '⟷',
    ],
  },
  {
    name: 'Mathematics',
    symbols: [
      '+',
      '−',
      '±',
      '×',
      '÷',
      '=',
      '≠',
      '≈',
      '≡',
      '<',
      '>',
      '≤',
      '≥',
      '∞',
      '√',
      '∛',
      '∑',
      '∏',
      '∫',
      '∮',
      '∂',
      '∆',
      '∇',
      '∝',
      '∴',
      '∵',
      '∈',
      '∉',
      '∅',
      '∩',
      '∪',
      '⊂',
      '⊆',
      '∀',
      '∃',
    ],
  },
  {
    name: 'Greek uppercase',
    symbols: 'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω'.split(' '),
  },
  {
    name: 'Greek lowercase',
    symbols: 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω'.split(' '),
  },
  {
    name: 'Currency',
    symbols: ['$', '¢', '€', '£', '¥', '₹', '₩', '₽', '₺', '₫', '₪', '₴', '₦', '₱', '₿'],
  },
  {
    name: 'Marks & shapes',
    symbols: [
      '✓',
      '✔',
      '✕',
      '✖',
      '✗',
      '★',
      '☆',
      '◆',
      '◇',
      '■',
      '□',
      '●',
      '○',
      '▲',
      '△',
      '▼',
      '▽',
      '♥',
      '♡',
      '♠',
      '♣',
      '♦',
      '☀',
      '☁',
      '☎',
      '✉',
    ],
  },
];

export function SymbolPicker({ onInsert, onClose }: SymbolPickerProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase();
  const groups = useMemo<SymbolGroup[]>(
    () =>
      SYMBOL_GROUPS.flatMap((group) => {
        if (!normalized || group.name.toLocaleLowerCase().includes(normalized)) return [group];
        const symbols = group.symbols.filter((symbol) => symbol.includes(normalized));
        return symbols.length ? [{ ...group, symbols }] : [];
      }),
    [normalized],
  );

  return (
    <div className="symbol-picker-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="symbol-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="symbol-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <strong id="symbol-picker-title">Symbols</strong>
            <span>Choose a symbol to insert at the cursor.</span>
          </div>
          <button type="button" title="Close" aria-label="Close symbols" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <label className="symbol-search">
          <Search size={16} />
          <input
            autoFocus
            value={query}
            placeholder="Filter by category"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
            }}
          />
        </label>
        <div className="symbol-groups">
          {groups.map((group) => (
            <section key={group.name}>
              <h3>{group.name}</h3>
              <div className="symbol-grid">
                {group.symbols.map((symbol) => (
                  <button
                    type="button"
                    key={`${group.name}-${symbol}`}
                    title={`Insert ${symbol}`}
                    aria-label={`Insert ${symbol}`}
                    onClick={() => onInsert(symbol)}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {groups.length === 0 && <p className="symbol-empty">No matching symbol category.</p>}
        </div>
      </section>
    </div>
  );
}
