import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Shown instead of the default screen. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Human label for the region that failed, e.g. "Панель биржи". */
  label?: string;
  /** Remount children when any of these values change (e.g. the active tab). */
  resetKeys?: unknown[];
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
  copied: boolean;
}

/**
 * React error boundary.
 *
 * Without one, a single thrown render — and this codebase has several paths that read
 * fields the store never sets — blanks the entire app with no way back. Wrapping the
 * tree (and individual panels) keeps one broken panel from taking the game down.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    const { resetKeys } = this.props;
    if (!this.state.error || !resetKeys || !prev.resetKeys) return;
    const changed =
      resetKeys.length !== prev.resetKeys.length ||
      resetKeys.some((k, i) => !Object.is(k, prev.resetKeys![i]));
    if (changed) this.reset();
  }

  reset = () => this.setState({ error: null, info: null, copied: false });

  private copy = async () => {
    const { error, info } = this.state;
    const text = [
      `${error?.name}: ${error?.message}`,
      error?.stack ?? '',
      info?.componentStack ?? '',
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 1600);
    } catch {
      /* clipboard unavailable (insecure context) — nothing useful to do */
    }
  };

  render() {
    const { error, info, copied } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex h-full min-h-[220px] w-full items-center justify-center p-4">
        <div className="panel w-full max-w-lg overflow-hidden">
          <div className="panel-header">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={16} />
              <h3 className="text-sm font-semibold">
                {this.props.label ? `Сбой: ${this.props.label}` : 'Что-то пошло не так'}
              </h3>
            </div>
            <button type="button" onClick={this.copy} className="icon-btn" title="Скопировать детали">
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="space-y-3 p-4">
            <p className="text-xs text-content-muted">
              Этот раздел не удалось отрисовать. Остальная игра продолжает работать — прогресс не
              потерян.
            </p>

            <pre className="max-h-40 overflow-auto rounded-md border border-edge bg-surface-base p-2 text-3xs leading-relaxed text-content-faint">
              {error.name}: {error.message}
              {info?.componentStack ? `\n${info.componentStack.trim().split('\n').slice(0, 8).join('\n')}` : ''}
            </pre>

            <div className="flex gap-2">
              <button type="button" onClick={this.reset} className="btn-primary btn-block">
                <RotateCcw size={14} />
                Попробовать снова
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn btn-block"
              >
                Перезагрузить
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

/** Convenience wrapper for guarding a single panel. */
export function PanelBoundary({ label, children }: { label: string; children: ReactNode }) {
  return <ErrorBoundary label={label}>{children}</ErrorBoundary>;
}
