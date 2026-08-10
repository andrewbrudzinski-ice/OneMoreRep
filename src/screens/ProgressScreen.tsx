import { ComingSoon, ScreenHeader } from '../components/ScreenHeader';

export function ProgressScreen() {
  return (
    <>
      <ScreenHeader title="Progress" subtitle="History & analytics" />
      <ComingSoon note="PR feed, e1RM / volume charts, and the muscle-group heatmap land in Phases 3–7." />
    </>
  );
}
