import { ComingSoon, ScreenHeader } from '../components/ScreenHeader';

export function MoreScreen() {
  return (
    <>
      <ScreenHeader title="More" subtitle="Settings, data & about" />
      <ComingSoon note="Settings, the exercise database, and JSON export / import land in Phase 6." />
    </>
  );
}
