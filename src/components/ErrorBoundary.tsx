import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-level error boundary: catches render-time crashes anywhere in the tree
 * and shows a recovery screen instead of a blank page. Because the app is
 * local-first, a reload almost always recovers (data is safe in IndexedDB).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for debugging; a real backend could report this.
    console.error('App error boundary caught:', error, info.componentStack);
  }

  private handleReload = () => window.location.reload();

  private handleHome = () => window.location.assign(import.meta.env.BASE_URL);

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-8 text-center text-slate-100">
          <div className="text-4xl">😵‍💫</div>
          <h1 className="text-lg font-semibold">Something broke</h1>
          <p className="max-w-sm text-sm text-slate-400">
            The app hit an unexpected error. Your data is safe on this device — reloading usually
            fixes it.
          </p>
          <p className="max-w-sm break-words text-xs text-slate-600">{this.state.error.message}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={this.handleReload}
              className=" bg-beat px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              Reload
            </button>
            <button
              onClick={this.handleHome}
              className=" bg-slate-800 px-4 py-2.5 text-sm text-slate-100 hover:bg-slate-700"
            >
              Go home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
