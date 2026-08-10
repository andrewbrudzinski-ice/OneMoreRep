import { afterEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TrendChart, type TrendPoint } from './TrendChart';

/** Phase 3 check: chart components render with sample data. */
describe('TrendChart', () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  function render(node: React.ReactNode) {
    container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() => root.render(node));
    return container;
  }

  const sample: TrendPoint[] = [
    { label: 'Jan 1', value: 240 },
    { label: 'Jan 8', value: 246 },
    { label: 'Jan 15', value: 251 },
  ];

  it('renders an SVG line chart from sample data', () => {
    const el = render(<TrendChart data={sample} width={400} height={200} unit="lbs" />);
    const svg = el.querySelector('svg.recharts-surface');
    expect(svg).not.toBeNull();
    // A line path should be drawn for the series.
    expect(el.querySelector('path.recharts-line-curve')).not.toBeNull();
  });

  it('shows an empty state when there is no data', () => {
    const el = render(<TrendChart data={[]} width={400} height={200} />);
    expect(el.querySelector('svg.recharts-surface')).toBeNull();
    expect(el.textContent).toContain('Not enough data yet');
  });
});
