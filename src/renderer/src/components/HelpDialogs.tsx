import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import logoUrl from '../../../../resources/icon.png';

interface CloseProps {
  onClose(): void;
}

interface GuideStep {
  selector: string;
  title: string;
  description: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    selector: '.ribbon-brand-row',
    title: 'Quick access and window controls',
    description:
      'Save, Undo, and Redo are always available here. The active document title stays centered, with the standard window controls on the right.',
  },
  {
    selector: '.ribbon-tabs-row',
    title: 'The mdPad ribbon',
    description:
      'Choose File, Home, Insert, Workspace, View, or Help to show the tools for that part of your work.',
  },
  {
    selector: '.ribbon-panel',
    title: 'Editing tools',
    description:
      'Use the ribbon for formatting, alignment, links, images, tables, symbols, search, export, and workspace actions.',
  },
  {
    selector: '.tab-strip',
    title: 'Open documents',
    description:
      'Each open Markdown file has a tab. Click a tab to switch documents, or use View → Side by side to see all open files together.',
  },
  {
    selector: '.editor-pane',
    title: 'Your document workspace',
    description:
      'Edit in Visual or Source mode, read the rendered result in Preview, or use Split to edit and preview at the same time.',
  },
  {
    selector: '.status-bar',
    title: 'Document status',
    description:
      'The status bar shows useful document information such as cursor position, word count, line endings, and encoding.',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuideTour({ onClose }: CloseProps): React.JSX.Element {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const step = GUIDE_STEPS[stepIndex]!;

  useEffect(() => {
    const update = (): void => {
      const target = document.querySelector<HTMLElement>(step.selector);
      if (!target) return setRect(null);
      const bounds = target.getBoundingClientRect();
      setRect({
        top: Math.max(6, bounds.top - 4),
        left: Math.max(6, bounds.left - 4),
        width: Math.min(window.innerWidth - 12, bounds.width + 8),
        height: Math.min(window.innerHeight - 12, bounds.height + 8),
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [step]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="guide-tour-layer" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      {rect && (
        <div
          className="guide-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      <section className="guide-card">
        <div
          className="guide-progress"
          aria-label={`Step ${stepIndex + 1} of ${GUIDE_STEPS.length}`}
        >
          {GUIDE_STEPS.map((item, index) => (
            <span key={item.title} className={index === stepIndex ? 'active' : ''} />
          ))}
        </div>
        <span className="guide-step-label">
          Step {stepIndex + 1} of {GUIDE_STEPS.length}
        </span>
        <h2 id="guide-title">{step.title}</h2>
        <p>{step.description}</p>
        <footer>
          <button type="button" className="guide-skip" onClick={onClose}>
            Skip guide
          </button>
          <div>
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (stepIndex === GUIDE_STEPS.length - 1) onClose();
                else setStepIndex((index) => index + 1);
              }}
            >
              {stepIndex === GUIDE_STEPS.length - 1 ? 'Finish' : 'Next'}
              {stepIndex < GUIDE_STEPS.length - 1 && <ChevronRight size={16} />}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function AboutDialog({ onClose }: CloseProps): React.JSX.Element {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="about-close"
          type="button"
          title="Close"
          aria-label="Close about"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <img src={logoUrl} alt="mdPad logo" />
        <h2 id="about-title">mdPad</h2>
        <p className="about-subtitle">A clear, private desktop home for Markdown.</p>
        <p>mdPad is a Markdown editor and viewer developed by</p>
        <p className="about-author">Shafiq Abdul Rehman (PhD).</p>
        <p>
          Originally created for personal use, it is shared publicly to make working with Markdown
          files easier, clearer, and more accessible.
        </p>
        <p>
          mdPad helps people comfortably read, understand, organize, and edit Markdown documents
          through a clean offline desktop interface.
        </p>
        <span className="about-note">Your documents stay on your computer.</span>
        <a
          className="about-contact"
          href="mailto:mdpad@olynors.com"
          onClick={(event) => {
            event.preventDefault();
            void window.desktopAPI.openExternal('mailto:mdpad@olynors.com');
          }}
        >
          mdpad@olynors.com
        </a>
      </section>
    </div>
  );
}
