import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    // React logs caught errors to console.error — silence it for a clean run.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    container?.remove();
    container = null;
    vi.restoreAllMocks();
  });

  function render(node: React.ReactNode) {
    container = document.createElement('div');
    document.body.appendChild(container);
    flushSync(() => createRoot(container!).render(node));
    return container;
  }

  it('renders children when there is no error', () => {
    const el = render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(el.textContent).toContain('All good');
  });

  it('shows the recovery UI (with the error message) when a child throws', () => {
    const el = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(el.textContent).toContain('Something broke');
    expect(el.textContent).toContain('kaboom');
    expect(el.querySelector('button')).not.toBeNull();
  });
});
