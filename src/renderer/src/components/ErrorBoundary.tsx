import { Component, type ErrorInfo, type ReactNode } from 'react';
import logoUrl from '../../../../resources/icon.png';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('mdPad renderer error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <img src={logoUrl} alt="mdPad" />
        <h1>mdPad encountered an error</h1>
        <p>
          Your files on disk were not modified. Unsaved recovery data remains in local app storage.
        </p>
        <pre>{this.state.error.message}</pre>
        <button type="button" onClick={() => window.location.reload()}>
          Reload mdPad
        </button>
      </main>
    );
  }
}
